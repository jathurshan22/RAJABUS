(function () {
  const root = document.documentElement;
  const KEY  = "theme"; // "dark" | "light"

  // --- EARLY APPLY (before CSS paints) ---
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark") {
      root.setAttribute("data-theme","dark");
      document.body.classList.add("dark");    // keep older CSS working
    } else {
      root.removeAttribute("data-theme");
      document.body.classList.remove("dark");
    }
  } catch (e) {}

  // --- helpers ---
  const cur = () => (root.getAttribute("data-theme")==="dark" ? "dark" : "light");

  function apply(t){
    const isDark = (t === "dark");
    if (isDark) root.setAttribute("data-theme","dark");
    else { root.removeAttribute("data-theme"); t="light"; }

    // also support legacy CSS that uses body.dark
    document.body.classList.toggle("dark", isDark);

    try { localStorage.setItem(KEY, t); } catch(e) {}
    updateAll();
  }

  function ensureBtn(btn){
    if (btn.tagName==="BUTTON" && btn.getAttribute("type")!=="button"){
      btn.setAttribute("type","button"); // avoid form submit in Contact page
    }
    btn.setAttribute("role","switch");
  }

  // === HERE: Update button UI with professional icons ===
  function setBtnUI(btn){
    const t = cur();
    const isDark = (t === "dark");

    // Font Awesome icons (icon-only, accessible)
    btn.innerHTML = isDark
      ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';

    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute('aria-checked', String(isDark));
  }

  function updateAll(){
    document.querySelectorAll('#themeToggle,[data-theme-toggle]').forEach(setBtnUI);
  }

  function wire(){
    // prepare existing toggles
    document.querySelectorAll('#themeToggle,[data-theme-toggle]').forEach(b=>{
      ensureBtn(b); setBtnUI(b);
    });

    // delegate clicks (works even if DOM changes)
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('#themeToggle,[data-theme-toggle]');
      if(!btn) return;
      e.preventDefault();
      apply(cur()==="dark" ? "light" : "dark");
    });
  }

  if (document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  // sync across tabs
  window.addEventListener("storage", (ev)=>{
    if (ev.key===KEY) apply(ev.newValue==="dark" ? "dark" : "light");
  });

  // tiny public API (optional)
  window.Theme = { set:apply, toggle(){apply(cur()==="dark"?"light":"dark")}, get:cur };
})();




