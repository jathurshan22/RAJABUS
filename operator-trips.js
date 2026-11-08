
/* =====================================================
   RAJABUS - OPERATOR TRIPS
   Create / Edit / List / Delete + Distance (KM)
   ===================================================== */

"use strict";

const TRIP_API =
  "http://localhost:5000/api/operator-trips";

const BUS_API =
  "http://localhost:5000/api/operator-buses";

const $ = (id) =>
  document.getElementById(id);

const tripTableBody = $("tripTableBody");
const tripModal = $("tripModal");
const tripForm = $("tripForm");
const editTripId = $("editTripId");
const busSelect = $("busId");
const modalTitle = $("modalTitle");
const distanceInput = $("distanceKm");

const submitButton =
  tripForm?.querySelector('button[type="submit"]');

let loadedEditTrip = null;

// ==========================================
// NOTIFICATIONS
// ==========================================

function notify(message, type = "error") {
  if (typeof window.showToast === "function") {
    window.showToast(message, type);
  } else {
    console[type === "error" ? "error" : "log"](message);
    alert(message);
  }
}

// ==========================================
// LOGOUT
// ==========================================

function logout() {
  localStorage.removeItem("operatorToken");
  localStorage.removeItem("operatorData");

  window.location.replace("operator-login.html");
}

// ==========================================
// AUTHENTICATED HEADERS
// ==========================================

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization:
      `Bearer ${localStorage.getItem("operatorToken") || ""}`
  };
}

// ==========================================
// API REQUEST HELPER
// ==========================================

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    headers: {
      ...headers(),
      ...(options.headers || {})
    },

    cache: "no-store"
  });

  if (response.status === 401) {
    logout();

    throw new Error(
      "Operator session expired. Please log in again."
    );
  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (
    !response.ok ||
    data.success !== true
  ) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

// ==========================================
// SAFE HTML
// ==========================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================================
// SRI LANKA CURRENT DATE
// ==========================================

function todayInSriLanka() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const part = (type) =>
    parts.find(
      (p) => p.type === type
    )?.value || "";

  return (
    `${part("year")}-` +
    `${part("month")}-` +
    `${part("day")}`
  );
}

// ==========================================
// DISTANCE TABLE HEADER
// ==========================================

function ensureDistanceHeader() {
  const headerRow = tripTableBody
    ?.closest("table")
    ?.querySelector("thead tr");

  if (!headerRow) return;

  const cols = [
    ...headerRow.querySelectorAll("th")
  ];

  // Avoid duplicate Distance headings.
  if (
    cols.some(
      (th) => /distance/i.test(th.textContent)
    )
  ) {
    return;
  }

  const fareHeader = cols.find(
    (th) => /fare/i.test(th.textContent)
  );

  const th = document.createElement("th");
  th.textContent = "Distance (KM)";

  headerRow.insertBefore(
    th,
    fareHeader || null
  );
}

// ==========================================
// EMPTY TABLE MESSAGE
// ==========================================

function tableMessage(message) {
  tripTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="empty-row">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

// ==========================================
// LOAD OPERATOR BUSES
// ==========================================

async function loadBuses() {
  try {
    const data = await apiRequest(BUS_API);

    if (!Array.isArray(data.buses)) {
      throw new Error("Invalid buses response");
    }

    busSelect.replaceChildren(
      new Option("Select a bus", "")
    );

    for (const bus of data.buses) {
      const option = new Option(
        `${bus.busNo || "Bus"} - ${bus.regNo || ""}`,
        String(bus._id)
      );

      option.dataset.from = bus.from || "";
      option.dataset.to = bus.to || "";
      option.dataset.depart = bus.depart || "";
      option.dataset.arrive = bus.arrive || "";

      busSelect.add(option);
    }

  } catch (error) {
    console.error(
      "Load buses error:",
      error
    );

    notify(
      error.message || "Failed to load buses"
    );
  }
}

// ==========================================
// AUTO-FILL BUS DETAILS & DISTRICT SYNC
// ==========================================

const SRI_LANKA_DISTRICTS = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya"
];

