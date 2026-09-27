const API_BASE = "http://localhost:5000/api";

const user = JSON.parse(
  localStorage.getItem("user") || "null"
);

const ticketGrid =
  document.getElementById("ticketGrid");


// ======================================================
// LOGIN CHECK
// ======================================================

if (!user) {
  showToast(
    "Please login first",
    "error"
  );

  setTimeout(() => {
    window.location.href =
      "login.html";
  }, 1500);
}


// ======================================================
// AUTH HEADER
// ======================================================

function authHeaders() {
  return {
    Authorization:
      `Bearer ${localStorage.getItem("userToken")}`,
  };
}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ======================================================
// STATUS CLASS
// ======================================================

function getStatusClass(status) {
  switch (status) {
    case "Paid":
      return "paid";

    case "Cancelled":
      return "cancelled";

    case "Expired":
      return "expired";

    case "Pending":
    default:
      return "pending";
  }
}


// ======================================================
// CHECK WHETHER HOLD IS STILL ACTIVE
// ======================================================

function isPendingHoldActive(booking) {
  if (
    booking.status !== "Pending" ||
    !booking.holdExpiresAt
  ) {
    return false;
  }

  return (
    new Date(
      booking.holdExpiresAt
    ).getTime() > Date.now()
  );
}


// ======================================================
// LOAD BOOKINGS
// ======================================================

async function loadBookings() {
  const token =
    localStorage.getItem(
      "userToken"
    );


  if (!token || !user?.id) {
    showSessionExpired();

    return;
  }


  try {
    const res = await fetch(
      `${API_BASE}/bookings/user/${user.id}`,
      {
        headers:
          authHeaders(),
      }
    );


    if (
      res.status === 401 ||
      res.status === 403
    ) {
      localStorage.removeItem(
        "userToken"
      );

      showSessionExpired();

      return;
    }


    const data =
      await res.json();


    if (!data.success) {
      ticketGrid.innerHTML =
        `<h2>${escapeHtml(
          data.message ||
          "Could not load your bookings."
        )}</h2>`;

      return;
    }


    const bookings =
      Array.isArray(
        data.bookings
      )
        ? data.bookings
        : [];


    if (
      bookings.length === 0
    ) {
      updateStats([]);

      ticketGrid.innerHTML = `
        <div class="empty-history">
          <i class="fa-solid fa-ticket"></i>

          <h2>
            No booking history found
          </h2>

          <p>
            Your bookings will appear here.
          </p>

          <a
            href="home.html"
            class="new-trip-btn"
          >
            Book a Trip
          </a>
        </div>
      `;

      return;
    }


    updateStats(
      bookings
    );


    ticketGrid.innerHTML =
      bookings
        .map(
          createBookingCard
        )
        .join("");


  } catch (error) {
    console.error(
      "Booking history error:",
      error
    );


    ticketGrid.innerHTML = `
      <h2>
        Could not reach the server.
        Please try again.
      </h2>
    `;
  }
}


// ======================================================
// UPDATE STATS
//
// Only successful Paid bookings count.
// ======================================================

function updateStats(bookings) {
  const paidBookings =
    bookings.filter(
      (booking) =>
        booking.status ===
        "Paid"
    );


  // ----------------------------------------------------
  // TOTAL TRIPS
  // ----------------------------------------------------

  const totalTrips =
    document.getElementById(
      "totalTrips"
    );


  if (totalTrips) {
    totalTrips.textContent =
      paidBookings.length;
  }


  // ----------------------------------------------------
  // TOTAL SPENT
  // ----------------------------------------------------

  const totalSpent =
    paidBookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.totalFare ||
          0
        ),

      0
    );


  const totalSpentElement =
    document.getElementById(
      "totalSpent"
    );


  if (totalSpentElement) {
    totalSpentElement.textContent =
      `Rs. ${totalSpent}`;
  }


  // ----------------------------------------------------
  // LAST CONFIRMED TRIP
  // ----------------------------------------------------

  const lastTrip =
    document.getElementById(
      "lastTrip"
    );


  if (!lastTrip) {
    return;
  }


  if (
    paidBookings.length === 0
  ) {
    lastTrip.textContent =
      "-";

    return;
  }


  const latestPaidBooking =
    [...paidBookings].sort(
      (a, b) =>
        new Date(
          b.paidAt ||
          b.createdAt
        ) -
        new Date(
          a.paidAt ||
          a.createdAt
        )
    )[0];


  if (
    latestPaidBooking.journeyDate
  ) {
    lastTrip.textContent =
      latestPaidBooking
        .journeyDate;

  } else {
    lastTrip.textContent =
      new Date(
        latestPaidBooking.createdAt
      ).toLocaleDateString();
  }
}


