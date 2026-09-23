// ================== HOME LOGIN / PROFILE BUTTON ==================
window.addEventListener("DOMContentLoaded", () => {
  const loggedUser = JSON.parse(localStorage.getItem("user") || "null");
  const profileBtn = document.getElementById("profileBtn");
  const profilePhoto = document.getElementById("homeProfilePhoto");
  const defaultIcon = document.getElementById("defaultIcon");

  if (!profileBtn) return;

  if (loggedUser) {
    profileBtn.href = "profile.html";
    profileBtn.title = "Open profile";
  } else {
    profileBtn.href = "login.html";
    profileBtn.title = "Login";
  }

  const photo = loggedUser?.photo || localStorage.getItem("profilePhoto");

  if (photo && profilePhoto) {
    profilePhoto.src = photo;
    profilePhoto.style.display = "block";
    if (defaultIcon) defaultIcon.style.display = "none";
  } else {
    if (profilePhoto) profilePhoto.style.display = "none";
    if (defaultIcon) defaultIcon.style.display = "inline-block";
  }
});
