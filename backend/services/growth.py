from dataclasses import dataclass
from sqlalchemy.orm import Session

from backend import schemas
from backend.account_categories import INVESTED_CATEGORIES, get_invested_group
from backend.repositories import accounts_repository, balances_repository, contributions_repository

# An annualized return outside this range is treated as a data problem, not a result.
MIN_ANNUAL_RATE_PCT = -30.0
MAX_ANNUAL_RATE_PCT = 40.0

# An account needs this many usable month-pairs before its own historical rate is trusted.
MIN_PAIRS_FOR_OWN_RATE = 12

# The default monthly contribution is the average deposit over this many completed months.
TRAILING_CONTRIBUTION_MONTHS = 12

GROUPS = ("non_retirement", "retirement")


##-----------------------------------------------------
## Errors
##-----------------------------------------------------

class GrowthError(Exception):
    """Base class for growth-projection errors the router reports as HTTP 422."""


class GrowthInputError(GrowthError):
    """The request can't be projected as given (for example, a target account that isn't selected)."""


class ImplausibleRateError(GrowthError):
    """A return rate is outside MIN_ANNUAL_RATE_PCT..MAX_ANNUAL_RATE_PCT."""


##-----------------------------------------------------
## Month helpers
##-----------------------------------------------------
# Months are "YYYY-MM" strings at the edges and integer month indexes
# (year * 12 + month - 1) inside, so month arithmetic is plain addition.

def month_index(month: str) -> int:
    return int(month[:4]) * 12 + int(month[5:7]) - 1


def month_label(index: int) -> str:
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


##-----------------------------------------------------
## Account data
##-----------------------------------------------------

@dataclass
class AccountSeries:
    id: int
    name: str
    group: str                      # "non_retirement" or "retirement"
    balances: dict[int, int]        # month index -> start-of-month balance, cents
    contributions: dict[int, int]   # month index -> contribution that month, cents

    @property
    def first(self) -> int:
        return min(self.balances)

    @property
    def last(self) -> int:
        return max(self.balances)

    @property
    def last_balance(self) -> int:
        return self.balances[self.last]

    @property
    def is_live(self) -> bool:
        return self.last_balance > 0


def carried_balances(balances: dict[int, int], start: int, end: int) -> list[int]:
    """
    One balance per month from start to end inclusive. A month without an entry carries
    the last known balance forward (stale accounts keep their last balance); months
    before the account's first entry are 0.
    """
    earlier = [m for m in balances if m <= start]
    current = balances[max(earlier)] if earlier else 0

    values = []
    for month in range(start, end + 1):
        if month in balances:
            current = balances[month]
        values.append(current)

    return values


##-----------------------------------------------------
## Rate estimation
##-----------------------------------------------------

def estimate_annual_rate(series: AccountSeries, window_months: int):
    """
    Returns (annual_rate_pct or None, pairs_used) from the account's trailing window.

    Each pair of consecutive entries (M, M+1) gives a gain of
    balance(M+1) - balance(M) - contribution(M), earned on a base of
    balance(M) + contribution(M) (a contribution is treated as invested at the start
    of its month). The rate is total gain / total base across the window, which
    weights each month by its size, so tiny-base months (for example after an HSA
    withdrawal) barely count. Pairs with a base of zero or less are skipped.
    Returns None for the rate when there are fewer than MIN_PAIRS_FOR_OWN_RATE pairs.
    """
    last = series.last
    balances = series.balances

    gain_total = 0
    base_total = 0
    pairs = 0

    for month in range(last - window_months, last):
        if month not in balances or month + 1 not in balances:
            continue

        contribution = series.contributions.get(month, 0)
        base = balances[month] + contribution
        if base <= 0:
            continue

        gain_total += balances[month + 1] - balances[month] - contribution
        base_total += base
        pairs += 1

    if pairs < MIN_PAIRS_FOR_OWN_RATE:
        return None, pairs

    monthly_rate = gain_total / base_total
    annual_rate = (max(1 + monthly_rate, 0) ** 12 - 1) * 100

    return annual_rate, pairs


def weighted_rate(candidates: list[AccountSeries], own_rates: dict[int, float]) -> float:
    """Average of the candidates' own rates, weighted by their latest balances (plain average if all are 0)."""
    weights = [max(s.last_balance, 0) for s in candidates]
    rates = [own_rates[s.id] for s in candidates]

    total = sum(weights)
    if total <= 0:
        return sum(rates) / len(rates)

    return sum(w * r for w, r in zip(weights, rates)) / total


def check_rate_plausible(series: AccountSeries, rate: float, source: str, pairs: int, window_months: int):
    if MIN_ANNUAL_RATE_PCT <= rate <= MAX_ANNUAL_RATE_PCT:
        return

    allowed = f"the allowed range of {MIN_ANNUAL_RATE_PCT:.0f}% to {MAX_ANNUAL_RATE_PCT:.0f}%"

    if source == "manual":
        raise ImplausibleRateError(f"Manual annual return of {rate:.1f}% is outside {allowed}.")

    raise ImplausibleRateError(
        f"{series.name}: annual return of {rate:.1f}% ({source}, {pairs} months of usable data, "
        f"{window_months}-month window) is outside {allowed}."
    )


