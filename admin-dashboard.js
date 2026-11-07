
"use strict";

// ==========================================
// RAJABUS ADMIN DASHBOARD
// BOOKING DATE + LIVE SEARCH FIX
// ==========================================

// KEEP EXISTING AUTHENTICATION

requireAdminAuth();

const STATS_API =
  "http://localhost:5000/api/admin/stats";

const BOOKINGS_API =
  "http://localhost:5000/api/admin/bookings";

let recentBookings = [];

// ==========================================
// SAFE HTML TEXT
// ==========================================

function escapeAdminText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ==========================================
// BOOKING CREATED DATE
// NOT THE JOURNEY DATE
// ==========================================

function getBookingDate(booking) {

  const raw =
    booking.createdAt ??
    booking.bookingDate ??
    booking.bookedAt;

  if (!raw) return "N/A";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Colombo"
    }
  ).format(date);
}

// ==========================================
// GET BOOKED SEATS
// ==========================================

function getBookingSeats(booking) {

  if (
    Array.isArray(booking.seats) &&
    booking.seats.length
  ) {
    return booking.seats.join(", ");
  }

  const value =
    booking.selectedSeats ??
    booking.seatNo ??
    booking.seat;

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ? String(value) : "N/A";
}

// ==========================================
// GET ROUTE
// ==========================================

function getBookingRoute(booking) {

  if (booking.route) {
    return String(booking.route);
  }

  const from =
    String(booking.from || "").trim();

  const to =
    String(booking.to || "").trim();

  if (from && to) {
    return `${from} - ${to}`;
  }

  return from || to || "N/A";
}

// ==========================================
// GET PASSENGER
// ==========================================

function getBookingPassenger(booking) {
  return (
    booking.passengerName ||
    booking.passenger ||
    booking.name ||
    "N/A"
  );
}

// ==========================================
// GET AMOUNT
// ==========================================

function getBookingAmount(booking) {
  return (
    booking.totalFare ??
    booking.amount ??
    booking.totalAmount ??
    booking.fare ??
    0
  );
}

// ==========================================
// LOAD ADMIN STATISTICS
// ==========================================

async function loadStats() {

  try {

    const response =
      await adminFetch(STATS_API);

    if (!response.ok) {
      throw new Error(
        `Stats API: ${response.status}`
      );
    }

    const data =
      await response.json();

    document.getElementById(
      "totalUsers"
    ).textContent =
      data.totalUsers ?? 0;

    document.getElementById(
      "totalBookings"
    ).textContent =
      data.totalBookings ?? 0;

    document.getElementById(
      "totalBuses"
    ).textContent =
      data.totalBuses ?? 0;

    document.getElementById(
      "totalRevenue"
    ).textContent =
      `Rs. ${data.totalRevenue ?? 0}`;

  } catch (error) {

    console.error(
      "Load admin stats failed:",
      error
    );

  }
}

// ==========================================
// BUILD SEARCHABLE BOOKING TEXT
// ==========================================

function getSearchableBookingText(booking) {

  return [
    booking.ticketId,
    booking._id,
    getBookingPassenger(booking),
    booking.email,
    booking.busNo,
    getBookingRoute(booking),
    getBookingSeats(booking),
    getBookingDate(booking),
    booking.createdAt,
    booking.status
  ]
    .join(" ")
    .toLowerCase();

}

// ==========================================
// RENDER RECENT BOOKINGS
// ==========================================

function renderRecentBookings() {

  const table =
    document.getElementById(
      "recentBookingTable"
    );

  const search =
    document.getElementById(
      "recentBookingSearch"
    );

  const count =
    document.getElementById(
      "recentSearchCount"
    );

  if (!table) return;

  const query =
    (search?.value || "")
      .trim()
      .toLowerCase();

  // Search all loaded bookings.

  const matched = query
    ? recentBookings.filter(
        booking =>
          getSearchableBookingText(
            booking
          ).includes(query)
      )
    : recentBookings;

  // Default: Latest 5 bookings.
  // Search: Up to 50 matches.

  const displayed =
    matched.slice(
      0,
      query ? 50 : 5
    );

  // RESULT COUNT

  if (count) {

    if (query) {

      count.textContent =
        `Found ${matched.length} matching bookings` +
        (matched.length > 50
          ? " (showing first 50)"
          : "");

    } else {

      count.textContent =
        `Showing ${displayed.length} latest bookings`;

    }
  }

  // EMPTY RESULT

  if (!displayed.length) {

    table.innerHTML = `
      <tr>
        <td
          colspan="7"
          style="text-align:center;padding:28px"
        >
          ${query
            ? "No matching bookings found."
            : "No Bookings Found"
          }
        </td>
      </tr>
    `;

    return;
  }

  // SHOW BOOKINGS

  table.innerHTML =
    displayed.map(booking => {

      const id =
        String(booking._id || "");

      const status =
        String(
          booking.status || "Confirmed"
        );

      const statusClass =
        status
          .toLowerCase()
          .replace(/[^a-z-]/g, "");

      return `
        <tr>

          <td>
            ${escapeAdminText(
              booking.ticketId || id
            )}
          </td>

          <td>
            ${escapeAdminText(
              getBookingPassenger(booking)
            )}
          </td>

          <td>
            ${escapeAdminText(
              getBookingRoute(booking)
            )}
          </td>

          <td>
            ${escapeAdminText(
              getBookingSeats(booking)
            )}
          </td>

          <td>
            ${escapeAdminText(
              getBookingDate(booking)
            )}
          </td>

          <td>
            <span
              class="status ${statusClass}"
            >
              ${escapeAdminText(status)}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="view-btn"
              data-booking-id="${escapeAdminText(id)}"
            >
              View
            </button>
          </td>

        </tr>
      `;

    }).join("");

}

