const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");
  const busLayout = document.getElementById("busLayout");
  const selectedSeatsText = document.getElementById("selectedSeats");
  const totalFareText = document.getElementById("totalFare");
  const proceedBtn = document.getElementById("proceedBtn");

  if (!seatModal || !busLayout) return; // not on a page with the seat modal

  let selectedSeats = [];
  let currentBus = null;
  let currentDate = null;
  let fare = 0;

  function renderSeats(pattern, counterSeats, bookedSeats) {
    busLayout.innerHTML = "";
    selectedSeats = [];
    selectedSeatsText.textContent = "[ 00 ]";
    totalFareText.textContent = "00";

    pattern.forEach((no) => {
      const seat = document.createElement("div");

      if (no === "x") {
        seat.className = "seat empty";
        busLayout.appendChild(seat);
        return;
      }

      seat.className = "seat";
      seat.innerHTML = `${no}<span class="handle"></span>`;

      if (counterSeats.includes(no)) {
        seat.classList.add("counter");
      }

      if (bookedSeats.includes(no)) {
        seat.classList.add("booked");
      }

      seat.addEventListener("click", () => {
        if (seat.classList.contains("booked") || seat.classList.contains("counter")) {
          return;
        }

        seat.classList.toggle("processing");

        if (selectedSeats.includes(no)) {
          selectedSeats = selectedSeats.filter((s) => s !== no);
        } else {
          selectedSeats.push(no);
        }

        selectedSeatsText.textContent = selectedSeats.length
          ? `[ ${selectedSeats.join(", ")} ]`
          : "[ 00 ]";
        totalFareText.textContent = selectedSeats.length * fare;
      });

      busLayout.appendChild(seat);
    });
  }

  // Exposed globally so result.js can open the modal for a specific bus.
  window.openSeatModal = async function (bus, journeyDate) {
    currentBus = bus;
    currentDate = journeyDate;
    fare = bus.fare;

    const modalBoarding = document.getElementById("modalBoarding");
    const modalDropping = document.getElementById("modalDropping");
    if (modalBoarding) modalBoarding.textContent = bus.from;
    if (modalDropping) modalDropping.textContent = bus.to;

    busLayout.innerHTML = "<p>Loading seats...</p>";
    seatModal.classList.add("show");

    if (!journeyDate) {
      busLayout.innerHTML = "<p>Please go back and pick a travel date first.</p>";
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/buses/${bus.id}/seats?date=${encodeURIComponent(journeyDate)}`
      );
      const data = await res.json();

      if (!data.success) {
        busLayout.innerHTML = `<p>${data.message || "Could not load seats."}</p>`;
        return;
      }

      renderSeats(data.pattern, data.counterSeats, data.bookedSeats);
    } catch (error) {
      busLayout.innerHTML = "<p>Could not reach the booking server.</p>";
      console.error(error);
    }
  };

  closeSeat?.addEventListener("click", () => {
    seatModal.classList.remove("show");
  });

  proceedBtn?.addEventListener("click", () => {
    if (!currentBus || selectedSeats.length === 0) {
      showToast("Please select at least one seat.", "error");
      return;
    }

    const pendingBooking = {
      busId: currentBus.id,
      busNo: currentBus.busNo,
      from: currentBus.from,
      to: currentBus.to,
      departTime: currentBus.depart,
      arriveTime: currentBus.arrive,
      journeyDate: currentDate,
      seats: selectedSeats,
      fare,
      totalFare: selectedSeats.length * fare,
      boardingPoint: currentBus.from,
      droppingPoint: currentBus.to,
    };

    localStorage.setItem("pendingBooking", JSON.stringify(pendingBooking));
    window.location.href = "booking-details.html";
  });
});
