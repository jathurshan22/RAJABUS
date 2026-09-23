const API_BASE = "http://localhost:5000/api";

const user = JSON.parse(localStorage.getItem("user") || "null");
const pendingBooking = JSON.parse(localStorage.getItem("pendingBooking") || "null");

if (!pendingBooking) {
  showToast("Please search and select seats first.", "error");
  setTimeout(() => { window.location.href = "home.html"; }, 1500);
}

if (pendingBooking) {
  document.getElementById("summaryBus").textContent =
    `${pendingBooking.busNo} (${pendingBooking.departTime} - ${pendingBooking.arriveTime})`;
  document.getElementById("summaryDate").textContent = pendingBooking.journeyDate;
  document.getElementById("summarySeats").textContent = pendingBooking.seats.join(", ");
  document.getElementById("summaryBoarding").textContent = pendingBooking.boardingPoint;
  document.getElementById("summaryDropping").textContent = pendingBooking.droppingPoint;
  document.getElementById("summaryFare").textContent = `Rs.${pendingBooking.totalFare}`;
}

document.getElementById("paymentBtn").addEventListener("click", async () => {
  if (!user) {
    showToast("Please login first", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 1500);
    return;
  }

  if (!pendingBooking) return;

  const passengerName = document.getElementById("passengerName").value.trim();
  const mobileNo = document.getElementById("mobileNo").value.trim();
  const nicNo = document.getElementById("nicNo").value.trim();
  const email = document.getElementById("passengerEmail").value.trim();

  if (!passengerName || !mobileNo || !email) {
    showToast("Please fill required details", "error");
    return;
  }

  const bookingData = {
    userId: user.id,
    busId: pendingBooking.busId,
    journeyDate: pendingBooking.journeyDate,
    passengerName,
    mobileNo,
    nicNo,
    email,
    seats: pendingBooking.seats,
    boardingPoint: pendingBooking.boardingPoint,
    droppingPoint: pendingBooking.droppingPoint,
    totalFare: pendingBooking.totalFare,
  };

  try {
    const res = await fetch(`${API_BASE}/bookings/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("userToken")}`,
      },
      body: JSON.stringify(bookingData),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("currentBooking", JSON.stringify(data.booking));
      localStorage.removeItem("pendingBooking");
      window.location.href = "payment.html";
    } else {
      showToast(data.message || "Booking failed", "error");
    }
  } catch (error) {
    showToast("Could not reach the booking server. Please make sure the backend is running.", "error");
    console.error(error);
  }
});
