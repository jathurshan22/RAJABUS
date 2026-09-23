const user = JSON.parse(localStorage.getItem("user") || "null");

if (!user) {
  window.location.href = "login.html";
}

const API_BASE = "http://localhost:5000/api";

const profileName   = document.getElementById("profileName");
const infoFullName  = document.getElementById("infoFullName");
const profileEmail  = document.getElementById("profileEmail");
const profilePhone  = document.getElementById("profilePhone");
const userId        = document.getElementById("userId");
const memberSince   = document.getElementById("memberSince");

const photoInput    = document.getElementById("profilePhotoInput");
const profilePhoto  = document.getElementById("profilePhoto");
const profileIcon   = document.getElementById("profileIcon");
const logoutBtn     = document.getElementById("logoutBtn");

const editProfileBtn    = document.getElementById("editProfileBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const notificationBtn   = document.getElementById("notificationBtn");

// ─── Populate Profile Info ─────────────────────────────
profileName.textContent  = user.fullName || "User";
infoFullName.textContent = user.fullName || "-";
profileEmail.textContent = user.email    || "-";
profilePhone.textContent = user.phone    || "-";
userId.textContent       = user.id || user._id || "-";
memberSince.textContent  = user.createdAt
  ? new Date(user.createdAt).toLocaleDateString()
  : "2026";

// ─── Profile Photo ────────────────────────────────────
function showPhoto(photoData) {
  if (photoData) {
    profilePhoto.src           = photoData;
    profilePhoto.style.display = "block";
    profileIcon.style.display  = "none";
  } else {
    profilePhoto.removeAttribute("src");
    profilePhoto.style.display = "none";
    profileIcon.style.display  = "inline-block";
  }
}

showPhoto(user.photo || localStorage.getItem("profilePhoto"));

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    showToast("Please choose a valid image file (JPG, PNG, WEBP or GIF).", "error");
    photoInput.value = "";
    return;
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    showToast("Image is too large. Please choose a photo under 2MB.", "error");
    photoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const photoData = reader.result;
    user.photo = photoData;
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("profilePhoto", photoData);
    showPhoto(photoData);
  };
  reader.onerror = () => {
    showToast("Could not read that image. Please try a different file.", "error");
  };
  reader.readAsDataURL(file);
});

// ─── Edit Profile Modal ───────────────────────────────
const editModal    = document.getElementById("editModal");
const closeEdit    = document.getElementById("closeEdit");
const editFullName = document.getElementById("editFullName");
const editPhone    = document.getElementById("editPhone");
const saveProfileBtn = document.getElementById("saveProfileBtn");

editProfileBtn.addEventListener("click", () => {
  editFullName.value = user.fullName || "";
  editPhone.value    = user.phone    || "";
  editModal.classList.add("show");
});

closeEdit.addEventListener("click", () => {
  editModal.classList.remove("show");
});

saveProfileBtn.addEventListener("click", async () => {
  const newName  = editFullName.value.trim();
  const newPhone = editPhone.value.trim();

  if (!newName || !newPhone) {
    showToast("Full name and phone number required", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/update-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:    user.email,
        fullName: newName,
        phone:    newPhone
      })
    });

    const data = await res.json();

    if (data.success) {
      user.fullName = data.user.fullName;
      user.phone    = data.user.phone;
      localStorage.setItem("user", JSON.stringify(user));

      profileName.textContent  = user.fullName;
      infoFullName.textContent = user.fullName;
      profilePhone.textContent = user.phone;

      editModal.classList.remove("show");
      showToast("Profile updated successfully", "success");
    } else {
      showToast(data.message || "Update failed", "error");
    }

  } catch (error) {
    showToast("Server error. Please try again.", "error");
    console.error(error);
  }
});

// ─── Change Password Modal ────────────────────────────
const passwordModal      = document.getElementById("passwordModal");
const closePassword      = document.getElementById("closePassword");
const currentPassword    = document.getElementById("currentPassword");
const newPassword        = document.getElementById("newPassword");
const confirmNewPassword = document.getElementById("confirmNewPassword");
const savePasswordBtn    = document.getElementById("savePasswordBtn");

changePasswordBtn.addEventListener("click", () => {
  currentPassword.value    = "";
  newPassword.value        = "";
  confirmNewPassword.value = "";
  passwordModal.classList.add("show");
});

closePassword.addEventListener("click", () => {
  passwordModal.classList.remove("show");
});

savePasswordBtn.addEventListener("click", async () => {
  if (!currentPassword.value || !newPassword.value || !confirmNewPassword.value) {
    showToast("All fields are required", "error");
    return;
  }

  if (newPassword.value !== confirmNewPassword.value) {
    showToast("Passwords do not match", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:           user.email,
        currentPassword: currentPassword.value,
        newPassword:     newPassword.value
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast("Password updated successfully", "success");
      passwordModal.classList.remove("show");
    } else {
      showToast(data.message, "error");
    }

  } catch (error) {
    showToast("Server error", "error");
    console.error(error);
  }
});

// ─── Notification Button ──────────────────────────────
notificationBtn.addEventListener("click", () => {
  showToast("Notifications enabled for booking updates.", "success");
});

// ─── Logout ───────────────────────────────────────────
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("user");
  localStorage.removeItem("userToken");
  localStorage.removeItem("profilePhoto");
  localStorage.removeItem("currentBooking");
  localStorage.removeItem("pendingBooking");
  localStorage.removeItem("bookingId");
  window.location.href = "login.html";
});

// ─── Loyalty Points ───────────────────────────────────
function getLoyaltyTier(points) {
  if (points >= 1000) return { name: "Platinum", emoji: "💎", cls: "plat",   next: null, tierMin: 1000 };
  if (points >= 500)  return { name: "Gold",     emoji: "🥇", cls: "gold",   next: 1000, tierMin: 500  };
  if (points >= 100)  return { name: "Silver",   emoji: "🥈", cls: "silver", next: 500,  tierMin: 100  };
                      return { name: "Bronze",   emoji: "🥉", cls: "bronze", next: 100,  tierMin: 0    };
}

function applyLoyalty(points) {
  const tier   = getLoyaltyTier(points);
  const ptsEl  = document.getElementById("loyaltyPoints");
  const badge  = document.getElementById("loyaltyBadge");
  const bar    = document.getElementById("loyaltyBar");
  const barTxt = document.getElementById("loyaltyBarText");

  if (!ptsEl) return;

  ptsEl.textContent = points + " pts";
  badge.textContent = tier.emoji + " " + tier.name;
  badge.className   = "loyalty-badge " + tier.cls;

  if (tier.next) {
    const pct = Math.round(((points - tier.tierMin) / (tier.next - tier.tierMin)) * 100);
    bar.style.width    = pct + "%";
    barTxt.textContent = (tier.next - points) + " pts to " + getLoyaltyTier(tier.next).name;
  } else {
    bar.style.width    = "100%";
    barTxt.textContent = "🎉 Max tier reached!";
  }
}

async function renderLoyalty() {
  const uid = user.id || user._id;
  if (!uid) {
    applyLoyalty(0);
    return;
  }

  try {
    const res  = await fetch(`${API_BASE}/bookings/user/${uid}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("userToken")}` },
    });
    const data = await res.json();

    const count  = Array.isArray(data.bookings) ? data.bookings.length : 0;
    applyLoyalty(count * 10);
  } catch {
    // fallback: use localStorage if server unreachable
    const cached = JSON.parse(localStorage.getItem("bookings") || "[]");
    applyLoyalty(cached.length * 10);
  }
}

renderLoyalty();