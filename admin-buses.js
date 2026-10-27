
// =============================================
// RAJABUS ADMIN - VIEW ONLY BUS MANAGEMENT
// =============================================

// Existing Admin authentication.
requireAdminAuth();

// =============================================
// API
// =============================================

const API = "http://localhost:5000/api/admin/buses";

// =============================================
// DOM ELEMENTS
// =============================================

const busTable = document.getElementById("busTable");

const searchInput =
  document.getElementById("searchInput");

const typeFilter =
  document.getElementById("typeFilter");

const refreshBtn =
  document.getElementById("refreshBtn");

const pageStatus =
  document.getElementById("pageStatus");

const tableCount =
  document.getElementById("tableCount");

const detailsModal =
  document.getElementById("detailsModal");

const modalTitle =
  document.getElementById("modalTitle");

const detailsGrid =
  document.getElementById("detailsGrid");

const modalCloseBtn =
  document.getElementById("modalCloseBtn");

// =============================================
// STATE
// =============================================

let buses = [];
let lastFocusedElement = null;

// =============================================
// SAFE VALUE HELPERS
// =============================================

function displayValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "-";
  }

  return String(value);
}

function getBusNumber(bus) {
  return displayValue(
    bus.busNo || bus.bus_no
  );
}

function getRegistration(bus) {
  return displayValue(
    bus.regNo || bus.reg_no
  );
}

function getBusType(bus) {
  return displayValue(bus.type);
}

function getCapacity(bus) {
  const capacity = Number(bus.totalSeats);

  if (
    bus.totalSeats === null ||
    bus.totalSeats === undefined ||
    !Number.isFinite(capacity) ||
    capacity < 1
  ) {
    return null;
  }

  return capacity;
}

function getOperatorId(bus) {
  if (!bus.operatorId) {
    return null;
  }

  if (
    typeof bus.operatorId === "object"
  ) {
    return bus.operatorId._id
      ? String(bus.operatorId._id)
      : null;
  }

  return String(bus.operatorId);
}

