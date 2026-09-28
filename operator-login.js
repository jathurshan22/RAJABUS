const API_BASE =
  "http://localhost:5000/api/operators";


const loginTab =
  document.getElementById(
    "loginTab"
  );

const registerTab =
  document.getElementById(
    "registerTab"
  );

const loginForm =
  document.getElementById(
    "loginForm"
  );

const registerForm =
  document.getElementById(
    "registerForm"
  );


// =============================
// TABS
// =============================

loginTab.addEventListener(
  "click",
  () => {

    loginTab.classList.add(
      "active"
    );

    registerTab.classList.remove(
      "active"
    );

    loginForm.classList.add(
      "active-form"
    );

    registerForm.classList.remove(
      "active-form"
    );
  }
);


registerTab.addEventListener(
  "click",
  () => {

    registerTab.classList.add(
      "active"
    );

    loginTab.classList.remove(
      "active"
    );

    registerForm.classList.add(
      "active-form"
    );

    loginForm.classList.remove(
      "active-form"
    );
  }
);


// =============================
// REGISTER
// =============================

registerForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const data = {
      companyName:
        document
          .getElementById(
            "companyName"
          )
          .value
          .trim(),

      ownerName:
        document
          .getElementById(
            "ownerName"
          )
          .value
          .trim(),

      email:
        document
          .getElementById(
            "registerEmail"
          )
          .value
          .trim(),

      phone:
        document
          .getElementById(
            "registerPhone"
          )
          .value
          .trim(),

      address:
        document
          .getElementById(
            "registerAddress"
          )
          .value
          .trim(),

      password:
        document
          .getElementById(
            "registerPassword"
          )
          .value,
    };


    try {

      const response =
        await fetch(
          `${API_BASE}/register`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(data),
          }
        );


      const result =
        await response.json();


      if (!result.success) {

        showToast(
          result.message ||
          "Registration failed",
          "error"
        );

        return;
      }


      showToast(
        "Operator account created. Please login.",
        "success"
      );


      registerForm.reset();


      loginTab.click();


      document
        .getElementById(
          "loginEmail"
        )
        .value =
        data.email;


    } catch (error) {

      console.error(
        error
      );

      showToast(
        "Could not connect to server",
        "error"
      );
    }
  }
);


// =============================
// LOGIN
// =============================

loginForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const email =
      document
        .getElementById(
          "loginEmail"
        )
        .value
        .trim();


    const password =
      document
        .getElementById(
          "loginPassword"
        )
        .value;


    try {

      const response =
        await fetch(
          `${API_BASE}/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email,
                password,
              }),
          }
        );


      const result =
        await response.json();


      if (!result.success) {

        showToast(
          result.message ||
          "Login failed",
          "error"
        );

        return;
      }


      localStorage.setItem(
        "operatorToken",
        result.token
      );


      localStorage.setItem(
        "operatorData",
        JSON.stringify(
          result.operator
        )
      );


      showToast(
        "Operator login successful",
        "success"
      );


      setTimeout(() => {

        window.location.href =
          "operator-dashboard.html";

      }, 800);


    } catch (error) {

      console.error(
        error
      );


      showToast(
        "Could not connect to server",
        "error"
      );
    }
  }
);