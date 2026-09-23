const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  showToast("Please login first", "error");
  setTimeout(() => { window.location.href = "login.html"; }, 1500);
}

const ticketGrid = document.getElementById("ticketGrid");

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("userToken")}` };
}

async function loadBookings() {
  const token = localStorage.getItem("userToken");

  if (!token) {
    ticketGrid.innerHTML = `
      <h2>Your session has expired. Please
        <a href="login.html">login again</a> to view your bookings.
      </h2>`;
    return;
  }

  const res = await fetch(`http://localhost:5000/api/bookings/user/${user.id}`, {
    headers: authHeaders(),
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("userToken");
    ticketGrid.innerHTML = `
      <h2>Your session has expired. Please
        <a href="login.html">login again</a> to view your bookings.
      </h2>`;
    return;
  }

  const data = await res.json();

  if (!data.success) {
    ticketGrid.innerHTML = `<h2>${data.message || "Could not load your bookings."}</h2>`;
    return;
  }

  if (data.bookings.length === 0) {
    ticketGrid.innerHTML = `<h2>No booking history found</h2>`;
    return;
  }

  const bookings = data.bookings;

  document.getElementById("totalTrips").textContent = bookings.length;

  const totalSpent = bookings.reduce((sum, b) => sum + Number(b.totalFare || 0), 0);
  document.getElementById("totalSpent").textContent = `Rs. ${totalSpent}`;

  const lastDate = new Date(bookings[0].createdAt).toLocaleDateString();
  document.getElementById("lastTrip").textContent = lastDate;

  ticketGrid.innerHTML = bookings.map((b, index) => {
    const ticketId = b.ticketId || ("RB" + b._id.slice(-6).toUpperCase());
    const statusClass =
      b.status === "Paid" ? "paid" :
      b.status === "Cancelled" ? "cancelled" : "pending";

    // Only bookings that aren't already cancelled can be cancelled
    const cancelButton = b.status !== "Cancelled"
      ? `<button class="cancel-btn" onclick="cancelBooking('${b._id}')">
           <i class="fa-solid fa-ban"></i> Cancel
         </button>`
      : "";

    return `
      <div class="ticket-card">
        <div class="ticket-info">
          <span class="ticket-id">${ticketId}</span>
          <h3>${b.boardingPoint} <i class="fa-solid fa-arrow-right-long"></i> ${b.droppingPoint}</h3>
          <p>Passenger: <b>${b.passengerName}</b></p>
          <p>Travel Date: <b>${b.journeyDate || "-"}</b></p>
          <p>Seats: <b>${b.selectedSeats}</b></p>
          <p>Fare: <b>Rs. ${b.totalFare}</b></p>
        </div>

        <div class="ticket-action">
          <span class="${statusClass}">${b.status}</span>
          <button onclick="downloadTicketPdf('${b._id}', '${ticketId}')">
            <i class="fa-solid fa-download"></i> PDF
          </button>
          ${cancelButton}
        </div>
      </div>
    `;
  }).join("");
}

async function cancelBooking(bookingId) {
  if (!confirm("Are you sure you want to cancel this booking? This cannot be undone.")) {
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/bookings/cancel/${bookingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || "Cancellation failed", "error");
      return;
    }

    showToast("Booking cancelled successfully", "success");
    loadBookings();
  } catch (error) {
    console.error(error);
    showToast("Could not reach the server. Please try again.", "error");
  }
}

async function downloadTicketPdf(bookingId, ticketId) {
  try {
    const res = await fetch(`http://localhost:5000/api/bookings/${bookingId}/pdf`, {
      headers: authHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("userToken");
      showToast("Your session has expired. Please login again.", "error");
      setTimeout(() => { window.location.href = "login.html"; }, 1500);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || "Could not generate the ticket PDF. Please try again.", "error");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${ticketId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    showToast("Could not reach the server. Please try again.", "error");
  }
}

loadBookings();