// ======================================================
// CREATE BOOKING CARD
// ======================================================

function createBookingCard(booking) {
  const ticketId =
    booking.ticketId ||
    (
      "RB" +
      String(
        booking._id
      )
        .slice(-6)
        .toUpperCase()
    );


  let displayStatus =
    booking.status ||
    "Pending";


  /*
    Backend cleanup every few seconds run aagum.

    But user page exact expiry moment-la open pannina,
    client side-la immediately Expired nu show pannalam.
  */
  const holdExpiredLocally =
    displayStatus ===
      "Pending" &&
    booking.holdExpiresAt &&
    new Date(
      booking.holdExpiresAt
    ).getTime() <=
      Date.now();


  if (
    holdExpiredLocally
  ) {
    displayStatus =
      "Expired";
  }


  const statusClass =
    getStatusClass(
      displayStatus
    );


  // ----------------------------------------------------
  // ACTION BUTTONS
  // ----------------------------------------------------

  let actionButtons = "";


  // PAID
  if (
    displayStatus ===
    "Paid"
  ) {
    actionButtons = `
      <button
        class="pdf-btn"
        onclick="downloadTicketPdf(
          '${booking._id}',
          '${ticketId}'
        )"
      >
        <i class="fa-solid fa-download"></i>
        PDF
      </button>
    `;
  }


  // PENDING + HOLD STILL ACTIVE
  else if (
    displayStatus ===
      "Pending" &&
    isPendingHoldActive(
      booking
    )
  ) {
    actionButtons = `
      <button
        class="continue-payment-btn"
        onclick="continuePayment(
          '${booking._id}'
        )"
      >
        <i class="fa-solid fa-credit-card"></i>
        Continue Payment
      </button>

      <button
        class="cancel-btn"
        onclick="cancelBooking(
          '${booking._id}'
        )"
      >
        <i class="fa-solid fa-ban"></i>
        Cancel
      </button>
    `;
  }


  // CANCELLED / EXPIRED
  else {
    actionButtons = `
      <span class="no-action-text">
        No action available
      </span>
    `;
  }


  // ----------------------------------------------------
  // HOLD INFORMATION
  // ----------------------------------------------------

  let holdInfo = "";


  if (
    displayStatus ===
      "Pending" &&
    booking.holdExpiresAt
  ) {
    const holdUntil =
      new Date(
        booking.holdExpiresAt
      ).toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );


    holdInfo = `
      <p class="hold-info">
        Hold until:
        <b>${holdUntil}</b>
      </p>
    `;
  }


  return `
    <div class="ticket-card">

      <div class="ticket-info">

        <span class="ticket-id">
          ${escapeHtml(ticketId)}
        </span>


        <h3>
          ${escapeHtml(
            booking.boardingPoint ||
            booking.from ||
            "-"
          )}

          <i
            class="fa-solid fa-arrow-right-long"
          ></i>

          ${escapeHtml(
            booking.droppingPoint ||
            booking.to ||
            "-"
          )}
        </h3>


        <p>
          Passenger:
          <b>
            ${escapeHtml(
              booking.passengerName ||
              "-"
            )}
          </b>
        </p>


        <p>
          Travel Date:
          <b>
            ${escapeHtml(
              booking.journeyDate ||
              "-"
            )}
          </b>
        </p>


        <p>
          Seats:
          <b>
            ${escapeHtml(
              booking.selectedSeats ||
              (
                booking.seats ||
                []
              ).join(", ") ||
              "-"
            )}
          </b>
        </p>


        <p>
          Fare:
          <b>
            Rs. ${Number(
              booking.totalFare ||
              0
            )}
          </b>
        </p>


        ${holdInfo}

      </div>


      <div class="ticket-action">

        <span class="${statusClass}">
          ${escapeHtml(
            displayStatus
          )}
        </span>


        ${actionButtons}

      </div>

    </div>
  `;
}


// ======================================================
// CONTINUE EXISTING PAYMENT
// ======================================================

