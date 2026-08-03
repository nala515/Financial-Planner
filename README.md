# Financial Planner

Finance Tracker is a personal finance web application for tracking net worth, account balances, and monthly contributions over time. It was built to be a centralized web application that can be accessed from any browser.

Unlike budgeting applications that focus on day-to-day spending, Finance Tracker is designed to monitor long-term financial progress. Accounts are organized into categories (such as Cash, Retirement, Investments, etc.), allowing balances to be filtered and summarized in different ways.

## Features

* View monthly historical balances and monthly totals
* Filter accounts by category (Net Worth, Spendable, Retirement, Invested, etc.)
* Record monthly contributions and income
* Import historical account data from CSV files

## Accessing the Application

The application is available online at:

* **Website:** `https://financial-planner-dzjg.onrender.com/`
* **Local Deployment:** `http://127.0.0.1:8000/`
* **API:** `http://127.0.0.1:8000/docs`

After opening the site, use the navigation bar to access the different sections:

* **Dashboard** – Overview of your finances.
* **Accounts** – View list of accounts with info and latest balances.
* **Balances** – View historical balances and monthly totals.
* **Contributions** – View historical contributions and monthly totals.
* **Summary** – View account growth and investment return.
* **Editor** – Edit account info, balances, or contributions.

Changes made through the website are saved directly to the database.

## Importing Historical Data

Historical account balances can be imported using the included importer script. 
All accounts require their own CSV file saved under `Financial-Planner/backend/utilities/importer/myAccounts`. 

The first three rows must be:
* Account name
* Account type (Cash, Investment, Retirement, 529)
* Shared: true/false

The remaining rows must be:
year, month (as integer), balance, contribution (optional)

To run the importer script:
```bash
python -m backend.utilities.importer.import_accounts
```

The importer will:

* Create the account if it does not already exist.
* Import each monthly balance into the database.
* If account already exists, update the records with the new data.

## Technology Stack

* **Backend:** Python, FastAPI, SQLAlchemy
* **Frontend:** HTML, CSS, JavaScript
* **Database:** SQLite

## Future Plans

Some planned enhancements include:

* Interactive charts and graphs
* Net worth projections
* Configurable account grouping and display options
* Google account authentication
* Automatic investment account synchronization
* Additional financial reports and analytics

## Repository setup

```bash
git clone git@github.com:nala515/Financial-Planner.git
cd Financial-Planner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
