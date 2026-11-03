
"use strict";

// =====================================================
// RAJABUS - ADMIN OPERATORS MANAGEMENT (READ ONLY)
// Uses existing admin-auth.js
// =====================================================

const OPERATORS_API =
  "http://localhost:5000/api/admin/operators";

const operatorTable =
  document.getElementById("operatorsTable");

const operatorSearch =
  document.getElementById("operatorSearch");

const operatorCountLabel =
  document.getElementById("operatorCountLabel");

const refreshOperatorsButton =
  document.getElementById("refreshOperators");

let allOperators = [];

// =====================================================
// SAFE HTML
// =====================================================

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function display(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function numeric(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : 0;
}

// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
}

// =====================================================
// STATUS STYLE
// =====================================================

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  return value === "active" || value === "suspended"
    ? value
    : "unknown";
}

// =====================================================
// SUMMARY CARDS
// =====================================================

function setSummary(stats) {
  const values = {
    totalOperators: numeric(stats.totalOperators),

    activeOperators: numeric(stats.activeOperators),

    totalOperatorBuses: numeric(stats.totalOperatorBuses),

    activeTrips: numeric(stats.activeTrips)
  };

  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent =
        value.toLocaleString("en-LK");
    }
  }
}

// =====================================================
// RENDER OPERATORS TABLE
// =====================================================

function renderOperators(operators) {
  operatorCountLabel.textContent =
    `Showing ${operators.length} of ${allOperators.length} operators`;

  if (operators.length === 0) {
    operatorTable.innerHTML = `
      <tr>
        <td colspan="8" class="op-empty">
          ${
            allOperators.length
              ? "No matching operators found."
              : "No registered operators found."
          }
        </td>
      </tr>
    `;

    return;
  }

  operatorTable.innerHTML = operators.map((operator) => {
    const status = display(operator.status);

    const company = display(operator.companyName);
    const owner = display(operator.ownerName);
    const email = display(operator.email);
    const phone = display(operator.phone);

    const busCount = numeric(operator.totalBuses);
    const tripCount = numeric(operator.totalTrips);
    const paidCount = numeric(operator.paidBookings);

    return `
      <tr>
        <td>
          <span class="op-company">
            ${safe(company)}
          </span>

          <span class="op-owner">
            ${safe(owner)}
          </span>
        </td>

        <td>
          <span class="op-contact-email">
            ${safe(email)}
          </span>

          <span class="op-secondary">
            ${safe(phone)}
          </span>
        </td>

        <td>
          <span class="op-pill ${statusClass(status)}">
            ${safe(status)}
          </span>
        </td>

        <td class="op-metric">
          ${busCount}
        </td>

        <td class="op-metric">
          ${tripCount}
        </td>

        <td class="op-metric">
          ${paidCount}
        </td>

        <td>
          ${safe(formatDate(operator.createdAt))}
        </td>

        <td>
          <button
            type="button"
            class="view-btn op-view-btn"
            data-view-operator="${safe(operator._id)}"
          >
            View
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// =====================================================
// SEARCH OPERATORS
// =====================================================

function filterOperators() {
  const query =
    operatorSearch.value.trim().toLowerCase();

  const filtered = !query
    ? allOperators
    : allOperators.filter((operator) => {
        const searchable = [
          operator.companyName,
          operator.ownerName,
          operator.email,
          operator.phone,
          operator.status,
          operator._id
        ];

        return searchable.some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );
      });

  renderOperators(filtered);
}

// =====================================================
// VIEW OPERATOR DETAILS
// =====================================================

function viewOperator(operatorId) {
  const operator = allOperators.find(
    (item) =>
      String(item._id) === String(operatorId)
  );

  if (!operator) {
    alert("Operator not found. Refresh the page.");
    return;
  }

  // Existing admin-auth.js provides showDetailModal().
  // Escape values because the modal builds HTML internally.

  const rows = [
    ["Operator ID", operator._id],
    ["Company Name", operator.companyName],
    ["Owner Name", operator.ownerName],
    ["Email", operator.email],
    ["Phone", operator.phone],
    ["Address", operator.address],
    ["Account Status", operator.status],
    ["Registered", formatDate(operator.createdAt)],
    ["Total Buses", numeric(operator.totalBuses)],
    ["Total Trips", numeric(operator.totalTrips)],
    ["Active Trips", numeric(operator.activeTrips)],
    ["Paid Bookings", numeric(operator.paidBookings)],
    ["Booked Seats", numeric(operator.bookedSeats)]
  ].map(([label, value]) => ({
    label: safe(label),
    value: safe(display(value))
  }));

  showDetailModal(
    "Bus Operator Details",
    rows
  );
}

// =====================================================
// LOAD OPERATORS FROM MONGODB
// =====================================================

async function loadOperators() {
  refreshOperatorsButton.disabled = true;

  operatorCountLabel.textContent =
    "Loading operators...";

  operatorTable.innerHTML = `
    <tr>
      <td colspan="8" class="op-empty">
        Loading operators...
      </td>
    </tr>
  `;

  try {
    // Existing authenticated adminFetch() helper.

    const response = await adminFetch(
      OPERATORS_API,
      {
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      data.success !== true
    ) {
      throw new Error(
        data.message ||
        `HTTP ${response.status}`
      );
    }

    allOperators = Array.isArray(data.operators)
      ? data.operators
      : [];

    const stats = data.stats || {
      totalOperators: allOperators.length,

      activeOperators: allOperators.filter(
        (operator) =>
          operator.status === "Active"
      ).length,

      totalOperatorBuses: allOperators.reduce(
        (sum, operator) =>
          sum + numeric(operator.totalBuses),
        0
      ),

      activeTrips: allOperators.reduce(
        (sum, operator) =>
          sum + numeric(operator.activeTrips),
        0
      )
    };

    setSummary(stats);

    filterOperators();

  } catch (error) {
    console.error(
      "Load admin operators error:",
      error
    );

    operatorCountLabel.textContent =
      "Could not load operator data";

    operatorTable.innerHTML = `
      <tr>
        <td colspan="8" class="op-empty">
          Failed to load operators.
          Check GET /api/admin/operators
          and Admin login.
        </td>
      </tr>
    `;

  } finally {
    refreshOperatorsButton.disabled = false;
  }
}

// =====================================================
// SEARCH EVENT
// =====================================================

operatorSearch.addEventListener(
  "input",
  filterOperators
);

// =====================================================
// REFRESH EVENT
// =====================================================

refreshOperatorsButton.addEventListener(
  "click",
  loadOperators
);

// =====================================================
// VIEW BUTTON EVENT
// =====================================================

operatorTable.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "button[data-view-operator]"
    );

    if (
      button &&
      operatorTable.contains(button)
    ) {
      viewOperator(
        button.dataset.viewOperator
      );
    }
  }
);

// =====================================================
// INITIALIZE
// =====================================================

loadOperators();
