
/* ============================================
   RAJABUS HOME PAGE
   BUS REVIEWS - INFINITE AUTO SCROLL
============================================ */

(() => {
  "use strict";

  const API =
    "http://localhost:5000/api/bus-reviews";

  const $ = (id) =>
    document.getElementById(id);

  function start() {

    const section = $("homeBusReviews");

    if (!section) return;

    const grid = $("homeBusReviewsGrid");
    const viewport = $("homeBusReviewsViewport");
    const track = $("homeBusReviewsTrack");

    const summary = $("homeBusReviewsSummary");
    const status = $("homeBusReviewsStatus");
    const more = $("loadMoreBusReviews");

    if (
      !grid ||
      !viewport ||
      !track ||
      !summary ||
      !status ||
      !more
    ) {
      console.error(
        "RAJABUS: Bus review HTML elements missing"
      );
      return;
    }

    // =========================================
    // STATE
    // =========================================

    const state = {
      reviews: new Map(),
      requestId: 0,
      controller: null
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    // =========================================
    // CREATE ELEMENT
    // =========================================

    function element(
      tag,
      className = "",
      content
    ) {

      const node = document.createElement(tag);

      if (className) {
        node.className = className;
      }

      if (content !== undefined) {
        node.textContent = String(content);
      }

      return node;
    }

    // =========================================
    // CREATE REVIEW CARD
    // =========================================

    function makeCard(review) {

      const card = element(
        "article",
        "hbr-card"
      );

      // CARD HEADER

      const top = element(
        "div",
        "hbr-card-top"
      );

      const registration = element(
        "span",
        "hbr-registration",
        review.busRegNo ||
        "Registration unavailable"
      );

      // STAR RATING

      const rating = Math.max(
        0,
        Math.min(
          5,
          Math.round(
            Number(review.rating) || 0
          )
        )
      );

      const stars = element(
        "span",
        "hbr-stars",
        "★".repeat(rating) +
        "☆".repeat(5 - rating)
      );

      stars.setAttribute(
        "role",
        "img"
      );

      stars.setAttribute(
        "aria-label",
        `${rating} out of 5 stars`
      );

      top.append(
        registration,
        stars
      );

      // BUS ROUTE

      const route = element(
        "h3",
        "hbr-route",
        `${review.from || "—"} → ${review.to || "—"}`
      );

      // PASSENGER REVIEW

      const reviewText = element(
        "p",
        "hbr-text",
        review.text || ""
      );

      // CARD FOOTER

      const footer = element(
        "div",
        "hbr-card-footer"
      );

      const author = element(
        "strong",
        "hbr-author",
        review.name || "Passenger"
      );

      footer.appendChild(author);

      // REVIEW DATE

      const date = new Date(
        review.createdAt
      );

      if (!Number.isNaN(date.getTime())) {

        const time = element(
          "time",
          "hbr-date",
          date.toLocaleDateString("en-GB", {
            timeZone: "Asia/Colombo",
            year: "numeric",
            month: "short",
            day: "2-digit"
          })
        );

        time.dateTime = date.toISOString();

        footer.appendChild(time);
      }

      card.append(
        top,
        route,
        reviewText,
        footer
      );

      return card;
    }

    // =========================================
    // SORT REVIEWS - LATEST FIRST
    // =========================================

    function sortedReviews() {

      return [...state.reviews.values()].sort(
        (a, b) => {

          const dateDifference =
            (Date.parse(b.createdAt) || 0) -
            (Date.parse(a.createdAt) || 0);

          if (dateDifference !== 0) {
            return dateDifference;
          }

          return String(b._id).localeCompare(
            String(a._id)
          );
        }
      );
    }

    // =========================================
    // RENDER INFINITE AUTO SCROLL
    // =========================================

    function renderCards() {

      // Stop current animation

      viewport.classList.remove(
        "hbr-ready"
      );

      // Remove previous duplicate row

      track.replaceChildren(grid);

      grid.replaceChildren();

      const reviews = sortedReviews();

      // NO REVIEWS

      if (!reviews.length) {

        grid.appendChild(
          element(
            "p",
            "hbr-empty",
            "No bus reviews available yet."
          )
        );

        return;
      }

      // ORIGINAL REVIEW CARDS

      reviews.forEach((review) => {

        const card = makeCard(review);

        grid.appendChild(card);
      });

      // Accessibility: no automatic animation
      // when reduced motion is requested.

      if (reducedMotion.matches) {
        return;
      }

      // =====================================
      // FILL SHORT REVIEW ROWS
      // =====================================

      const neededWidth =
        viewport.clientWidth + 30;

      let repeats = 0;

      while (
        grid.scrollWidth < neededWidth &&
        repeats < 32
      ) {

        reviews.forEach((review) => {

          const duplicate = makeCard(review);

          duplicate.setAttribute(
            "aria-hidden",
            "true"
          );

          grid.appendChild(duplicate);
        });

        repeats++;
      }

      // =====================================
      // CLONE COMPLETE ROW
      // =====================================

      const clonedGrid =
        grid.cloneNode(true);

      clonedGrid.removeAttribute(
        "id"
      );

      clonedGrid.classList.add(
        "hbr-copy"
      );

      clonedGrid.setAttribute(
        "aria-hidden",
        "true"
      );

      clonedGrid.inert = true;

      track.appendChild(clonedGrid);

      // =====================================
      // SET SCROLL SPEED
      // =====================================

      const distance =
        grid.getBoundingClientRect().width;

      if (distance > 0) {

        // Approximately 65px per second

        const duration =
          distance / 65;

        track.style.setProperty(
          "--hbr-duration",
          `${duration.toFixed(2)}s`
        );

        // Start scrolling

        viewport.classList.add(
          "hbr-ready"
        );
      }
    }

    // =========================================
    // RESPONSIVE RESIZE
    // =========================================

    let previousWidth = 0;
    let resizeFrame = 0;

    function handleResize() {

      const width = viewport.clientWidth;

      if (
        Math.abs(width - previousWidth) < 2
      ) {
        return;
      }

      previousWidth = width;

      cancelAnimationFrame(resizeFrame);

      resizeFrame = requestAnimationFrame(
        () => {

          if (state.reviews.size) {
            renderCards();
          }
        }
      );
    }

    if (
      typeof ResizeObserver === "function"
    ) {

      const observer = new ResizeObserver(
        handleResize
      );

      observer.observe(viewport);

    } else {

      window.addEventListener(
        "resize",
        handleResize
      );
    }

    // =========================================
    // REDUCED MOTION CHANGE
    // =========================================

    if (
      typeof reducedMotion.addEventListener ===
      "function"
    ) {

      reducedMotion.addEventListener(
        "change",
        renderCards
      );
    }

    // =========================================
    // FETCH ALL REVIEW PAGES
    // =========================================

    async function loadReviews() {

      // Cancel previous request

      if (state.controller) {
        state.controller.abort();
      }

      const requestId =
        ++state.requestId;

      const controller =
        new AbortController();

      state.controller = controller;

      state.reviews.clear();

      summary.textContent =
        "Loading reviews...";

      status.textContent =
        "Loading bus reviews...";

      more.disabled = true;
      more.hidden = true;

      renderCards();

      let page = 1;

      try {

        while (true) {

          // Timeout for each page request

          const timeout = setTimeout(
            () => controller.abort(),
            12000
          );

          let response;

          try {

            response = await fetch(
              `${API}?page=${page}&limit=50`,
              {
                cache: "no-store",
                signal: controller.signal
              }
            );

          } finally {

            clearTimeout(timeout);
          }

          const data = await response.json();

          // Ignore outdated requests

          if (
            requestId !== state.requestId
          ) {
            return;
          }

          // VALIDATE BACKEND RESPONSE

          if (
            !response.ok ||
            data.success !== true ||
            !Array.isArray(data.reviews) ||
            !data.pagination ||
            !data.stats
          ) {

            throw new Error(
              data.message ||
              "Invalid bus reviews API response"
            );
          }

          // =================================
          // SAVE REVIEWS WITHOUT DUPLICATES
          // =================================

          data.reviews.forEach((review) => {

            state.reviews.set(
              String(review._id),
              review
            );
          });

          // =================================
          // RATING SUMMARY
          // =================================

          const average =
            Number(data.stats.average);

          const total =
            Number(data.stats.total);

          summary.textContent =
            `${Number.isFinite(average) ? average.toFixed(1) : "0.0"} / 5 · ` +
            `${Number.isFinite(total) ? total : 0} reviews`;

          // =================================
          // NEXT API PAGE
          // =================================

          if (
            !data.pagination.hasMore
          ) {
            break;
          }

          page++;
        }

        // =====================================
        // ALL REVIEWS LOADED
        // =====================================

        renderCards();

        if (state.reviews.size) {

          status.textContent ="";

        } else {

          status.textContent =
            "No reviews yet.";
        }

      } catch (error) {

        if (
          requestId !== state.requestId
        ) {
          return;
        }

        console.error(
          "RAJABUS Review Error:",
          error
        );

        // Show already loaded reviews,
        // even if a later page failed.

        renderCards();

        status.textContent =
          "Could not load all reviews. Try again.";

        if (!state.reviews.size) {

          summary.textContent =
            "Bus reviews unavailable";
        }

        more.hidden = false;

        more.textContent =
          "Retry loading reviews";

      } finally {

        if (
          requestId === state.requestId
        ) {

          state.controller = null;

          more.disabled = false;
        }
      }
    }

    // =========================================
    // RETRY BUTTON
    // =========================================

    more.addEventListener(
      "click",
      () => {

        loadReviews();
      }
    );

    // =========================================
    // RESTORE WHEN BROWSER GOES BACK
    // =========================================

    window.addEventListener(
      "pageshow",
      (event) => {

        if (event.persisted) {
          loadReviews();
        }
      }
    );

    // =========================================
    // INITIAL LOAD
    // =========================================

    loadReviews();
  }

  // =========================================
  // DOCUMENT READY
  // =========================================

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );

  } else {

    start();
  }

})();
