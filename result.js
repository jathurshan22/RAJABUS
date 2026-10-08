
"use strict";

// =====================================================
// RAJABUS - TRIP BASED SEARCH RESULTS
//
// Requires corrected backend busRoutes.js
//
// API:
// GET /api/buses/search?to=...&date=...&type=...
//
// Each result represents ONE scheduled trip.
// =====================================================

// API_BASE is normally declared in seat.js.
// Use a fallback if result.js is loaded independently.

const RESULT_API_BASE =
  typeof API_BASE !== "undefined"
    ? API_BASE
    : "http://localhost:5000/api";


// =====================================================
// SEARCH PARAMETERS
// =====================================================

const params = new URLSearchParams(
  window.location.search
);

const fromLocation = "Mihintale";

const district = (
  params.get("district") || ""
).trim();

const travelDate = (
  params.get("date") || ""
).trim();

const busType = (
  params.get("bus") || ""
).trim();


// =====================================================
// DOM ELEMENTS
// =====================================================

const districtNameElement =
  document.getElementById("districtName");

const travelDateElement =
  document.getElementById("travelDate");

const busTypeElement =
  document.getElementById("busType");

const resultsSection =
  document.getElementById("resultsSection");

if (districtNameElement) {
  districtNameElement.textContent =
    district || "-";
}

if (travelDateElement) {
  travelDateElement.textContent =
    travelDate || "-";
}

if (busTypeElement) {
  busTypeElement.textContent =
    busType || "Any";
}


// =====================================================
// TRIP CACHE
//
// Map:
// tripId -> selected trip data
// =====================================================

const tripsById = new Map();


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]
  );
}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


// =====================================================
// FORMAT FARE
// =====================================================

function formatFare(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "-";
  }

  return amount.toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}


// =====================================================
// SHOW MESSAGE
// =====================================================

function showResultMessage(message) {
  if (!resultsSection) return;

  resultsSection.innerHTML = `
    <p>${escapeHtml(message)}</p>
  `;
}


// =====================================================
// NORMALIZE SEARCH RESULT
//
// Expected corrected busRoutes.js fields:
//
// id            -> Physical Bus ID
// tripId        -> Scheduled Trip ID
// from
// to
// depart
// arrive
// fare
// journeyDate
// availableSeats
//
// Also supports a populated busId object.
// =====================================================

function normalizeTrip(raw) {
  const populatedBus =
    raw.busId &&
    typeof raw.busId === "object"
      ? raw.busId
      : raw.bus &&
        typeof raw.bus === "object"
        ? raw.bus
        : {};

  const physicalBusId =
    raw.id ||
    populatedBus._id ||
    populatedBus.id ||
    raw.busId ||
    "";

  const scheduledTripId =
    raw.tripId || "";

  const numericFare = Number(raw.fare);

  let availableSeats = null;

  if (
    raw.availableSeats !== null &&
    raw.availableSeats !== undefined &&
    raw.availableSeats !== ""
  ) {
    const count = Number(raw.availableSeats);

    if (
      Number.isInteger(count) &&
      count >= 0
    ) {
      availableSeats = count;
    }
  }

  return {
    id: String(physicalBusId),

    busId: String(physicalBusId),

    tripId: String(scheduledTripId),

    busNo: String(
      raw.busNo ||
      populatedBus.busNo ||
      ""
    ),

    regNo: String(
      raw.regNo ||
      populatedBus.regNo ||
      ""
    ),

    type: String(
      raw.type ||
      populatedBus.type ||
      ""
    ),

    from: String(
      raw.from || ""
    ),

    to: String(
      raw.to || ""
    ),

    depart: String(
      raw.depart ||
      raw.departureTime ||
      ""
    ),

    arrive: String(
      raw.arrive ||
      raw.arrivalTime ||
      ""
    ),

    fare: Number.isFinite(numericFare)
      ? numericFare
      : null,

    journeyDate: String(
      raw.journeyDate ||
      travelDate
    ),

    distanceKm:
      raw.distanceKm ?? null,

    totalSeats:
      raw.totalSeats ?? null,

    availableSeats,
  };
}


// =====================================================
// BUS TYPE FILTER
// =====================================================

function filterTripsByType(trips) {
  if (
    !busType ||
    busType.toLowerCase() === "any"
  ) {
    return trips;
  }

  const wantedType = busType.toLowerCase();

  return trips.filter(
    (trip) =>
      trip.type.trim().toLowerCase() ===
      wantedType
  );
}


