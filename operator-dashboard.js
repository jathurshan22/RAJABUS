const API_BASE =
  "http://localhost:5000/api/operators";


const token =
  localStorage.getItem(
    "operatorToken"
  );


const companyElement =
  document.getElementById(
    "operatorCompany"
  );


const operatorNameElement =
  document.getElementById(
    "operatorName"
  );


const operatorEmailElement =
  document.getElementById(
    "operatorEmail"
  );


const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


// ==========================================
// LOGIN CHECK
// ==========================================

if (!token) {

  window.location.href =
    "operator-login.html";

}


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadOperatorProfile() {

  try {

    const response =
      await fetch(
        `${API_BASE}/profile`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "Authentication failed"
      );
    }


    const operator =
      data.operator;


    companyElement.textContent =
      operator.companyName;


    operatorNameElement.textContent =
      operator.ownerName;


    operatorEmailElement.textContent =
      operator.email;


    localStorage.setItem(
      "operatorData",
      JSON.stringify(
        operator
      )
    );


  } catch (error) {

    console.error(
      "Operator profile error:",
      error
    );


    localStorage.removeItem(
      "operatorToken"
    );


    localStorage.removeItem(
      "operatorData"
    );


    showToast(
      "Session expired. Please login again.",
      "error"
    );


    setTimeout(() => {

      window.location.href =
        "operator-login.html";

    }, 1200);
  }
}


// ==========================================
// INITIAL DASHBOARD VALUES
//
// Next Bus Management phase-la backend
// stats endpoint connect pannuvom.
// ==========================================

function loadInitialStats() {

  document.getElementById(
    "totalBuses"
  ).textContent = "0";


  document.getElementById(
    "todayTrips"
  ).textContent = "0";


  document.getElementById(
    "totalBookings"
  ).textContent = "0";


  document.getElementById(
    "confirmedPassengers"
  ).textContent = "0";


  document.getElementById(
    "totalRevenue"
  ).textContent = "Rs. 0";

}


// ==========================================
// LOGOUT
// ==========================================

logoutBtn?.addEventListener(
  "click",
  () => {

    localStorage.removeItem(
      "operatorToken"
    );


    localStorage.removeItem(
      "operatorData"
    );


    showToast(
      "Logged out successfully",
      "success"
    );


    setTimeout(() => {

      window.location.href =
        "operator-login.html";

    }, 700);

  }
);


// ==========================================
// START
// ==========================================

loadOperatorProfile();

loadInitialStats();