function syncTripToOptions(targetValue) {
  const fromSelect = $("from");
  const toSelect = $("to");
  if (!fromSelect || !toSelect) return;

  const fromVal = fromSelect.value ? fromSelect.value.trim() : "";
  const prevToVal = targetValue !== undefined ? targetValue : (toSelect.value ? toSelect.value.trim() : "");

  toSelect.innerHTML = "";

  if (fromVal === "Mihintale") {
    // Condition 1: If From is "Mihintale",
    // To must show all 25 districts EXCEPT "Mihintale"
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.textContent = "Select district";
    toSelect.appendChild(ph);

    SRI_LANKA_DISTRICTS.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      toSelect.appendChild(opt);
    });

    if (prevToVal && prevToVal !== "Mihintale" && SRI_LANKA_DISTRICTS.includes(prevToVal)) {
      toSelect.value = prevToVal;
    } else {
      toSelect.value = "";
      ph.selected = true;
    }
  } else if (fromVal && fromVal !== "Mihintale") {
    // Condition 2: If From is other than "Mihintale",
    // To must ONLY show "Mihintale"
    const opt = document.createElement("option");
    opt.value = "Mihintale";
    opt.textContent = "Mihintale";
    opt.selected = true;
    toSelect.appendChild(opt);

    toSelect.value = "Mihintale";
  } else {
    // Initial / empty From: show placeholder, Mihintale, and all 25 districts
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.selected = true;
    ph.textContent = "Select district";
    toSelect.appendChild(ph);

    const mOpt = document.createElement("option");
    mOpt.value = "Mihintale";
    mOpt.textContent = "Mihintale";
    toSelect.appendChild(mOpt);

    SRI_LANKA_DISTRICTS.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      toSelect.appendChild(opt);
    });

    if (prevToVal && (prevToVal === "Mihintale" || SRI_LANKA_DISTRICTS.includes(prevToVal))) {
      toSelect.value = prevToVal;
    } else {
      toSelect.value = "";
      ph.selected = true;
    }
  }
}

function applyBusDefaults() {
  const option =
    busSelect.selectedOptions[0];

  if (!option?.value) return;

  if (option.dataset.from) {
    $("from").value = option.dataset.from;
    syncTripToOptions(option.dataset.to || "");
  }

  const defaults = [
    ["departureTime", option.dataset.depart],
    ["arrivalTime", option.dataset.arrive]
  ];

  for (const [id, value] of defaults) {
    const input = $(id);

    if (!input || !value) continue;

    input.value = value;
  }
}

// ==========================================
// LOAD ALL OPERATOR TRIPS
// ==========================================

async function loadTrips() {
  try {
    const data = await apiRequest(TRIP_API);

    renderTrips(
      Array.isArray(data.trips)
        ? data.trips
        : []
    );

  } catch (error) {
    console.error(
      "Load trips error:",
      error
    );

    tableMessage(
      "Could not load trips. Please refresh."
    );

    notify(
      error.message || "Failed to load trips"
    );
  }
}

// ==========================================
// RENDER TRIPS TABLE
// ==========================================

