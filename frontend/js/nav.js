
async function loadNav() {
  const container = document.getElementById("nav-container");
  const html = await fetch("/static/nav.html").then(r => r.text());
  container.innerHTML = html;
  initNav();
}

function initNav() {
  const nav = document.querySelector(".site-nav");

  // Mobile hamburger toggle
  const navToggle = nav.querySelector(".nav-toggle");
  const navMenu = nav.querySelector(".nav-menu");
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("nav-menu--open");
    navToggle.setAttribute("aria-expanded", isOpen);
  });

  // Dropdown group toggles (tap-based, works without hover)
  const groupToggles = nav.querySelectorAll(".nav-group-toggle");
  groupToggles.forEach(toggle => {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = toggle.closest(".nav-group");
      const isOpen = group.classList.contains("nav-group--open");

      // Close any other open dropdowns first
      nav.querySelectorAll(".nav-group--open").forEach(g => {
        g.classList.remove("nav-group--open");
        g.querySelector(".nav-group-toggle").setAttribute("aria-expanded", "false");
      });

      if (!isOpen) {
        group.classList.add("nav-group--open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
  });

  // Close open dropdowns when tapping/clicking outside the nav
  document.addEventListener("click", () => {
    nav.querySelectorAll(".nav-group--open").forEach(g => {
      g.classList.remove("nav-group--open");
      g.querySelector(".nav-group-toggle").setAttribute("aria-expanded", "false");
    });
  });

  // Highlight the current page
  const currentPage = document.body.dataset.page;
  if (currentPage) {
    const activeLink = nav.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
      activeLink.classList.add("nav-link--active");
      const parentGroup = activeLink.closest(".nav-group");
      if (parentGroup) {
        parentGroup.querySelector(".nav-group-toggle").classList.add("nav-group-toggle--active");
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", loadNav);
