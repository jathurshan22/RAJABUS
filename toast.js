(function () {
  function ensureContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function (message, type) {
    type = type || "info";
    const container = ensureContainer();

    const icons = { success: "&#10003;", error: "&#10005;", info: "!" };

    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML =
      '<span class="toast-icon">' + (icons[type] || icons.info) + "</span>" +
      '<span class="toast-message"></span>' +
      '<span class="toast-progress"></span>';
    toast.querySelector(".toast-message").textContent = message;

    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add("hide");
      toast.addEventListener("animationend", function () { toast.remove(); }, { once: true });
    }, 3200);
  };
})();
