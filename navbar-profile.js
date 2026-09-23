// Common navbar profile/login button for all Raja Bus pages
window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const profileBtn = document.getElementById("profileBtn");
  const profilePhoto = document.getElementById("homeProfilePhoto");
  const defaultIcon = document.getElementById("defaultIcon");

  if (!profileBtn) return;

  if (user) {
    profileBtn.href = "profile.html";
    profileBtn.title = "Open profile";
  } else {
    profileBtn.href = "login.html";
    profileBtn.title = "Login";
  }

  const photo = (user && user.photo) || localStorage.getItem("profilePhoto");

  if (photo && profilePhoto) {
    profilePhoto.src = photo;
    profilePhoto.style.display = "block";
    if (defaultIcon) defaultIcon.style.display = "none";
  } else {
    if (profilePhoto) {
      profilePhoto.src = "";
      profilePhoto.style.display = "none";
    }
    if (defaultIcon) defaultIcon.style.display = "inline-flex";
  }
});
