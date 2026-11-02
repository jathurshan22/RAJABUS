
/* ============================================
   RAJABUS - REVIEWS PAGE V2
   WEBSITE REVIEWS + BUS REVIEWS
   STEP 04 - JavaScript Integration
============================================ */

(() => {
  "use strict";

  const API_BASE = "http://localhost:5000/api";

  const PAGE_SIZE = 50;
  const VISIBLE_STEP = 6;

  const $ = (id) => document.getElementById(id);

  function init() {

    // ========================================
    // HTML ELEMENTS
    // ========================================

    const websiteTab = $("websiteReviewsTab");
    const busTab = $("busReviewsTab");

    const websitePanel = $("websiteReviewsPanel");
    const busPanel = $("busReviewsPanel");

    const list = $("busReviewsList");
    const empty = $("busReviewsEmpty");
    const loadMore = $("busReviewsLoadMore");

    const busFilter = $("busReviewBusFilter");
    const routeFilter = $("busReviewRouteFilter");
    const sortFilter = $("busReviewSort");

    if (
      [
        websiteTab,
        busTab,
        websitePanel,
        busPanel,
        list,
        empty,
        loadMore,
        busFilter,
        routeFilter,
        sortFilter
      ].some((el) => !el)
    ) {
      console.error(
        "Reviews V2: Required HTML IDs not found."
      );
      return;
    }

    // ========================================
    // STATE
    // ========================================

    const state = {
      busReviews: [],
      stats: {
        total: 0,
        average: 0,
        buckets: [0, 0, 0, 0, 0]
      },
      visible: VISIBLE_STEP,
      loaded: false,
      loading: false,
      failed: false
    };

    // ========================================
    // SAFE DOM ELEMENT
    // ========================================

    function node(
      tag,
      className = "",
      content
    ) {
      const el = document.createElement(tag);

      if (className) {
        el.className = className;
      }

      if (content !== undefined) {
        el.textContent = String(content);
      }

      return el;
    }

    function setText(id, value) {
      const el = $(id);

      if (el) {
        el.textContent = String(value);
      }
    }

    
    const filterInfo = node("p", "rv-filter-info");

    filterInfo.id = "busReviewFilterInfo";

    list.before(filterInfo);


    // ========================================
    // WEBSITE REVIEW STATISTICS
    //
    // Original review.js handles website
    // reviews and updates these IDs:
    //
    // avgScore
    // totalCount
    //
    // Keep review.js unchanged.
    // ========================================

    function websiteSummary() {

      const avg =
        $("avgScore")?.textContent?.trim() || "—";

      const total =
        $("totalCount")?.textContent?.trim() || "0";

      setText("websiteReviewAvg", avg);
      setText("websiteReviewTotal", total);
    }

    websiteSummary();

    // Automatically update website summary
    // when a new website review is submitted.

    [
      $("avgScore"),
      $("totalCount")
    ]
      .filter(Boolean)
      .forEach((element) => {

        new MutationObserver(
          websiteSummary
        ).observe(element, {
          childList: true,
          characterData: true,
          subtree: true
        });
      });

    // ========================================
    // WEBSITE / BUS REVIEW TABS
    // ========================================

    function switchTab(which) {

      const bus = which === "bus";

      websitePanel.hidden = bus;
      busPanel.hidden = !bus;

      websiteTab.classList.toggle(
        "active",
        !bus
      );

      busTab.classList.toggle(
        "active",
        bus
      );

      websiteTab.setAttribute(
        "aria-selected",
        String(!bus)
      );

      busTab.setAttribute(
        "aria-selected",
        String(bus)
      );

      websiteTab.tabIndex = bus ? -1 : 0;
      busTab.tabIndex = bus ? 0 : -1;

      if (
        bus &&
        !state.loaded &&
        !state.loading
      ) {
        loadBusReviews();
      }
    }

    websiteTab.addEventListener(
      "click",
      () => switchTab("website")
    );

    busTab.addEventListener(
      "click",
      () => switchTab("bus")
    );

    // Keyboard accessibility

    [websiteTab, busTab].forEach((tab) => {

      tab.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight"
          ) {
            return;
          }

          event.preventDefault();

          const toBus = tab === websiteTab;

          switchTab(
            toBus ? "bus" : "website"
          );

          (
            toBus ? busTab : websiteTab
          ).focus();
        }
      );
    });

    // ========================================
    // BUS ID / ROUTE HELPERS
    // ========================================

    function busId(review) {
      return String(
        review.busId || ""
      );
    }

    
    function routeKey(review) {
    const from = String(review.from || "")
        .trim()
        .replace(/\s+/g, " ");

    const to = String(review.to || "")
        .trim()
        .replace(/\s+/g, " ");

    return `${from || "Unknown Origin"} → ${to || "Unknown Destination"}`;
    }

    // ========================================
    // STAR RATING
    // ========================================

    function starRating(value) {

      const rating = Math.max(
        0,
        Math.min(
          5,
          Math.round(Number(value) || 0)
        )
      );

      const el = node(
        "span",
        "rv-review-stars",
        "★".repeat(rating) +
        "☆".repeat(5 - rating)
      );

      el.setAttribute("role", "img");

      el.setAttribute(
        "aria-label",
        `${rating} out of 5 stars`
      );

      return el;
    }

    // ========================================
    // REVIEW DATE
    // ========================================

    function dateText(value) {

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return new Intl.DateTimeFormat(
        "en-GB",
        {
          year: "numeric",
          month: "short",
          day: "2-digit",
          timeZone: "Asia/Colombo"
        }
      ).format(date);
    }

    // ========================================
    // BUS REVIEW STATISTICS
    // ========================================

    function renderSummary() {

      const {
        total,
        average,
        buckets
      } = state.stats;

      const rating =
        Number.isFinite(Number(average))
          ? Number(average).toFixed(1)
          : "0.0";

      setText("busReviewAvg", rating);
      setText("busReviewTotal", total);

      setText("busReviewBigScore", rating);

      setText(
        "busReviewSummaryTotal",
        total
      );

      // =====================================
      // STAR RATING BREAKDOWN
      // =====================================

      const dist = $("busReviewDistBars");

      if (!dist) {
        return;
      }

      dist.replaceChildren();

      for (
        let stars = 5;
        stars >= 1;
        stars--
      ) {

        const amount =
          Number(buckets[stars - 1]) || 0;

        const percent = total
          ? Math.round(
              (amount / total) * 100
            )
          : 0;

        const row = node(
          "div",
          "rv-star-row"
        );

        const label = node(
          "span",
          "",
          `${stars} ★`
        );

        const track = node(
          "div",
          "rv-star-track"
        );

        const fill = node(
          "div",
          "rv-star-fill"
        );

        fill.style.width =
          `${percent}%`;

        track.appendChild(fill);

        row.append(
          label,
          track,
          node("span", "", amount)
        );

        dist.appendChild(row);
      }
    }

    // ========================================
    // CREATE SELECT OPTIONS
    // ========================================

    function setSelectItems(
      select,
      values,
      firstLabel
    ) {

      select.replaceChildren();

      select.appendChild(
        new Option(firstLabel, "all")
      );

      values.forEach(({ key, label }) => {

        select.appendChild(
          new Option(label, key)
        );
      });
    }

    // ========================================
    // BUS + ROUTE FILTER OPTIONS
    // ========================================

    function fillFilters() {

      const buses = new Map();
      const routes = new Set();

      state.busReviews.forEach((review) => {

        const id = busId(review);

        if (id) {

          const label = String(
            review.busRegNo ||
            review.busNo ||
            id
          );

          if (!buses.has(id)) {
            buses.set(id, label);
          }
        }

        routes.add(
          routeKey(review)
        );
      });

      // Bus dropdown

      setSelectItems(
        busFilter,

        [...buses.entries()]
          .sort(
            (a, b) =>
              a[1].localeCompare(b[1])
          )
          .map(([key, label]) => ({
            key,
            label
          })),

        "All Buses"
      );

      // Route dropdown

      setSelectItems(
        routeFilter,

        [...routes]
          .sort()
          .map((key) => ({
            key,
            label: key
          })),

        "All Routes"
      );
    }

    // ========================================
    // FILTER AND SORT BUS REVIEWS
    // ========================================

    function selectedReviews() {

      let data = state.busReviews.filter(
        (review) => {

          if (
            busFilter.value !== "all" &&
            busId(review) !== busFilter.value
          ) {
            return false;
          }

          if (
            routeFilter.value !== "all" &&
            routeKey(review) !==
              routeFilter.value
          ) {
            return false;
          }

          return true;
        }
      );

      data = [...data].sort((a, b) => {

        const latest =
          (Date.parse(b.createdAt) || 0) -
          (Date.parse(a.createdAt) || 0);

        if (sortFilter.value === "high") {
          return (
            Number(b.rating) -
            Number(a.rating) ||
            latest
          );
        }

        if (sortFilter.value === "low") {
          return (
            Number(a.rating) -
            Number(b.rating) ||
            latest
          );
        }

        return latest;
      });

      return data;
    }

    // ========================================
    // CREATE BUS REVIEW CARD
    // ========================================

    function reviewCard(review) {

      const card = node(
        "article",
        "rv-bus-review-card"
      );

      // Registration + stars

      const top = node(
        "div",
        "rv-review-top"
      );

      top.append(

        node(
          "span",
          "rv-bus-reg",
          review.busRegNo ||
          review.busNo ||
          "Registration unavailable"
        ),

        starRating(review.rating)
      );

      // Route

      const route = node(
        "h3",
        "rv-review-route",
        routeKey(review)
      );

      // Review text

      const content = node(
        "p",
        "rv-review-text",
        review.text || ""
      );

      // Author + date

      const foot = node(
        "div",
        "rv-review-footer"
      );

      foot.append(

        node(
          "strong",
          "",
          review.name || "Passenger"
        ),

        node(
          "time",
          "",
          dateText(review.createdAt)
        )
      );

      card.append(
        top,
        route,
        content,
        foot
      );

      return card;
    }

    // ========================================
    // RENDER BUS REVIEWS
    // ========================================

    function renderList() {

      const reviews = selectedReviews();

      
        const selectedRoute =
        routeFilter.options[routeFilter.selectedIndex]
            ?.textContent || "All Routes";

        filterInfo.textContent = state.loading
        ? "Loading bus reviews..."
        : routeFilter.value === "all"
            ? `Showing ${reviews.length} bus reviews · All Routes`
            : `Showing ${reviews.length} bus reviews · ${selectedRoute}`;


      list.replaceChildren();

      // Loading state

      if (state.loading) {

        empty.textContent =
          "Loading bus reviews...";

        empty.hidden = false;
        loadMore.hidden = true;

        return;
      }

      // Display reviews in batches

      const displayed = reviews.slice(
        0,
        state.visible
      );

      displayed.forEach((review) => {

        list.appendChild(
          reviewCard(review)
        );
      });

      empty.hidden =
        displayed.length > 0;

      if (!displayed.length) {

        empty.textContent =
          state.failed
            ? "Could not load bus reviews. Please try again."
            : "No bus reviews match the selected filters.";
      }

      // Load More button

      loadMore.hidden = state.failed
        ? false
        : displayed.length >= reviews.length;

      loadMore.textContent = state.failed
        ? "Retry loading reviews"
        : `Load More Reviews (${reviews.length - displayed.length} remaining)`;
    }

    // ========================================
    // FETCH ALL BUS REVIEWS FROM MONGODB
    // ========================================

    async function loadBusReviews() {

      if (state.loading) {
        return;
      }

      state.loading = true;
      state.failed = false;

      renderList();

      try {

        const all = new Map();

        let page = 1;
        let stats = null;

        while (true) {

          const response = await fetch(
            `${API_BASE}/bus-reviews?page=${page}&limit=${PAGE_SIZE}`,
            {
              cache: "no-store"
            }
          );

          const data =
            await response.json();

          if (
            !response.ok ||
            data.success !== true ||
            !Array.isArray(data.reviews) ||
            !data.pagination ||
            !data.stats
          ) {

            throw new Error(
              data.message ||
              "Invalid bus reviews response"
            );
          }

          if (!stats) {
            stats = data.stats;
          }

          // Avoid duplicate reviews

          data.reviews.forEach((review) => {

            all.set(
              String(review._id),
              review
            );
          });

          if (!data.pagination.hasMore) {
            break;
          }

          page += 1;
        }

        // Store bus reviews separately

        state.busReviews = [
          ...all.values()
        ];

        state.stats = {

          total:
            Number(stats?.total) || 0,

          average:
            Number(stats?.average) || 0,

          buckets:
            Array.isArray(stats?.buckets)
              ? stats.buckets
              : [0, 0, 0, 0, 0]
        };

        state.loaded = true;
        state.visible = VISIBLE_STEP;

        renderSummary();
        fillFilters();

      } catch (error) {

        state.failed = true;

        console.error(
          "RAJABUS Bus Reviews Error:",
          error
        );

      } finally {

        state.loading = false;

        renderList();
      }
    }

    // ========================================
    // BUS REVIEW FILTER EVENTS
    // ========================================

    [
      busFilter,
      routeFilter,
      sortFilter
    ].forEach((select) => {

      select.addEventListener(
        "change",
        () => {

          state.visible = VISIBLE_STEP;

          renderList();
        }
      );
    });

    // ========================================
    // LOAD MORE / RETRY
    // ========================================

    loadMore.addEventListener(
      "click",
      () => {

        if (state.failed) {
          loadBusReviews();
          return;
        }

        state.visible += VISIBLE_STEP;

        renderList();
      }
    );

    // ========================================
    // INITIAL LOAD
    // ========================================

    renderSummary();

    const initialTab =
      location.hash === "#bus-reviews"
        ? "bus"
        : "website";

    switchTab(initialTab);

    // Populate both overview counters
    // when the page opens.

    if (
      !state.loading &&
      !state.loaded
    ) {
      loadBusReviews();
    }
  }

  // ========================================
  // DOCUMENT READY
  // ========================================

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();
  }

})();
