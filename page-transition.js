(() => {
  "use strict";

  const customerPages = new Set([
    "home.html",
    "result.html",
    "login.html",
    "profile.html",
    "review.html",
    "contact.html",
    "booking-details.html",
    "booking-history.html",
    "payment.html",
    "verify-email.html",
  ]);

  const basePath = location.pathname.slice(
    0,
    location.pathname.lastIndexOf("/") + 1
  );

  function isCustomerPage(url) {
    return (
      url.origin === location.origin &&
      url.pathname.slice(
        0,
        url.pathname.lastIndexOf("/") + 1
      ) === basePath &&
      customerPages.has(
        url.pathname.split("/").pop()
      )
    );
  }

  // Run only on customer pages.
  if (!isCustomerPage(new URL(location.href))) return;
  if (window.RajaBusTransition) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  let overlay = null;
  let timer = null;
  let moving = false;

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "rb-page-transition";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="rb-wheel-travel">
        <div class="rb-transition-wheel"></div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function resetTransition() {
    window.clearTimeout(timer);
    timer = null;
    moving = false;

    overlay?.classList.remove("is-active");
  }

  function go(destination) {
    const url = new URL(destination, location.href);

    if (
      !isCustomerPage(url) ||
      reducedMotion.matches
    ) {
      location.assign(url.href);
      return;
    }

    if (moving) return;
    moving = true;

    createOverlay();
    overlay.classList.add("is-active");

    timer = window.setTimeout(() => {
      location.assign(url.href);
    }, 500);
  }

  window.RajaBusTransition = { go };

  // Animate customer page links.
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    if (!(event.target instanceof Element)) return;

    const link = event.target.closest("a[href]");

    if (
      !link ||
      link.hasAttribute("download") ||
      (
        link.target &&
        link.target.toLowerCase() !== "_self"
      ) ||
      link.hasAttribute("data-no-transition")
    ) return;

    const url = new URL(link.href, location.href);

    if (!isCustomerPage(url)) return;

    // Keep links to sections on the same page working.
    if (
      url.pathname === location.pathname &&
      url.search === location.search
    ) return;

    event.preventDefault();
    go(url.href);
  });

  // Animate normal GET forms, including bus Search.
  document.addEventListener("submit", (event) => {
    const form = event.target;

    if (
      event.defaultPrevented ||
      !(form instanceof HTMLFormElement) ||
      form.method.toLowerCase() !== "get" ||
      (
        form.target &&
        form.target.toLowerCase() !== "_self"
      )
    ) return;

    const button = event.submitter;

    if (
      button &&
      ["formaction", "formmethod", "formtarget"].some(
        (name) => button.hasAttribute(name)
      )
    ) return;

    const url = new URL(form.action, location.href);

    if (!isCustomerPage(url)) return;

    const fields = new FormData(form);

    url.search = "";

    for (const [name, value] of fields) {
      url.searchParams.append(
        name,
        typeof value === "string"
          ? value
          : value.name
      );
    }

    if (button?.name) {
      url.searchParams.append(
        button.name,
        button.value
      );
    }

    event.preventDefault();
    go(url.href);
  });

  // Reset when leaving or returning with browser Back.
  window.addEventListener(
    "pagehide",
    resetTransition
  );

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      resetTransition();
    }
  });
})();