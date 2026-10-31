(() => {
  "use strict";

  const API = "http://localhost:5000/api";

  const bookingId =
    new URLSearchParams(location.search)
      .get("bookingId") || "";

  const $ = (id) => document.getElementById(id);

  const state = {
    booking: null,
    review: null,
    reviews: new Map(),
    page: 0,
    hasMore: false,
    loading: false,
    requestId: 0,
    total: 0,
    filter: "all",
    sort: "new",
    saving: false,
    authBlocked: false,
    listError: "",
  };

  let form;
  let radios;
  let labels;
  let moreButton;
  let listNote;

  function token() {
    try {
      return localStorage.getItem("userToken") || "";
    } catch {
      return "";
    }
  }

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

  function note(text, error = false) {
    $("formNote").textContent = text;

    $("formNote").style.color =
      error ? "#c2412b" : "var(--muted)";
  }

  // ====================================================
  // API REQUEST
  // ====================================================

  async function request(path, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      10000
    );

    try {
      const headers = {};

      if (options.private) {
        headers.Authorization = "Bearer " + token();
      }

      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(API + path, {
        method: options.method || "GET",
        headers,

        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),

        cache: "no-store",
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const error = new Error(
          typeof data.message === "string"
            ? data.message
            : "Request failed"
        );

        error.status = response.status;
        throw error;
      }

      return data;

    } catch (error) {
      if (error.status) {
        throw error;
      }

      throw new Error(
        "Could not reach the backend. Please check your connection."
      );

    } finally {
      clearTimeout(timeout);
    }
  }

  function showContent(show) {
    [
      $("summaryPill"),
      document.querySelector(".summary"),
      $("formCard"),
      $("reviewsCard"),
    ].forEach((node) => {
      if (node) {
        node.hidden = !show;
      }
    });
  }

  function syncForm() {
    const disabled =
      !state.booking ||
      !!state.review ||
      state.saving ||
      !token() ||
      state.authBlocked;

    form
      .querySelectorAll("input, textarea, button")
      .forEach((node) => {
        node.disabled = disabled;
      });

    const submit = form.querySelector(
      'button[type="submit"]'
    );

    submit.textContent = state.saving
      ? "Saving…"
      : state.review
        ? "Review submitted"
        : "Submit Review";
  }

  // ====================================================
  // STAR SELECTION
  // ====================================================

  function fillStars(value) {
    labels.forEach((label, index) => {
      label.classList.toggle(
        "active",
        index < value
      );
    });

    $("rateLive").textContent = value
      ? value + " ★ selected"
      : "Select rating";
  }

  function selectedRating() {
    return Number(
      radios.find((radio) => radio.checked)?.value || 0
    );
  }

  function applyOwnReview(review) {
    state.review = review || null;

    if (review) {
      form.elements.namedItem("text").value =
        review.text || "";

      radios.forEach((radio) => {
        radio.checked =
          Number(radio.value) === review.rating;
      });

      fillStars(review.rating);

      $("cc").textContent =
        (review.text || "").length;

      note(
        "Thank you! You have already reviewed this booking."
      );

    } else {
      note("* Required fields");
    }

    syncForm();
  }

  // ====================================================
  // LOAD THE BOOKING AND ITS BUS
  // ====================================================

  async function loadContext() {
    const data = await request(
      "/bus-reviews/booking/" +
        encodeURIComponent(bookingId),
      {
        private: true,
      }
    );

    state.booking = data.booking;
    state.authBlocked = false;

    $("busRegNo").textContent =
      data.booking.busRegNo || "Not available";

    $("busRoute").textContent =
      (data.booking.from || "—") +
      " → " +
      (data.booking.to || "—");

    $("busBookingInfo").textContent =
      "Ticket " +
      (data.booking.ticketId || "—") +
      " · Journey " +
      (data.booking.journeyDate || "—");

    $("busReviewStatus").textContent =
      "Your review is linked to this booking.";

    $("busReviewLogin").hidden = true;

    applyOwnReview(data.review);
    showContent(true);
  }

  // ====================================================
  // RATING SUMMARY
  // ====================================================

  function starIcons(value) {
    const rating = Math.max(
      0,
      Math.min(
        5,
        Math.round(Number(value) || 0)
      )
    );

    return Array.from(
      { length: 5 },
      (_, index) =>
        '<svg viewBox="0 0 20 20" class="' +
        (index < rating ? "on" : "") +
        '" aria-hidden="true">' +
        '<path d="M10 .9l2.6 5.3 5.9.9-4.3 4.2 1 5.8L10 14.9 4.8 17l1-5.8L1.5 7.1l5.9-.9L10 .9z"/>' +
        "</svg>"
    ).join("");
  }

  function renderStats(stats) {
    const total = Number(stats.total) || 0;
    const average = Number(stats.average) || 0;

    const buckets =
      stats.buckets || [0, 0, 0, 0, 0];

    state.total = total;

    $("bigScore").textContent =
      average.toFixed(1);

    $("avgScore").textContent =
      average.toFixed(1);

    $("totalCount").textContent = total;

    $("bigStars").innerHTML =
      starIcons(average);

    $("avgStars").innerHTML =
      starIcons(average);

    $("distBars").replaceChildren();

    for (let rating = 5; rating >= 1; rating--) {
      const percent = total
        ? Math.round(
            (Number(buckets[rating - 1]) || 0) *
              100 /
              total
          )
        : 0;

      const row = element("div", "bar-row");
      const bar = element("div", "bar");
      const fill = element("span");

      fill.style.width = percent + "%";

      bar.setAttribute(
        "aria-label",
        rating + " stars: " + percent + "%"
      );

      bar.append(fill);

      row.append(
        element("span", "", rating + "★"),
        bar,
        element("span", "", percent + "%")
      );

      $("distBars").append(row);
    }
  }

  // ====================================================
  // REVIEW CARDS
  // ====================================================

  function renderList() {
    let reviews = [...state.reviews.values()];

    if (state.filter !== "all") {
      reviews = reviews.filter(
        (review) =>
          review.rating === Number(state.filter)
      );
    }

    reviews.sort((a, b) => {
      if (
        state.sort === "high" &&
        a.rating !== b.rating
      ) {
        return b.rating - a.rating;
      }

      if (
        state.sort === "low" &&
        a.rating !== b.rating
      ) {
        return a.rating - b.rating;
      }

      return (
        new Date(b.createdAt) -
          new Date(a.createdAt) ||
        String(b._id).localeCompare(
          String(a._id)
        )
      );
    });

    $("reviewsList").replaceChildren();

    $("empty").hidden = reviews.length > 0;

    $("empty").style.display =
      reviews.length ? "none" : "block";

    $("empty").textContent = state.hasMore
      ? "No matching reviews in the loaded results. Load more below."
      : "No matching reviews yet.";

    reviews.forEach((review) => {
      const card = element(
        "article",
        "review"
      );

      const meta = element("div", "meta");

      const name = element(
        "div",
        "name",
        review.name || "Anonymous"
      );

      const date = new Date(
        review.createdAt
      ).toLocaleDateString("en-GB", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "short",
        day: "2-digit",
      });

      name.append(
        element("span", "badge", date)
      );

      const stars = element("div", "stars");

      stars.innerHTML =
        starIcons(review.rating);

      meta.append(name, stars);

      card.append(
        meta,

        element(
          "div",
          "bus-review-reg",
          "Registration: " +
            (review.busRegNo || "Not available")
        ),

        element(
          "div",
          "muted",
          (review.from || "—") +
            " → " +
            (review.to || "—")
        ),

        element(
          "div",
          "muted",
          review.rating +
            "★" +
            (review.place
              ? " · " + review.place
              : "")
        ),

        element(
          "p",
          "body",
          review.text
        )
      );

      $("reviewsList").append(card);
    });

    listNote.textContent =
      "Loaded " +
      state.reviews.size +
      " of " +
      state.total +
      " reviews for this bus. Filters apply to loaded reviews.";

    moreButton.hidden = !state.hasMore;
    moreButton.disabled = state.loading;

    moreButton.textContent = state.loading
      ? "Loading…"
      : "Load more reviews";

    if (state.listError) {
      listNote.textContent = state.listError;
      moreButton.hidden = false;

      moreButton.textContent =
        "Retry loading reviews";
    }
  }

  // ====================================================
  // LOAD THIS BUS'S REVIEWS
  // ====================================================

  async function loadReviews(reset = false) {
    if (
      !state.booking ||
      (!reset && state.loading)
    ) {
      return;
    }

    const requestId = ++state.requestId;

    if (reset) {
      state.page = 0;
      state.reviews.clear();
      state.hasMore = false;
    }

    state.loading = true;
    state.listError = "";

    moreButton.disabled = true;

    listNote.textContent =
      "Loading bus reviews…";

    try {
      const page = state.page + 1;

      const data = await request(
        "/bus-reviews?busId=" +
          encodeURIComponent(
            state.booking.busId
          ) +
          "&page=" +
          page +
          "&limit=12"
      );

      if (requestId !== state.requestId) {
        return;
      }

      if (!Array.isArray(data.reviews)) {
        throw new Error(
          "Invalid reviews response"
        );
      }

      state.page = page;

      state.hasMore =
        !!data.pagination.hasMore;

      data.reviews.forEach((review) => {
        state.reviews.set(
          String(review._id),
          review
        );
      });

      renderStats(data.stats);
      renderList();

    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }

      state.listError = error.message;
      listNote.textContent = error.message;

      moreButton.hidden = false;

      moreButton.textContent =
        "Retry loading reviews";

    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        moreButton.disabled = false;
      }
    }
  }

  // ====================================================
  // STAR EVENTS
  // ====================================================

  function bindStars() {
    const rateBox = $("rateBox");

    radios = [
      ...rateBox.querySelectorAll(
        'input[name="rating"]'
      ),
    ];

    labels = [
      ...rateBox.querySelectorAll("label"),
    ];

    radios.forEach((radio) => {
      radio.setAttribute(
        "aria-label",
        radio.value + " stars"
      );

      radio.addEventListener(
        "change",
        () => fillStars(selectedRating())
      );
    });

    labels.forEach((label, index) => {
      label.addEventListener(
        "mouseenter",
        () => {
          if (!radios[index].disabled) {
            fillStars(index + 1);
          }
        }
      );

      label.addEventListener(
        "click",
        () => {
          if (radios[index].disabled) return;

          radios[index].checked = true;
          fillStars(index + 1);
        }
      );
    });

    rateBox.addEventListener(
      "mouseleave",
      () => fillStars(selectedRating())
    );

    fillStars(0);
  }

  // ====================================================
  // SUBMIT REVIEW
  // ====================================================

  function bindForm() {
    const textInput =
      form.elements.namedItem("text");
    textInput.maxLength = 600;

    textInput.addEventListener(
      "input",
      () => {
        $("cc").textContent =
          textInput.value.length;
      }
    );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (
          !state.booking ||
          state.review ||
          state.saving
        ) {
          return;
        }

        if (!token()) {
          $("busReviewLogin").hidden = false;

          note(
            "Please log in again before submitting.",
            true
          );

          syncForm();
          return;
        }

        // Read values before disabling the form.
        const payload = {
          rating: selectedRating(),
          text: textInput.value.trim(),
        };

        if (
          !payload.rating ||
          payload.text.length < 4 ||
          payload.text.length > 600
        ) {
          note(
            "Select a rating and write 4 to 600 characters.",
            true
          );

          return;
        }

        state.saving = true;
        syncForm();

        note("Saving your review…");

        try {
          const data = await request(
            "/bus-reviews/booking/" +
              encodeURIComponent(bookingId),
            {
              method: "POST",
              private: true,
              body: payload,
            }
          );

          applyOwnReview(data.review);

          note(
            "Thank you! Your bus review has been saved."
          );

          await loadReviews(true);

        } catch (error) {
          if (error.status === 409) {
            try {
              await loadContext();
              await loadReviews(true);

            } catch (reloadError) {
              note(
                reloadError.message,
                true
              );
            }

          } else {
            note(
              error.status
                ? error.message
                : "Submission was not confirmed. Reopen this review page to check before retrying.",
              true
            );

            if (
              error.status === 401 ||
              error.status === 403
            ) {
              state.authBlocked = true;

              $("busReviewLogin").hidden =
                false;
            }
          }

        } finally {
          state.saving = false;
          syncForm();
        }
      }
    );
  }

  // ====================================================
  // NAVBAR / MOBILE MENU
  // ====================================================

  function bindChrome() {
    const body = document.body;
    const menu = $("mobileNav");
    const backdrop = $("backdrop");

    function closeMenu() {
      body.classList.remove("menu-open");

      menu?.setAttribute(
        "aria-hidden",
        "true"
      );

      $("menuBtn")?.setAttribute(
        "aria-expanded",
        "false"
      );

      if (backdrop) {
        backdrop.hidden = true;
      }
    }

    $("menuBtn")?.addEventListener(
      "click",
      () => {
        body.classList.add("menu-open");

        menu?.setAttribute(
          "aria-hidden",
          "false"
        );

        $("menuBtn").setAttribute(
          "aria-expanded",
          "true"
        );

        if (backdrop) {
          backdrop.hidden = false;
        }
      }
    );

    $("closeMenu")?.addEventListener(
      "click",
      closeMenu
    );

    backdrop?.addEventListener(
      "click",
      closeMenu
    );

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      }
    );

    window.addEventListener(
      "scroll",
      () => {
        document
          .querySelector(".navbar")
          ?.classList.toggle(
            "is-sticky",
            window.scrollY > 0
          );

        if ($("scrollTopBtn")) {
          $("scrollTopBtn").style.display =
            window.scrollY > 200
              ? "block"
              : "none";
        }
      }
    );

    $("scrollTopBtn")?.addEventListener(
      "click",
      () => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    );
  }

  // ====================================================
  // START
  // ====================================================

  async function init() {
    document.body.classList.add(
      "bus-review-page"
    );

    document.title =
      "Bus Review | RAJA BUS";

    form = $("reviewForm");

    $("formNote").setAttribute(
      "role",
      "status"
    );

    bindStars();
    bindForm();
    bindChrome();

    showContent(false);
    syncForm();

    listNote = element("p", "muted");

    listNote.setAttribute(
      "role",
      "status"
    );

    moreButton = element(
      "button",
      "btn",
      "Load more reviews"
    );

    moreButton.type = "button";
    moreButton.hidden = true;

    $("reviewsCard").append(
      listNote,
      moreButton
    );

    moreButton.addEventListener(
      "click",
      () => void loadReviews()
    );

    $("sortSel").addEventListener(
      "change",
      (event) => {
        state.sort = event.target.value;
        renderList();
      }
    );

    document
      .querySelectorAll(".chip-btn")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(".chip-btn")
              .forEach((item) =>
                item.classList.remove("active")
              );

            button.classList.add("active");

            state.filter =
              button.dataset.filter;

            renderList();
          }
        );
      });

    $("avgScore").textContent = "—";
    $("bigScore").textContent = "—";
    $("totalCount").textContent = "—";

    if (
      !/^[a-f\d]{24}$/i.test(bookingId)
    ) {
      $("busReviewStatus").textContent =
        "Open this page using a Review button in Journey.";

      return;
    }

    if (!token()) {
      $("busReviewStatus").textContent =
        "Please log in to review your booking.";

      $("busReviewLogin").hidden = false;

      return;
    }

    try {
      await loadContext();
      await loadReviews(true);

    } catch (error) {
      $("busReviewStatus").textContent =
        error.message;

      if (
        error.status === 401 ||
        error.status === 403
      ) {
        $("busReviewLogin").hidden = false;
      }
    }
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => void init(),
      { once: true }
    );

  } else {
    void init();
  }
})();