// =====================================================
// FORMAT SEAT BADGE
// =====================================================

function getSeatBadge(trip) {
  if (trip.availableSeats === null) {
    return {
      label: "Check Seats",
      low: false,
      full: false,
    };
  }

  if (trip.availableSeats === 0) {
    return {
      label: "Fully Booked",
      low: true,
      full: true,
    };
  }

  return {
    label: `${trip.availableSeats} Seats`,
    low: trip.availableSeats <= 10,
    full: false,
  };
}


// =====================================================
// BUILD TRIP CARD
//
// Uses existing result.css class names.
// =====================================================

function busCardHtml(bus) {
  const badge = getSeatBadge(bus);

  const missingTrip =
    !bus.tripId || !bus.id;

  const invalidFare =
    bus.fare === null ||
    bus.fare <= 0;

  const cannotBook =
    badge.full ||
    missingTrip ||
    invalidFare;

  const buttonLabel = badge.full
    ? "Fully Booked"
    : missingTrip
      ? "Trip Unavailable"
      : invalidFare
        ? "Fare Unavailable"
        : "Book Now";

  return `
    <div class="bus-card">

      <div class="card-top">

        <div>
          <h2>
            ${escapeHtml(bus.from)}

            <i class="fa-solid fa-arrow-right-long"></i>

            ${escapeHtml(bus.to)}
          </h2>

          <p>
            Bus No:

            <b>${escapeHtml(bus.busNo)}</b>

            &middot;

            ${escapeHtml(bus.type)}

            ${
              bus.regNo
                ? `
                  &middot;
                  ${escapeHtml(bus.regNo)}
                `
                : ""
            }
          </p>
        </div>

        <span class="seat-badge${badge.low ? " low" : ""}">
          ${escapeHtml(badge.label)}
        </span>

      </div>


      <div class="bus-info">

        <div>
          <i class="fa-regular fa-clock"></i>
          <span>Departure</span>
          <b>${escapeHtml(bus.depart)}</b>
        </div>

        <div>
          <i class="fa-solid fa-clock"></i>
          <span>Arrival</span>
          <b>${escapeHtml(bus.arrive)}</b>
        </div>

        <div>
          <i class="fa-regular fa-calendar"></i>
          <span>Journey Date</span>
          <b>
            ${escapeHtml(
              formatDate(bus.journeyDate)
            )}
          </b>
        </div>

        <div>
          <i class="fa-solid fa-ticket"></i>
          <span>Fare</span>
          <b>
            Rs. ${escapeHtml(
              formatFare(bus.fare)
            )}
          </b>
        </div>

      </div>


      <button
        type="button"
        class="book-btn"
        data-trip-id="${escapeHtml(bus.tripId)}"
        ${cannotBook ? "disabled" : ""}
      >
        ${escapeHtml(buttonLabel)}
      </button>

    </div>
  `;
}


// =====================================================
// OPEN SEAT MODAL FOR SELECTED TRIP
// =====================================================

function selectTrip(tripId) {
  const bus = tripsById.get(
    String(tripId)
  );

  if (!bus) {
    alert(
      "Selected trip could not be found. Please refresh the page."
    );
    return;
  }

  if (!bus.tripId || !bus.id) {
    alert(
      "Trip or bus information is missing."
    );
    return;
  }

  if (
    bus.availableSeats !== null &&
    bus.availableSeats <= 0
  ) {
    alert(
      "All seats are currently booked for this trip."
    );
    return;
  }

  if (
    !Number.isFinite(bus.fare) ||
    bus.fare <= 0
  ) {
    alert(
      "This trip does not have a valid fare."
    );
    return;
  }

  // ===================================================
  // STORE SELECTED TRIP
  // ===================================================

  localStorage.setItem(
    "selectedBus",
    JSON.stringify(bus)
  );

  localStorage.setItem(
    "selectedTrip",
    JSON.stringify(bus)
  );

  localStorage.setItem(
    "travelDate",
    bus.journeyDate
  );

  console.log(
    "Selected scheduled trip:",
    {
      tripId: bus.tripId,
      busId: bus.id,
      journeyDate: bus.journeyDate,
      fare: bus.fare,
    }
  );

  // ===================================================
  // OPEN SEAT MAP
  //
  // seat.js function:
  //
  // openSeatModal(bus, journeyDate)
  // ===================================================

  if (
    typeof window.openSeatModal !== "function"
  ) {
    alert(
      "Seat selection file is not loaded."
    );
    return;
  }

  window.openSeatModal(
    bus,
    bus.journeyDate
  );
}