function renderTrips(trips) {
  const total = $("totalTrips");
  const active = $("activeTrips");

  if (total) {
    total.textContent = String(trips.length);
  }

  if (active) {
    active.textContent = String(
      trips.filter(
        (t) => t.status === "Active"
      ).length
    );
  }

  if (!trips.length) {
    tableMessage("No trips created yet.");
    return;
  }

  tripTableBody.innerHTML = trips.map((trip) => {
    const bus =
      trip.busId &&
      typeof trip.busId === "object"
        ? trip.busId
        : {};

    const distance = Number(
      trip.distanceKm
    );

    const km =
      trip.distanceKm != null &&
      Number.isFinite(distance) &&
      distance > 0
        ? `${distance.toLocaleString("en-LK")} km`
        : "Not set";

    const fare = Number(trip.fare);

    const fareLabel = Number.isFinite(fare)
      ? fare.toLocaleString("en-LK")
      : "—";

    const status = String(
      trip.status || "Unknown"
    );

    const statusClass = [
      "Active",
      "Cancelled",
      "Completed"
    ].includes(status)
      ? status.toLowerCase()
      : "";

    return `
      <tr>
        <td>
          ${escapeHtml(trip.journeyDate)}
        </td>

        <td>
          <strong>
            ${escapeHtml(bus.busNo || "-")}
          </strong>
          <br>
          ${escapeHtml(bus.regNo || "")}
        </td>

        <td>
          ${escapeHtml(trip.from)}
          →
          ${escapeHtml(trip.to)}
        </td>

        <td>
          ${escapeHtml(trip.departureTime)}
        </td>

        <td>
          ${escapeHtml(trip.arrivalTime)}
        </td>

        <td>
          ${escapeHtml(km)}
        </td>

        <td>
          Rs. ${escapeHtml(fareLabel)}
        </td>

        <td>
          <span class="status ${statusClass}">
            ${escapeHtml(status)}
          </span>
        </td>

        <td>
          <button
            type="button"
            class="action-btn edit-btn"
            data-action="edit"
            data-id="${escapeHtml(trip._id)}"
            aria-label="Edit trip"
          >
            <i class="fa-solid fa-pen"></i>
          </button>

          <button
            type="button"
            class="action-btn delete-btn"
            data-action="delete"
            data-id="${escapeHtml(trip._id)}"
            aria-label="Delete trip"
          >
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// ==========================================
// OPEN CREATE TRIP
// ==========================================

function openCreateTrip() {
  tripForm.reset();

  editTripId.value = "";
  loadedEditTrip = null;

  modalTitle.textContent = "Create Trip";

  $("statusGroup").style.display = "none";

  $("journeyDate").min =
    todayInSriLanka();

  syncTripToOptions("");

  tripModal.classList.add("show");
}

// ==========================================
// CLOSE MODAL
// ==========================================

function closeModal() {
  tripModal.classList.remove("show");

  tripForm.reset();
  editTripId.value = "";
  loadedEditTrip = null;
  syncTripToOptions("");
}

// ==========================================
// EDIT TRIP
// ==========================================

async function editTrip(id) {
  try {
    const data = await apiRequest(
      `${TRIP_API}/${encodeURIComponent(id)}`
    );

    const trip = data.trip;

    if (!trip) {
      throw new Error(
        "Trip details not found"
      );
    }

    loadedEditTrip = trip;

    editTripId.value = trip._id;

    busSelect.value = String(
      trip.busId?._id ||
      trip.busId ||
      ""
    );

    // Existing historical trips may have
    // an earlier journey date.
    $("journeyDate").min = "";

    $("journeyDate").value =
      trip.journeyDate || "";

    $("from").value =
      trip.from || "";

    syncTripToOptions(trip.to || "");

    $("departureTime").value =
      trip.departureTime || "";

    $("arrivalTime").value =
      trip.arrivalTime || "";

    $("fare").value =
      trip.fare ?? "";

    // IMPORTANT:
    // Load actual stored Distance KM.
    distanceInput.value =
      trip.distanceKm ?? "";

    $("status").value =
      trip.status || "Active";

    $("statusGroup").style.display =
      "block";

    modalTitle.textContent =
      "Edit Trip";

    tripModal.classList.add("show");

    console.log(
      "Edit Trip - stored distanceKm:",
      trip.distanceKm
    );

    if (trip.distanceKm == null) {
      console.warn(
        "This trip has no stored distanceKm."
      );
    }

  } catch (error) {
    console.error(
      "Edit trip error:",
      error
    );

    notify(
      error.message || "Failed to load trip"
    );
  }
}

// ==========================================
// SAVE CREATE / UPDATE TRIP
// ==========================================

async function saveTrip(event) {
  event.preventDefault();

  if (!tripForm.reportValidity()) {
    return;
  }

  const id = editTripId.value;

  const kmRaw =
    distanceInput.value.trim();

  const distanceKm =
    Number(kmRaw);

  const fareRaw =
    $("fare").value.trim();

  const fare =
    Number(fareRaw);

  // ========================================
  // VALIDATE DISTANCE
  // ========================================

  if (
    !kmRaw ||
    !Number.isFinite(distanceKm) ||
    distanceKm < 0.1
  ) {
    notify(
      "Distance (KM) must be at least 0.1"
    );

    distanceInput.focus();
    return;
  }

  // ========================================
  // VALIDATE FARE
  // ========================================

  if (
    !fareRaw ||
    !Number.isFinite(fare) ||
    fare < 0
  ) {
    notify("Enter a valid fare");

    $("fare").focus();
    return;
  }

  // ========================================
  // PREPARE REQUEST DATA
  // ========================================

  const tripData = {
    busId: busSelect.value,

    journeyDate: $("journeyDate").value,

    from: $("from").value.trim(),

    to: $("to").value.trim(),

    departureTime:
      $("departureTime").value,

    arrivalTime:
      $("arrivalTime").value,

    fare,

    // IMPORTANT:
    // Send Distance KM to Backend.
    distanceKm
  };

  if (id) {
    tripData.status =
      $("status").value;

    // Avoid resubmitting an unchanged
    // past journey date during Edit.
    if (
      loadedEditTrip?.journeyDate ===
      tripData.journeyDate
    ) {
      delete tripData.journeyDate;
    }
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    console.log(
      "Submitting Distance KM:",
      distanceKm
    );

    // ======================================
    // POST / PUT
    // ======================================

    const data = await apiRequest(
      id
        ? `${TRIP_API}/${encodeURIComponent(id)}`
        : TRIP_API,
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(tripData)
      }
    );

    // ======================================
    // VERIFY SAVED DISTANCE
    // ======================================

    const savedId =
      data.trip?._id || id;

    let storedKm =
      data.trip?.distanceKm;

    let verified = false;

    if (savedId) {
      try {
        const check = await apiRequest(
          `${TRIP_API}/${encodeURIComponent(savedId)}`
        );

        storedKm =
          check.trip?.distanceKm;

        verified = true;

      } catch (verifyError) {
        console.warn(
          "Distance verification failed:",
          verifyError.message
        );
      }
    }

    console.log(
      "Backend stored Distance KM:",
      storedKm
    );

    closeModal();

    await loadTrips();

    // ======================================
    // SHOW ACCURATE RESULT
    // ======================================

    if (!verified) {
      notify(
        "Trip saved, but KM could not be verified. Check the Backend GET API.",
        "error"
      );

    } else if (
      storedKm == null ||
      Math.abs(
        Number(storedKm) - distanceKm
      ) > 0.000001
    ) {
      notify(
        "Trip saved, but Distance KM is missing or different in MongoDB. Check Trip.js schema and restart Backend.",
        "error"
      );

    } else {
      notify(
        id
          ? "Trip and Distance KM updated successfully"
          : "Trip and Distance KM created successfully",
        "success"
      );
    }

  } catch (error) {
    console.error(
      "Save trip error:",
      error
    );

    notify(
      error.message ||
      "Failed to save trip"
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

// ==========================================
// DELETE TRIP
// ==========================================

async function deleteTrip(id) {
  const confirmed = confirm(
    "Delete this trip? Do not delete trips with existing paid bookings."
  );

  if (!confirmed) return;

  try {
    await apiRequest(
      `${TRIP_API}/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    notify(
      "Trip deleted successfully",
      "success"
    );

    await loadTrips();

  } catch (error) {
    console.error(
      "Delete trip error:",
      error
    );

    notify(
      error.message ||
      "Failed to delete trip"
    );
  }
}

// ==========================================
// INITIALIZE PAGE
// ==========================================

async function start() {
  if (
    !localStorage.getItem("operatorToken")
  ) {
    logout();
    return;
  }

  const required = [
    tripTableBody,
    tripModal,
    tripForm,
    editTripId,
    busSelect,
    distanceInput
  ];

  if (required.some((el) => !el)) {
    console.error(
      "Operator Trips: Missing HTML element. Check distanceKm input."
    );
    return;
  }

  ensureDistanceHeader();

  // Create
  $("openTripBtn")?.addEventListener(
    "click",
    openCreateTrip
  );

  // Close
  $("closeModalBtn")?.addEventListener(
    "click",
    closeModal
  );

  $("cancelBtn")?.addEventListener(
    "click",
    closeModal
  );

  // Logout
  $("logoutBtn")?.addEventListener(
    "click",
    logout
  );

  // Bus selection
  busSelect.addEventListener(
    "change",
    applyBusDefaults
  );

  // From selection syncs To options
  $("from")?.addEventListener(
    "change",
    () => syncTripToOptions()
  );

  // Save
  tripForm.addEventListener(
    "submit",
    saveTrip
  );

  // Edit / Delete buttons
  tripTableBody.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "button[data-action]"
        );

      if (!button) return;

      const id = button.dataset.id;

      if (button.dataset.action === "edit") {
        editTrip(id);
      }

      if (button.dataset.action === "delete") {
        deleteTrip(id);
      }
    }
  );

  await loadBuses();
  await loadTrips();
}

// ==========================================
// START APPLICATION
// ==========================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    start,
    { once: true }
  );
} else {
  start();
}

// ==========================================
// OPERATOR TRIPS - LIVE STATUS REFRESH
// ==========================================

let tripRefreshRunning = false;

setInterval(async () => {

  if (
    document.hidden ||
    tripRefreshRunning
  ) {
    return;
  }

  tripRefreshRunning = true;

  try {

    await loadTrips();

  } finally {

    tripRefreshRunning = false;

  }

}, 15000);
