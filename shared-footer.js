
"use strict";

// ==========================================
// RAJABUS - SHARED HOME PAGE FOOTER
// Review / Contact / Journey Pages
// ==========================================

(async function loadSharedFooter() {

  const footerContainer =
    document.getElementById(
      "rajabusSharedFooter"
    );

  if (
    !footerContainer ||
    footerContainer.dataset.loaded === "true"
  ) {
    return;
  }

  try {

    // Load footer directly from Home Page

    const response = await fetch(
      "home.html",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load Home Footer: ${response.status}`
      );
    }

    const html = await response.text();

    const homeDocument =
      new DOMParser().parseFromString(
        html,
        "text/html"
      );

    // Same footer sections used on Home Page

    const selectors = [
      ".site-footer",
      ".marquee-viewport",
      ".footer-bar"
    ];

    const sections = selectors.map(
      (selector) =>
        homeDocument.querySelector(selector)
    );

    if (sections.some((section) => !section)) {
      throw new Error(
        "Home Page Footer sections missing"
      );
    }

    const fragment =
      document.createDocumentFragment();

    sections.forEach((section) => {

      fragment.appendChild(
        document.importNode(
          section,
          true
        )
      );

    });

    footerContainer.replaceChildren(
      fragment
    );

    footerContainer.dataset.loaded = "true";

  } catch (error) {

    console.error(
      "RAJABUS Footer Error:",
      error
    );

  }

})();
