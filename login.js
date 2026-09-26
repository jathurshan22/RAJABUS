const API_URL = "http://localhost:5000/api/auth";

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");


// ======================================================
// REGISTER
// ======================================================

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document
    .getElementById("regFullName")
    .value.trim();

  const email = document
    .getElementById("regEmail")
    .value.trim();

  const phone = document
    .getElementById("regPhone")
    .value.trim();

  const password =
    document.getElementById("regPassword").value;

  const confirmPassword =
    document.getElementById("regConfirmPassword").value;


  // --------------------------------------------------
  // PASSWORD CHECK
  // --------------------------------------------------

  if (password !== confirmPassword) {
    showToast(
      "Password and Confirm Password do not match",
      "error"
    );

    return;
  }


  try {
    const res = await fetch(
      `${API_URL}/register`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
        }),
      }
    );


    const data = await res.json();


    // --------------------------------------------------
    // REGISTER SUCCESS
    // --------------------------------------------------

    if (data.success) {
      showToast(
        data.message ||
          "Registration successful. You can now log in.",
        "success"
      );


      // Clear register form
      registerForm.reset();


      // Put registered email automatically
      // into login email field
      const loginEmail =
        document.getElementById("loginEmail");

      if (loginEmail) {
        loginEmail.value = email;
      }


      return;
    }


    // --------------------------------------------------
    // REGISTER FAILED
    // --------------------------------------------------

    showToast(
      data.message || "Register failed",
      "error"
    );

  } catch (error) {
    showToast(
      "Backend not connected. Please run backend server.",
      "error"
    );

    console.error(
      "Registration error:",
      error
    );
  }
});


// ======================================================
// LOGIN
// ======================================================

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();


  const email = document
    .getElementById("loginEmail")
    .value.trim();


  const password =
    document.getElementById("loginPassword").value;


  try {

    // --------------------------------------------------
    // NORMAL USER LOGIN
    // --------------------------------------------------

    const res = await fetch(
      `${API_URL}/login`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );


    const data = await res.json();


    // --------------------------------------------------
    // USER LOGIN SUCCESS
    // --------------------------------------------------

    if (data.success) {

      const oldUser =
        JSON.parse(
          localStorage.getItem("user") ||
            "null"
        );


      const savedPhoto =
        oldUser?.email === data.user.email
          ? oldUser.photo
          : localStorage.getItem(
              "profilePhoto"
            );


      if (savedPhoto) {
        data.user.photo =
          savedPhoto;
      }


      // Save user details
      localStorage.setItem(
        "user",
        JSON.stringify(
          data.user
        )
      );


      // Save JWT
      localStorage.setItem(
        "userToken",
        data.token
      );


      showToast(
        "Login successful",
        "success"
      );


      // Go profile page
      window.location.href =
        "profile.html";


      return;
    }


    // --------------------------------------------------
    // NORMAL USER LOGIN FAILED
    //
    // Try admin login using same login form
    // --------------------------------------------------

    const adminRes = await fetch(
      `${API_URL}/admin-login`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );


    const adminData =
      await adminRes.json();


    // --------------------------------------------------
    // ADMIN LOGIN SUCCESS
    // --------------------------------------------------

    if (adminData.success) {

      localStorage.setItem(
        "adminToken",
        adminData.token
      );


      localStorage.setItem(
        "adminEmail",
        adminData.admin.email
      );


      showToast(
        "Admin login successful",
        "success"
      );


      window.location.href =
        "admin-dashboard.html";


      return;
    }


    // --------------------------------------------------
    // BOTH USER + ADMIN LOGIN FAILED
    // --------------------------------------------------

    showToast(
      data.message ||
        "Invalid email or password",
      "error"
    );

  } catch (error) {

    showToast(
      "Backend not connected. Please run backend server.",
      "error"
    );


    console.error(
      "Login error:",
      error
    );
  }
});


// ======================================================
// PASSWORD SHOW / HIDE
// ======================================================

document
  .querySelectorAll(
    ".toggle-password"
  )
  .forEach((icon) => {

    icon.addEventListener(
      "click",
      () => {

        const input =
          icon.parentElement.querySelector(
            "input"
          );


        if (!input) {
          return;
        }


        const isHidden =
          input.type ===
          "password";


        input.type =
          isHidden
            ? "text"
            : "password";


        icon.classList.toggle(
          "fa-eye",
          !isHidden
        );


        icon.classList.toggle(
          "fa-eye-slash",
          isHidden
        );
      }
    );
  });