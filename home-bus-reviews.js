(() => {
  "use strict";

  const API =
    "http://localhost:5000/api/bus-reviews";

  const $ = (id) =>
    document.getElementById(id);

  function start() {
    if (!$("homeBusReviews")) return;

    const grid = $("homeBusReviewsGrid");
    const summary = $("homeBusReviewsSummary");
    const status = $("homeBusReviewsStatus");
    const more = $("loadMoreBusReviews");

    const state = {
      page: 0,
      reviews: new Map(),
      loading: false,
      requestId: 0,
    };

    function element(tag, className, text) {
      const node = document.createElement(tag);

      if (className) {
        node.className = className;
      }

      if (text !== undefined) {
        node.textContent = text;
      }

      return node;
    }

    // ==================================================
    // CREATE ONE REVIEW CARD
    // ==================================================

    function makeCard(review) {
      const card = element(
        "article",
        "hbr-card"
      );

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

      const rating = Math.max(
        0,
        Math.min(
          5,
          Math.round(Number(review.rating) || 0)
        )
      );

      const stars = element(
        "span",
        "hbr-stars",
        "★".repeat(rating) +
          "☆".repeat(5 - rating)
      );

      stars.setAttribute("role", "img");

      stars.setAttribute(
        "aria-label",
        rating + " out of 5 stars"
      );

      top.append(registration, stars);

      const route = element(
        "h3",
        "hbr-route",
        (review.from || "—") +
          " → " +
          (review.to || "—")
      );

      const text = element(
        "p",
        "hbr-text",
        review.text || ""
      );

      const footer = element(
        "div",
        "hbr-card-footer"
      );

      footer.append(
        element(
          "strong",
          "hbr-author",
          review.name || "Passenger"
        )
      );

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
            day: "2-digit",
          })
        );

        time.dateTime = date.toISOString();
        footer.append(time);
      }

      card.append(
        top,
        route,
        text,
        footer
      );

      return card;
    }

    // ==================================================
    // DISPLAY LOADED REVIEWS
    // ==================================================

    function renderCards() {
      grid.replaceChildren();

      const reviews = [
        ...state.reviews.values(),
      ].sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) -
            (Date.parse(a.createdAt) || 0) ||
          String(b._id).localeCompare(
            String(a._id)
          )
      );

      if (!reviews.length) {
        grid.append(
          element(
            "p",
            "hbr-empty",
            "No bus reviews yet. Reviews from booked journeys will appear here."
          )
        );

        return;
      }

      reviews.forEach((review) => {
        grid.append(makeCard(review));
      });
    }

    // ==================================================
    // LOAD REVIEWS FROM BACKEND
    // ==================================================

    async function loadReviews(reset = false) {
      if (
        state.loading &&
        !reset
      ) {
        return;
      }

      const requestId =
        ++state.requestId;

      if (reset) {
        state.page = 0;
        state.reviews.clear();

        grid.replaceChildren();

        summary.textContent =
          "Loading reviews…";
      }

      state.loading = true;
      more.disabled = true;

      status.textContent =
        "Loading bus reviews…";

      const controller =
        new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        10000
      );

      try {
        const nextPage =
          state.page + 1;

        const response = await fetch(
          API +
            "?page=" +
            nextPage +
            "&limit=6",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data =
          await response.json();

        if (
          requestId !== state.requestId
        ) {
          return;
        }

        const total =
          Number(data.stats?.total);

        const average =
          Number(data.stats?.average);

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.reviews) ||
          !data.pagination ||
          !Number.isFinite(total) ||
          !Number.isFinite(average)
        ) {
          throw new Error(
            "Invalid reviews response"
          );
        }

        state.page = nextPage;

        data.reviews.forEach((review) => {
          state.reviews.set(
            String(review._id),
            review
          );
        });

        renderCards();

        summary.textContent =
          average.toFixed(1) +
          " / 5 · " +
          total +
          (
            total === 1
              ? " review"
              : " reviews"
          );

        status.textContent = total
          ? "Showing " +
            state.reviews.size +
            " of " +
            total +
            " reviews"
          : "";

        more.hidden =
          !data.pagination.hasMore;

        more.textContent =
          "Load more reviews";

      } catch (error) {
        if (
          requestId !== state.requestId
        ) {
          return;
        }

        status.textContent =
          "Could not load bus reviews. Check your connection and try again.";

        if (!state.reviews.size) {
          summary.textContent =
            "Bus reviews unavailable";
        }

        more.hidden = false;
        more.textContent = "Retry";

      } finally {
        clearTimeout(timeout);

        if (
          requestId === state.requestId
        ) {
          state.loading = false;
          more.disabled = false;
        }
      }
    }

    more.addEventListener(
      "click",
      () => {
        void loadReviews();
      }
    );

    // Refresh when returning with the browser Back button.
    window.addEventListener(
      "pageshow",
      (event) => {
        if (event.persisted) {
          void loadReviews(true);
        }
      }
    );

    void loadReviews(true);
  }

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