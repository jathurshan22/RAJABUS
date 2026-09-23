const API_URL = "http://localhost:5000/api/auth";

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("regFullName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (password !== confirmPassword) {
    showToast("Password and Confirm Password do not match", "error");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, password }),
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message || "Registration successful. Please check your email to verify your account.", "success");
      registerForm.reset();
      document.getElementById("loginEmail").value = email;
    } else {
      showToast(data.message || "Register failed", "error");
    }
  } catch (error) {
    showToast("Backend not connected. Please run backend server.", "error");
    console.error(error);
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      const oldUser = JSON.parse(localStorage.getItem("user") || "null");
      const savedPhoto = oldUser?.email === data.user.email ? oldUser.photo : localStorage.getItem("profilePhoto");

      if (savedPhoto) data.user.photo = savedPhoto;

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("userToken", data.token);
      showToast("Login successful", "success");
      window.location.href = "profile.html";
      return;
    }

    // Account exists but email isn't verified yet - offer to resend
    // instead of just showing a dead-end error.
    if (data.needsVerification) {
      const resend = confirm(
        (data.message || "Please verify your email before logging in.") +
        "\n\nResend the verification email?"
      );

      if (resend) {
        try {
          const resendRes = await fetch(`${API_URL}/resend-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const resendData = await resendRes.json();
          showToast(resendData.message || "Verification email sent, please check your inbox.", "success");
        } catch (resendError) {
          showToast("Could not resend verification email. Please try again later.", "error");
        }
      }
      return;
    }

    // Not a valid user account - quietly check if these are the admin
    // credentials before showing an error. This lets the admin log in
    // from the same public form instead of needing a separate URL.
    const adminRes = await fetch(`${API_URL}/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const adminData = await adminRes.json();

    if (adminData.success) {
      localStorage.setItem("adminToken", adminData.token);
      localStorage.setItem("adminEmail", adminData.admin.email);
      window.location.href = "admin-dashboard.html";
      return;
    }

    showToast(data.message || "Login failed", "error");
  } catch (error) {
    showToast("Backend not connected. Please run backend server.", "error");
    console.error(error);
  }
});

// ===== Password show/hide toggle =====
document.querySelectorAll(".toggle-password").forEach((icon) => {
  icon.addEventListener("click", () => {
    const input = icon.parentElement.querySelector("input");
    const isHidden = input.type === "password";

    input.type = isHidden ? "text" : "password";
    icon.classList.toggle("fa-eye", !isHidden);
    icon.classList.toggle("fa-eye-slash", isHidden);
  });
});