// ==========================================
// FETCH RECENT BOOKINGS
// ==========================================

async function loadRecentBookings() {

  try {

    const response =
      await adminFetch(BOOKINGS_API);

    if (!response.ok) {
      throw new Error(
        `Bookings API: ${response.status}`
      );
    }

    const data =
      await response.json();

    recentBookings =
      Array.isArray(data.bookings)
        ? data.bookings
        : [];

    renderRecentBookings();

  } catch (error) {

    console.error(
      "Load recent bookings failed:",
      error
    );

    const table =
      document.getElementById(
        "recentBookingTable"
      );

    if (
      table &&
      recentBookings.length === 0
    ) {

      table.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="text-align:center;padding:28px"
          >
            Unable to load bookings.
          </td>
        </tr>
      `;

    }
  }
}

// ==========================================
// VIEW BOOKING DETAILS
// ==========================================

function viewBooking(id) {

  const booking =
    recentBookings.find(
      item =>
        String(item._id) === String(id)
    );

  if (!booking) return;

  const status =
    String(
      booking.status || "Confirmed"
    ).toLowerCase();

  const fields = [

    {
      label: "Ticket ID",
      value:
        booking.ticketId ||
        String(booking._id)
    },

    {
      label: "Passenger",
      value:
        getBookingPassenger(booking)
    },

    {
      label: "Email",
      value:
        booking.email || "N/A"
    },

    {
      label: "Route",
      value:
        getBookingRoute(booking)
    },

    {
      label: "Seat",
      value:
        getBookingSeats(booking)
    },

    {
      label: "Booking Date",
      value:
        getBookingDate(booking)
    },

    {
      label: "Amount",
      value:
        `Rs. ${getBookingAmount(booking)}`
    },

    {
      label: "Status",
      value:
        booking.status || "Confirmed",
      badge: status
    }

  ];

  // Journey Date is a different date.

  if (
    booking.journeyDate ||
    booking.travelDate
  ) {

    fields.splice(
      6,
      0,
      {
        label: "Journey Date",
        value:
          booking.journeyDate ||
          booking.travelDate
      }
    );

  }

  showDetailModal(
    "Booking Details",
    fields
  );

}

// ==========================================
// VIEW BUTTON CLICK
// ==========================================

document.getElementById(
  "recentBookingTable"
)?.addEventListener(
  "click",
  function (event) {

    const button =
      event.target.closest(
        "button[data-booking-id]"
      );

    if (button) {
      viewBooking(
        button.dataset.bookingId
      );
    }

  }
);

// ==========================================
// LIVE SEARCH
// ==========================================

document.getElementById(
  "recentBookingSearch"
)?.addEventListener(
  "input",
  renderRecentBookings
);

// ==========================================
// CLEAR SEARCH
// ==========================================

document.getElementById(
  "clearRecentSearch"
)?.addEventListener(
  "click",
  function () {

    const search =
      document.getElementById(
        "recentBookingSearch"
      );

    if (!search) return;

    search.value = "";

    renderRecentBookings();

    search.focus();

  }
);

// ==========================================
// ADMIN LOGOUT
// ==========================================

function logout() {

  if (
    confirm("Logout from Admin Panel?")
  ) {

    localStorage.removeItem(
      "adminToken"
    );

    localStorage.removeItem(
      "adminEmail"
    );

    window.location.href =
      "admin-login.html";

  }
}

// ==========================================
// ADMIN PROFILE PHOTO
// ==========================================

function loadAdminPhoto() {

  const savedPhoto =
    localStorage.getItem(
      "adminPhoto"
    );

  const photo =
    document.getElementById(
      "dashboardAdminPhoto"
    );

  if (savedPhoto && photo) {
    photo.src = savedPhoto;
  }

}

// ==========================================
// INITIAL LOAD
// ==========================================

loadStats();
loadRecentBookings();
loadAdminPhoto();

// ==========================================
// REFRESH EVERY 30 SECONDS
// ==========================================

setInterval(
  function () {

    loadStats();
    loadRecentBookings();

  },
  30000
);