def resolve_rates(
    all_series: list[AccountSeries],
    return_mode: str,
    manual_return_pct: float,
    window_months: int,
):
    """
    Returns {account_id: (rate_pct, source, pairs_used)} for the given accounts, which should
    be live accounts only (an account with a zero balance has nothing left to project).

    Manual mode: every account gets manual_return_pct.
    Historical mode: an account with enough history uses its own rate; otherwise it
    borrows the balance-weighted rate of the qualifying accounts in its own group, then
    of all qualifying accounts, then manual_return_pct.
    """
    estimates = {s.id: estimate_annual_rate(s, window_months) for s in all_series}
    own_rates = {account_id: rate for account_id, (rate, _) in estimates.items() if rate is not None}
    qualifying = [s for s in all_series if s.id in own_rates]

    resolved = {}

    for series in all_series:
        _, pairs = estimates[series.id]

        if return_mode == "manual":
            rate, source = manual_return_pct, "manual"
        elif series.id in own_rates:
            rate, source = own_rates[series.id], "own"
        else:
            same_group = [s for s in qualifying if s.group == series.group]

            if same_group:
                rate, source = weighted_rate(same_group, own_rates), "group_fallback"
            elif qualifying:
                rate, source = weighted_rate(qualifying, own_rates), "all_fallback"
            else:
                rate, source = manual_return_pct, "manual"

        check_rate_plausible(series, rate, source, pairs, window_months)
        resolved[series.id] = (rate, source, pairs)

    return resolved


##-----------------------------------------------------
## Contributions
##-----------------------------------------------------

def trailing_deposits(series: AccountSeries, start: int) -> int:
    """Total deposits (positive contributions only; withdrawals are ignored) over the completed months before start."""
    return sum(
        amount
        for month, amount in series.contributions.items()
        if start - TRAILING_CONTRIBUTION_MONTHS <= month < start and amount > 0
    )


def contribution_steps(plan: schemas.ContributionPlan, trailing_avg_cents: int, start: int) -> list[tuple[int, int]]:
    """The plan as (month index, monthly cents) steps, sorted by month. With no schedule, the trailing average from the start."""
    if not plan.schedule:
        return [(start, trailing_avg_cents)]

    steps = [
        (start if step.from_month is None else month_index(step.from_month), step.monthly_cents)
        for step in plan.schedule
    ]

    return sorted(steps, key=lambda step: step[0])


def amount_for_month(steps: list[tuple[int, int]], month: int) -> int:
    """The monthly amount in effect during month (0 before the first step)."""
    amount = 0
    for step_month, cents in steps:
        if step_month <= month:
            amount = cents

    return amount


def contribution_shares(plan: schemas.ContributionPlan, group_series: list[AccountSeries], start: int) -> dict[int, float]:
    """
    How a group's monthly amount is divided: {account_id: share, shares sum to 1}.
    All to plan.target_account_id if set; otherwise split across the group's live accounts
    by trailing deposits, or by balance if none of them has deposited. Empty if no live account.
    """
    if plan.target_account_id is not None:
        target = next((s for s in group_series if s.id == plan.target_account_id), None)
        if target is None:
            raise GrowthInputError(
                f"Target account {plan.target_account_id} is not a selected account in this contribution group."
            )
        if not target.is_live:
            raise GrowthInputError(f"Target account {target.name} has a zero balance, so it can't receive contributions.")
        return {target.id: 1.0}

    live = [s for s in group_series if s.is_live]

    weights = {s.id: trailing_deposits(s, start) for s in live}
    if sum(weights.values()) <= 0:
        weights = {s.id: s.last_balance for s in live}

    total = sum(weights.values())
    if total <= 0:
        return {}

    return {account_id: weight / total for account_id, weight in weights.items()}


##-----------------------------------------------------
## Projection
##-----------------------------------------------------

def project_account(start_balance: float, monthly_contributions: list[float], annual_rate_pct: float) -> list[float]:
    """
    Balances from the start month through the end of the horizon (one more value than there
    are contributions). Each month: next = (balance + contribution) * (1 + monthly rate),
    the same start-of-month convention used to estimate the rate.
    """
    monthly_rate = (1 + annual_rate_pct / 100) ** (1 / 12) - 1

    balance = start_balance
    values = [balance]

    for contribution in monthly_contributions:
        balance = (balance + contribution) * (1 + monthly_rate)
        values.append(balance)

    return values


##-----------------------------------------------------
## Orchestration
##-----------------------------------------------------

