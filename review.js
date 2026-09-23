const API_BASE = "http://localhost:5000/api";

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];

const state = { reviews: [], stats: { total: 0, average: 0, buckets: [0, 0, 0, 0, 0] }, filter: "all", sort: "new" };

/* -------- Render helpers -------- */
function starIcons(n) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<svg viewBox="0 0 20 20" class="${i <= n ? "on" : ""}" aria-hidden="true"><path d="M10 .9l2.6 5.3 5.9.9-4.3 4.2 1 5.8L10 14.9 4.8 17l1-5.8L1.5 7.1l5.9-.9L10 .9z"/></svg>`;
  }
  return html;
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function applySortFilter() {
  let list = [...state.reviews];
  if (state.filter !== "all") {
    const want = +state.filter;
    list = list.filter((r) => r.rating === want);
  }
  if (state.sort === "new") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (state.sort === "high") list.sort((a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt));
  if (state.sort === "low") list.sort((a, b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

function renderDistribution() {
  const { buckets, total, average } = state.stats;
  $("#bigScore").textContent = average.toFixed(1);
  $("#bigStars").innerHTML = starIcons(Math.round(average));
  $("#avgStars").innerHTML = starIcons(Math.round(average));
  $("#avgScore").textContent = average.toFixed(1);
  $("#totalCount").textContent = total;

  const dist = $("#distBars");
  dist.innerHTML = "";
  for (let s = 5; s >= 1; s--) {
    const count = buckets[s - 1];
    const pct = total ? Math.round((count * 100) / total) : 0;
    dist.insertAdjacentHTML(
      "beforeend",
      `
      <div class="bar-row">
        <span>${s}★</span>
        <div class="bar" aria-label="${s} star bar"><span style="width:${pct}%"></span></div>
        <span>${pct}%</span>
      </div>
    `
    );
  }
}

function renderList() {
  const list = applySortFilter();
  const root = $("#reviewsList");
  root.innerHTML = "";
  if (!list.length) {
    $("#empty").style.display = "block";
    return;
  }
  $("#empty").style.display = "none";
  list.forEach((r) => {
    const name = (r.name || "").trim() || "Anonymous";
    const loc = (r.place || "").trim() ? ` · ${escapeHtml(r.place)}` : "";
    root.insertAdjacentHTML(
      "beforeend",
      `
      <article class="review">
        <div class="meta">
          <div class="name">${escapeHtml(name)}<span class="badge">${formatDate(r.createdAt)}</span></div>
          <div class="stars">${starIcons(r.rating)}</div>
        </div>
        <div class="muted">${r.rating}★${loc}</div>
        <p class="body">${escapeHtml(r.text)}</p>
      </article>
    `
    );
  });
}

async function loadReviews() {
  try {
    const res = await fetch(`${API_BASE}/reviews`);
    const data = await res.json();
    if (data.success) {
      state.reviews = data.reviews;
      state.stats = data.stats;
    }
  } catch (error) {
    console.error("Failed to load reviews:", error);
    $("#formNote").textContent = "Could not reach the server. Showing nothing for now.";
  }
  renderDistribution();
  renderList();
}

/* -------- Stars UI (Left→Right, JS fill) -------- */
function bindStarEvents() {
  const rateBox = $("#rateBox");
  const rateLive = $("#rateLive");
  const radios = [...rateBox.querySelectorAll('input[name="rating"]')];
  const labels = [...rateBox.querySelectorAll("label")];

  function setFill(v) {
    labels.forEach((lb, i) => lb.classList.toggle("active", i < v));
    rateLive.textContent = v ? `${v} ★ selected` : "Select rating";
  }
  labels.forEach((lb, i) => {
    lb.addEventListener("mouseenter", () => setFill(i + 1));
    lb.addEventListener("click", () => {
      radios[i].checked = true;
      setFill(i + 1);
    });
  });
  rateBox.addEventListener("mouseleave", () => {
    const v = parseInt(rateBox.querySelector("input:checked")?.value || 0, 10);
    setFill(v);
  });
  radios.forEach((r, i) => r.addEventListener("change", () => setFill(i + 1)));
  setFill(parseInt(rateBox.querySelector("input:checked")?.value || 0, 10));
}

/* -------- Form & Controls -------- */
function bindForm() {
  const form = $("#reviewForm");
  const cc = $("#cc");
  form.text.addEventListener("input", () => {
    cc.textContent = form.text.value.length;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const rating = +fd.get("rating");
    const text = (fd.get("text") || "").trim();
    if (!rating || text.length < 4) {
      $("#formNote").textContent = "Rating & at least 4 characters are required.";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: (fd.get("name") || "").trim(),
          place: (fd.get("place") || "").trim(),
          rating,
          text,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        $("#formNote").textContent = data.message || "Could not add review.";
        return;
      }

      form.reset();
      $("#rateLive").textContent = "Select rating";
      cc.textContent = "0";
      $$(".csel .active").forEach((el) => el.classList.remove("active"));
      await loadReviews();
      $("#formNote").textContent = "Thanks! Your review was added.";
      setTimeout(() => ($("#formNote").textContent = "* Required fields"), 2500);
    } catch (error) {
      $("#formNote").textContent = "Could not reach the server. Please try again.";
      console.error(error);
    }
  });
}
function bindControls() {
  $("#sortSel").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderList();
  });
  $$(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.filter = btn.dataset.filter;
      renderList();
    });
  });
}

/* -------- Sticky navbar / scroll-to-top / mobile menu -------- */
function bindChrome() {
  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (navbar) navbar.classList.toggle("is-sticky", window.scrollY > 0);
  });

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  if (scrollTopBtn) {
    window.addEventListener("scroll", () => {
      scrollTopBtn.style.display = window.scrollY > 200 ? "block" : "none";
    });
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const body = document.body;
  const btnOpen = document.getElementById("menuBtn");
  const btnClose = document.getElementById("closeMenu");
  const drawer = document.getElementById("mobileNav");
  const backdrop = document.getElementById("backdrop");

  function openMenu() {
    body.classList.add("menu-open");
    drawer?.setAttribute("aria-hidden", "false");
    btnOpen?.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    setTimeout(() => drawer?.querySelector("a")?.focus(), 120);
  }
  function closeMenu() {
    body.classList.remove("menu-open");
    drawer?.setAttribute("aria-hidden", "true");
    btnOpen?.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (backdrop) backdrop.hidden = true;
    }, 200);
    btnOpen?.focus();
  }

  btnOpen?.addEventListener("click", openMenu);
  btnClose?.addEventListener("click", closeMenu);
  backdrop?.addEventListener("click", closeMenu);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("menu-open")) closeMenu();
  });
}

/* -------- Init -------- */
document.addEventListener("DOMContentLoaded", () => {
  loadReviews();
  bindStarEvents();
  bindForm();
  bindControls();
  bindChrome();
});