// =====================================================
// BOOK BUTTON CLICK LISTENER
//
// Event delegation avoids separate listeners
// for each card.
// =====================================================

if (resultsSection) {
  resultsSection.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        ".book-btn"
      );

      if (
        !button ||
        button.disabled ||
        !resultsSection.contains(button)
      ) {
        return;
      }

      const tripId = button.dataset.tripId;

      if (!tripId) {
        alert(
          "Scheduled trip ID is missing."
        );
        return;
      }

      selectTrip(tripId);
    }
  );
}


// =====================================================
// LOAD SCHEDULED TRIPS
//
// Uses corrected trip-aware busRoutes.js.
//
// GET:
// /api/buses/search?to=Jaffna&date=YYYY-MM-DD
//
// Response:
// {
//   success: true,
//   date: "...",
//   buses: [
//     {
//       id,
//       tripId,
//       availableSeats,
//       ...
//     }
//   ]
// }
// =====================================================

async function loadBuses() {
  if (!resultsSection) {
    console.error(
      "resultsSection element not found"
    );
    return;
  }

  // -----------------------------------------------
  // DESTINATION VALIDATION
  // -----------------------------------------------

  if (!district) {
    showResultMessage(
      "Please go back and choose a destination district."
    );
    return;
  }

  // -----------------------------------------------
  // DATE VALIDATION
  // -----------------------------------------------

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)
  ) {
    showResultMessage(
      "Please go back and select a valid travel date."
    );
    return;
  }

  resultsSection.innerHTML = `
    <p>Searching available trips...</p>
  `;

  try {
    // -----------------------------------------------
    // SEARCH QUERY
    // -----------------------------------------------

    const qs = new URLSearchParams({
      to: district,
      date: travelDate,
    });

    if (
      busType &&
      busType.toLowerCase() !== "any"
    ) {
      qs.set("type", busType);
    }

    const url =
      `${RESULT_API_BASE}/buses/search?${qs.toString()}`;

    console.log(
      "Trip search URL:",
      url
    );

    // -----------------------------------------------
    // FETCH TRIPS
    // -----------------------------------------------

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok || !data.success) {
      showResultMessage(
        data.message ||
        "Could not search trips."
      );
      return;
    }

    // -----------------------------------------------
    // NORMALIZE RESULTS
    // -----------------------------------------------

    let trips = Array.isArray(data.buses)
      ? data.buses.map(normalizeTrip)
      : [];

    // -----------------------------------------------
    // STARTING LOCATION FILTER
    //
    // Current RAJABUS flow starts at Mihintale.
    // -----------------------------------------------

    trips = trips.filter(
      (trip) =>
        trip.from.trim().toLowerCase() ===
        fromLocation.toLowerCase()
    );

    // -----------------------------------------------
    // DESTINATION FILTER
    // -----------------------------------------------

    trips = trips.filter(
      (trip) =>
        trip.to.trim().toLowerCase() ===
        district.toLowerCase()
    );

    // -----------------------------------------------
    // TYPE FILTER
    // -----------------------------------------------

    trips = filterTripsByType(trips);

    // -----------------------------------------------
    // CLEAR OLD TRIP CACHE
    // -----------------------------------------------

    tripsById.clear();

    for (const trip of trips) {
      if (trip.tripId) {
        tripsById.set(
          trip.tripId,
          trip
        );
      }
    }

    // -----------------------------------------------
    // NO TRIPS
    // -----------------------------------------------

    if (trips.length === 0) {
      showResultMessage(
        `No scheduled buses found for ` +
        `${fromLocation} to ${district} ` +
        `on ${formatDate(travelDate)}.`
      );
      return;
    }

    // -----------------------------------------------
    // SHOW TRIP CARDS
    // -----------------------------------------------

    resultsSection.innerHTML = trips
      .map(busCardHtml)
      .join("");

    console.log(
      "Available scheduled trips:",
      trips
    );

  } catch (error) {
    console.error(
      "Trip search error:",
      error
    );

    showResultMessage(
      "Could not reach the booking server. Please make sure the backend is running."
    );
  }
}


// =====================================================
// INITIALIZE
// =====================================================

loadBuses();