def empty_response(ignored_ids: list[int]) -> schemas.GrowthProjectionResponse:
    return schemas.GrowthProjectionResponse(
        dates=[], actual=[], low=[], base=[], high=[],
        projection_start=None, accounts=[],
        non_retirement=None, retirement=None,
        ignored_ids=ignored_ids,
    )


def load_account_series(db: Session, account_ids: list[int]):
    """Returns (series for each usable account, ids that were ignored)."""
    accounts = accounts_repository.db_get_accounts_by_ids(db, account_ids, INVESTED_CATEGORIES)
    found_ids = [a.id for a in accounts]

    balance_rows = balances_repository.db_get_monthly_balances_for_accounts(db, found_ids)
    contribution_rows = contributions_repository.db_get_monthly_contributions_for_accounts(db, found_ids)

    balances = {account_id: {} for account_id in found_ids}
    for account_id, month, cents in balance_rows:
        balances[account_id][month_index(month)] = cents

    contributions = {account_id: {} for account_id in found_ids}
    for account_id, month, cents in contribution_rows:
        contributions[account_id][month_index(month)] = cents

    series = [
        AccountSeries(a.id, a.name, get_invested_group(a.category), balances[a.id], contributions[a.id])
        for a in accounts
        if balances[a.id]
    ]

    used_ids = {s.id for s in series}
    ignored = list(dict.fromkeys(i for i in account_ids if i not in used_ids))

    return series, ignored


def get_growth_projection(db: Session, request: schemas.GrowthProjectionRequest) -> schemas.GrowthProjectionResponse:
    all_series, ignored_ids = load_account_series(db, request.account_ids)

    if not all_series:
        return empty_response(ignored_ids)

    start = max(s.last for s in all_series)           # projection start: the latest entry month
    months = request.years * 12
    end = start + months

    first_month = min(s.first for s in all_series)
    if request.history_from is not None:
        first_month = max(first_month, month_index(request.history_from))
    first_month = min(first_month, start)

    # --- rates (accounts with a zero balance only appear in the history, not the projection) ---
    live_series = [s for s in all_series if s.is_live]
    rates = resolve_rates(
        live_series, request.return_mode, request.manual_return_pct, request.history_window_months
    )

    # --- contributions, per group ---
    plans = {"non_retirement": request.non_retirement, "retirement": request.retirement}
    group_info = {}
    monthly_contributions = {}   # account_id -> contribution for each projected month, cents

    for group in GROUPS:
        group_series = [s for s in all_series if s.group == group]
        plan = plans[group]

        if not group_series:
            group_info[group] = None
            continue

        live = [s for s in group_series if s.is_live]
        trailing_avg = round(sum(trailing_deposits(s, start) for s in live) / TRAILING_CONTRIBUTION_MONTHS)

        steps = contribution_steps(plan, trailing_avg, start)
        shares = contribution_shares(plan, group_series, start)

        group_amounts = [amount_for_month(steps, start + t) for t in range(months)]
        for series in group_series:
            share = shares.get(series.id, 0.0)
            monthly_contributions[series.id] = [amount * share for amount in group_amounts]

        group_info[group] = schemas.GrowthContributionInfo(
            trailing_avg_cents=trailing_avg,
            applied_schedule=[
                schemas.AppliedContributionStep(from_month=month_label(m), monthly_cents=c) for m, c in steps
            ],
        )

    # --- history ---
    history_length = start - first_month + 1
    actual = [0] * history_length
    for series in all_series:
        for i, value in enumerate(carried_balances(series.balances, first_month, start)):
            actual[i] += value

    # --- projections: low / base / high ---
    inflation_factors = [
        (1 + request.inflation_pct / 100) ** (t / 12) if request.inflation else 1.0
        for t in range(months + 1)
    ]

    def scenario(rate_shift: float) -> list[int]:
        totals = [0.0] * (months + 1)
        for series in live_series:
            rate = rates[series.id][0] + rate_shift
            start_balance = carried_balances(series.balances, start, start)[0]
            values = project_account(start_balance, monthly_contributions[series.id], rate)
            for t, value in enumerate(values):
                totals[t] += value

        return [round(total / factor) for total, factor in zip(totals, inflation_factors)]

    low = scenario(-request.spread_pct)
    base = scenario(0.0)
    high = scenario(request.spread_pct)

    # --- shared timeline ---
    padding = [None] * (history_length - 1)
    tail = [None] * months

    return schemas.GrowthProjectionResponse(
        dates=[month_label(m) for m in range(first_month, end + 1)],
        actual=actual + tail,
        low=padding + low,
        base=padding + base,
        high=padding + high,
        projection_start=month_label(start),
        accounts=[
            schemas.GrowthAccountRate(
                id=s.id, name=s.name, group=s.group,
                rate_pct=round(rates[s.id][0], 2), source=rates[s.id][1], months_used=rates[s.id][2],
            )
            for s in live_series
        ],
        non_retirement=group_info["non_retirement"],
        retirement=group_info["retirement"],
        ignored_ids=ignored_ids,
    )