function getOperatorName(bus) {
  const operator = bus.operatorId;

  if (!operator) {
    return "Not Assigned";
  }

  if (typeof operator === "object") {
    if (operator.companyName) {
      return String(operator.companyName);
    }

    if (operator.ownerName) {
      return String(operator.ownerName);
    }
  }

  const id = getOperatorId(bus);

  if (id) {
    return `Operator ...${id.slice(-6)}`;
  }

  return "Assigned Operator";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// =============================================
// STATUS MESSAGE
// =============================================

function showStatus(message) {
  pageStatus.textContent = message;
  pageStatus.hidden = false;
}

function hideStatus() {
  pageStatus.textContent = "";
  pageStatus.hidden = true;
}

// =============================================
// CREATE TABLE CELL SAFELY
// =============================================

function createCell(text, className = "") {
  const td = document.createElement("td");

  td.textContent = displayValue(text);

  if (className) {
    td.className = className;
  }

  return td;
}

// =============================================
// EMPTY / LOADING TABLE ROW
// =============================================

function showTableMessage(message) {
  busTable.replaceChildren();

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 7;
  cell.className = "empty-row";
  cell.textContent = message;

  row.appendChild(cell);
  busTable.appendChild(row);
}

// =============================================
// LOAD OPERATOR BUSES
// GET /api/admin/buses
// =============================================

async function loadBuses() {
  refreshBtn.disabled = true;

  hideStatus();
  showTableMessage("Loading buses...");

  tableCount.textContent = "Loading...";

  try {
    const response = await adminFetch(API);

    if (!response || !response.ok) {
      throw new Error(
        `Unable to load buses (${response?.status || "Network Error"})`
      );
    }

    const data = await response.json();

    if (
      data.success !== true ||
      !Array.isArray(data.buses)
    ) {
      throw new Error(
        data.message || "Invalid bus response"
      );
    }

    // The Admin API is already filtered to
    // return only operator-owned buses.
    buses = data.buses;

    updateBusStats();
    applyFilters();

  } catch (error) {
    console.error(
      "Admin buses loading error:",
      error
    );

    buses = [];

    updateBusStats();

    showTableMessage(
      "Unable to load buses. Please try again."
    );

    tableCount.textContent = "Showing 0 buses";

    showStatus(
      error.message || "Failed to load buses"
    );

  } finally {
    refreshBtn.disabled = false;
  }
}

// =============================================
// UPDATE BUS STATISTICS
// =============================================

function updateBusStats() {
  // Total operator-owned buses.
  const totalBuses = buses.length;

  // CTB buses.
  const ctbBuses = buses.filter(
    (bus) =>
      String(bus.type || "")
        .trim()
        .toLowerCase() === "ctb"
  ).length;

  // Private buses.
  const privateBuses = buses.filter(
    (bus) =>
      String(bus.type || "")
        .trim()
        .toLowerCase() === "private"
  ).length;

  // Total physical seats.
  const totalSeats = buses.reduce(
    (total, bus) => {
      const capacity = getCapacity(bus);

      return total + (capacity || 0);
    },
    0
  );

  document.getElementById(
    "busCount"
  ).textContent = totalBuses;

  document.getElementById(
    "ctbCount"
  ).textContent = ctbBuses;

  document.getElementById(
    "privateCount"
  ).textContent = privateBuses;

  document.getElementById(
    "seatCount"
  ).textContent = totalSeats;
}

// =============================================
// RENDER BUSES TABLE
// =============================================

function renderBuses(data) {
  busTable.replaceChildren();

  if (data.length === 0) {
    showTableMessage(
      buses.length === 0
        ? "No operator-added buses found"
        : "No buses match your search"
    );

    tableCount.textContent =
      `Showing 0 of ${buses.length} buses`;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  data.forEach((bus) => {
    const row = document.createElement("tr");

    // -----------------------------------------
    // BUS NUMBER
    // -----------------------------------------

    row.appendChild(
      createCell(
        getBusNumber(bus),
        "bus-number"
      )
    );

    // -----------------------------------------
    // REGISTRATION
    // -----------------------------------------

    row.appendChild(
      createCell(getRegistration(bus))
    );

    // -----------------------------------------
    // BUS TYPE BADGE
    // -----------------------------------------

    const typeCell =
      document.createElement("td");

    const typeBadge =
      document.createElement("span");

    const type = getBusType(bus);

    const normalizedType =
      type.toLowerCase();

    typeBadge.className =
      "operator-bus-type " +
      (
        normalizedType === "ctb"
          ? "ctb"
          : normalizedType === "private"
            ? "private"
            : "other"
      );

    typeBadge.textContent = type;

    typeCell.appendChild(typeBadge);
    row.appendChild(typeCell);

    // -----------------------------------------
    // CAPACITY
    // -----------------------------------------

    const capacity = getCapacity(bus);

    row.appendChild(
      createCell(
        capacity === null
          ? "-"
          : `${capacity} Seats`
      )
    );

    // -----------------------------------------
    // OPERATOR
    // -----------------------------------------

    row.appendChild(
      createCell(getOperatorName(bus))
    );

    // -----------------------------------------
    // ADDED DATE
    // -----------------------------------------

    row.appendChild(
      createCell(formatDate(bus.createdAt))
    );

    // -----------------------------------------
    // VIEW DETAILS BUTTON ONLY
    // -----------------------------------------

    const actionCell =
      document.createElement("td");

    const viewButton =
      document.createElement("button");

    viewButton.type = "button";
    viewButton.className =
      "operator-view-btn";

    viewButton.textContent = "View Details";

    viewButton.dataset.busId =
      String(bus._id);

    actionCell.appendChild(viewButton);
    row.appendChild(actionCell);

    fragment.appendChild(row);
  });

  busTable.appendChild(fragment);

  tableCount.textContent =
    `Showing ${data.length} of ${buses.length} buses`;
}

// =============================================
// SEARCH AND FILTER
// =============================================

function applyFilters() {
  const searchValue =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedType =
    typeFilter.value
      .trim()
      .toLowerCase();

  const filteredBuses = buses.filter(
    (bus) => {
      const searchableText = [
        getBusNumber(bus),
        getRegistration(bus),
        getBusType(bus),
        getOperatorName(bus),
        getOperatorId(bus) || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchableText.includes(searchValue);

      const matchesType =
        !selectedType ||
        String(bus.type || "")
          .trim()
          .toLowerCase() === selectedType;

      return matchesSearch && matchesType;
    }
  );

  renderBuses(filteredBuses);
}

// =============================================
// ADD A VIEW-ONLY DETAIL ITEM
// =============================================

function addDetail(label, value) {
  const item =
    document.createElement("div");

  item.className =
    "operator-detail-item";

  const labelElement =
    document.createElement("span");

  labelElement.textContent = label;

  const valueElement =
    document.createElement("strong");

  valueElement.textContent =
    displayValue(value);

  item.appendChild(labelElement);
  item.appendChild(valueElement);

  detailsGrid.appendChild(item);
}

// =============================================
// OPEN BUS DETAILS MODAL
// =============================================

function viewBus(id) {
  const bus = buses.find(
    (item) => String(item._id) === String(id)
  );

  if (!bus) {
    showStatus("Bus details not found");
    return;
  }

  lastFocusedElement =
    document.activeElement;

  modalTitle.textContent =
    getBusNumber(bus);

  detailsGrid.replaceChildren();

  const capacity = getCapacity(bus);

  addDetail(
    "Bus Number",
    getBusNumber(bus)
  );

  addDetail(
    "Registration Number",
    getRegistration(bus)
  );

  addDetail(
    "Bus Type",
    getBusType(bus)
  );

  addDetail(
    "Total Physical Seats",
    capacity === null
      ? "-"
      : `${capacity} Seats`
  );

  addDetail(
    "Bus Operator",
    getOperatorName(bus)
  );

  addDetail(
    "Operator ID",
    getOperatorId(bus) || "-"
  );

  addDetail(
    "Bus ID",
    bus._id || "-"
  );

  addDetail(
    "Registered Date",
    formatDate(bus.createdAt)
  );

  detailsModal.hidden = false;

  document.body.style.overflow =
    "hidden";

  modalCloseBtn.focus();
}

// =============================================
// CLOSE BUS DETAILS MODAL
// =============================================

function closeBusDetails() {
  detailsModal.hidden = true;

  document.body.style.overflow = "";

  if (
    lastFocusedElement &&
    typeof lastFocusedElement.focus === "function"
  ) {
    lastFocusedElement.focus();
  }
}

// =============================================
// EVENT LISTENERS
// =============================================

// Search buses.
searchInput.addEventListener(
  "input",
  applyFilters
);

// Filter by type.
typeFilter.addEventListener(
  "change",
  applyFilters
);

// Refresh bus data.
refreshBtn.addEventListener(
  "click",
  loadBuses
);

// View Details through event delegation.
busTable.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "button[data-bus-id]"
    );

    if (!button) {
      return;
    }

    viewBus(button.dataset.busId);
  }
);

// Close modal button.
modalCloseBtn.addEventListener(
  "click",
  closeBusDetails
);

// Click outside modal content.
detailsModal.addEventListener(
  "click",
  (event) => {
    if (event.target === detailsModal) {
      closeBusDetails();
    }
  }
);

// Close modal with Escape key.
document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      !detailsModal.hidden
    ) {
      closeBusDetails();
    }
  }
);

// =============================================
// INITIAL LOAD
// =============================================

loadBuses();