async function continuePayment(
  bookingId
) {
  try {
    const res =
      await fetch(
        `${API_BASE}/bookings/${bookingId}`,
        {
          headers:
            authHeaders(),
        }
      );


    const data =
      await res.json();


    if (!data.success) {
      showToast(
        data.message ||
        "Could not load booking",
        "error"
      );

      return;
    }


    const booking =
      data.booking;


    // Must still be Pending
    if (
      booking.status !==
      "Pending"
    ) {
      showToast(
        `This booking is ${booking.status}.`,
        "error"
      );

      loadBookings();

      return;
    }


    // Check hold expiry
    if (
      !booking.holdExpiresAt ||
      new Date(
        booking.holdExpiresAt
      ).getTime() <=
        Date.now()
    ) {
      showToast(
        "This seat hold has expired.",
        "error"
      );

      loadBookings();

      return;
    }


    // Save booking for payment.js
    localStorage.setItem(
      "currentBooking",
      JSON.stringify(
        booking
      )
    );


    localStorage.setItem(
      "holdExpiresAt",
      booking.holdExpiresAt
    );


    window.location.href =
      "payment.html";


  } catch (error) {
    console.error(
      "Continue payment error:",
      error
    );


    showToast(
      "Could not reach the server.",
      "error"
    );
  }
}


// ======================================================
// CANCEL BOOKING
// ======================================================

async function cancelBooking(
  bookingId
) {
  const confirmed =
    confirm(
      "Are you sure you want to cancel this pending booking?"
    );


  if (!confirmed) {
    return;
  }


  try {
    const res =
      await fetch(
        `${API_BASE}/bookings/cancel/${bookingId}`,
        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json",

            ...authHeaders(),
          },
        }
      );


    const data =
      await res.json();


    if (!data.success) {
      showToast(
        data.message ||
        "Cancellation failed",
        "error"
      );

      return;
    }


    // Remove current booking if same booking
    const currentBooking =
      JSON.parse(
        localStorage.getItem(
          "currentBooking"
        ) || "null"
      );


    if (
      String(
        currentBooking?._id
      ) ===
      String(
        bookingId
      )
    ) {
      localStorage.removeItem(
        "currentBooking"
      );

      localStorage.removeItem(
        "holdExpiresAt"
      );
    }


    showToast(
      "Booking cancelled successfully",
      "success"
    );


    await loadBookings();


  } catch (error) {
    console.error(
      "Cancellation error:",
      error
    );


    showToast(
      "Could not reach the server. Please try again.",
      "error"
    );
  }
}


// ======================================================
// DOWNLOAD PAID TICKET PDF
// ======================================================

async function downloadTicketPdf(
  bookingId,
  ticketId
) {
  try {
    const res =
      await fetch(
        `${API_BASE}/bookings/${bookingId}/pdf`,
        {
          headers:
            authHeaders(),
        }
      );


    if (
      res.status === 401 ||
      res.status === 403
    ) {
      localStorage.removeItem(
        "userToken"
      );


      showToast(
        "Your session has expired. Please login again.",
        "error"
      );


      setTimeout(() => {
        window.location.href =
          "login.html";
      }, 1500);


      return;
    }


    if (!res.ok) {
      const data =
        await res
          .json()
          .catch(
            () => ({})
          );


      showToast(
        data.message ||
        "Could not generate the ticket PDF.",
        "error"
      );


      return;
    }


    const blob =
      await res.blob();


    const url =
      window.URL
        .createObjectURL(
          blob
        );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      `${ticketId}.pdf`;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    window.URL
      .revokeObjectURL(
        url
      );


  } catch (error) {
    console.error(
      "PDF error:",
      error
    );


    showToast(
      "Could not reach the server. Please try again.",
      "error"
    );
  }
}


// ======================================================
// SESSION EXPIRED UI
// ======================================================

function showSessionExpired() {
  if (!ticketGrid) {
    return;
  }


  ticketGrid.innerHTML = `
    <div class="empty-history">

      <h2>
        Your session has expired.
      </h2>

      <p>
        Please login again to view your bookings.
      </p>

      <a
        href="login.html"
        class="new-trip-btn"
      >
        Login
      </a>

    </div>
  `;
}


// ======================================================
// START
// ======================================================

if (
  user &&
  ticketGrid
) {
  loadBookings();
}