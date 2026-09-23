const API_BASE = "http://localhost:5000/api";

(function () {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  const btn = document.getElementById("submitBtn");

  function setBusy(b) {
    if (!btn) return;
    btn.disabled = b;
    btn.style.opacity = b ? "0.7" : "1";
    btn.style.pointerEvents = b ? "none" : "auto";
  }

  form?.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = form.elements["name"]?.value?.trim();
    const email = form.elements["email"]?.value?.trim();
    const subject = form.elements["subject"]?.value?.trim();
    const message = form.elements["message"]?.value?.trim();

    // honeypot - if filled, silently drop (likely a bot)
    if (form.elements["_gotcha"]?.value) {
      form.reset();
      status.textContent = "✅ Message sent successfully! We will get back to you soon.";
      return;
    }

    if (!name || !email || !message) {
      status.textContent = "⚠️ Please fill required fields.";
      return;
    }

    status.textContent = "Sending...";
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        form.reset();
        status.textContent = "✅ Message sent successfully! We will get back to you soon.";
      } else {
        status.textContent = "❌ " + (data.message || "Something went wrong. Please try again.");
      }
    } catch {
      status.textContent = "❌ Network error. Please make sure the backend is running.";
    } finally {
      setBusy(false);
    }
  });
})();

(function () {
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
})();
