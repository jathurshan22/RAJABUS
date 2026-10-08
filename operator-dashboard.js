
const API_BASE =
  "http://localhost:5000/api/operators";

const token =
  localStorage.getItem("operatorToken");

const companyElement =
  document.getElementById("operatorCompany");

const operatorNameElement =
  document.getElementById("operatorName");

const operatorEmailElement =
  document.getElementById("operatorEmail");

const logoutBtn =
  document.getElementById("logoutBtn");


// ==========================================
// HELPERS
// ==========================================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = String(value);
  }
}

function notify(message, type = "error") {
  if (typeof showToast === "function") {
    showToast(message, type);
  } else {
    console.log(message);
  }
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString(
    "en-LK",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function logoutOperator(message) {
  localStorage.removeItem("operatorToken");
  localStorage.removeItem("operatorData");

  if (message) {
    notify(message);
  }

  setTimeout(() => {
    window.location.href =
      "operator-login.html";
  }, 700);
}


// ==========================================
// LOGIN CHECK
// ==========================================

if (!token) {
  window.location.replace(
    "operator-login.html"
  );
}


// ==========================================
// LOAD OPERATOR PROFILE
// ==========================================

async function loadOperatorProfile() {
  try {
    const response = await fetch(
      `${API_BASE}/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (
        response.status === 401 ||
        response.status === 403
      ) {
        logoutOperator(
          "Session expired. Please login again."
        );
        return;
      }

      throw new Error(
        data.message || "Failed to load profile"
      );
    }

    const operator = data.operator;

    if (companyElement) {
      companyElement.textContent =
        operator.companyName || "";
    }

    if (operatorNameElement) {
      operatorNameElement.textContent =
        operator.ownerName || "";
    }

    if (operatorEmailElement) {
      operatorEmailElement.textContent =
        operator.email || "";
    }

    localStorage.setItem(
      "operatorData",
      JSON.stringify(operator)
    );

  } catch (error) {
    console.error(
      "Operator profile error:",
      error
    );

    notify(
      "Could not load operator profile."
    );
  }
}


// ==========================================
// DASHBOARD LOADING STATE
// ==========================================

function showStatsLoading() {
  setText("totalBuses", "...");
  setText("todayTrips", "...");
  setText("totalBookings", "...");
  setText("confirmedPassengers", "...");
  setText("totalRevenue", "...");
}


// ==========================================
// DASHBOARD ERROR STATE
// ==========================================

function showStatsError() {
  setText("totalBuses", "-");
  setText("todayTrips", "-");
  setText("totalBookings", "-");
  setText("confirmedPassengers", "-");
  setText("totalRevenue", "-");
}


// ==========================================
// LOAD ACTUAL DASHBOARD STATISTICS
// ==========================================

async function loadDashboardStats() {
  showStatsLoading();

  try {
    const response = await fetch(
      `${API_BASE}/dashboard/stats`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Failed to load dashboard statistics"
      );
    }

    const stats = data.stats;

    // ====================================
    // TOTAL BUSES
    // ====================================

    setText(
      "totalBuses",
      stats.totalBuses ?? 0
    );

    // ====================================
    // TODAY'S TRIPS
    // ====================================

    setText(
      "todayTrips",
      stats.todayTrips ?? 0
    );

    // ====================================
    // TOTAL BOOKINGS
    // ====================================

    setText(
      "totalBookings",
      stats.totalBookings ?? 0
    );

    // ====================================
    // CONFIRMED PASSENGERS
    // ====================================

    setText(
      "confirmedPassengers",
      stats.confirmedPassengers ?? 0
    );

    // ====================================
    // TOTAL REVENUE
    // ====================================

    setText(
      "totalRevenue",
      formatCurrency(
        stats.totalRevenue
      )
    );

    console.log(
      "Dashboard statistics loaded:",
      stats
    );

  } catch (error) {
    console.error(
      "Dashboard statistics error:",
      error
    );

    showStatsError();

    notify(
      "Could not load dashboard statistics."
    );
  }
}


// ==========================================
// LOGOUT
// ==========================================

logoutBtn?.addEventListener(
  "click",
  () => {
    localStorage.removeItem("operatorToken");
    localStorage.removeItem("operatorData");

    notify(
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
// START DASHBOARD
// ==========================================

if (token) {
  loadOperatorProfile();
  loadDashboardStats();
}
