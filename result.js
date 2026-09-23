// API_BASE is already declared in seat.js, which loads before this file on result.html
const params = new URLSearchParams(window.location.search);
const district = params.get("district") || "";
const travelDate = params.get("date") || "";
const busType = params.get("bus") || "";

document.getElementById("districtName").textContent = district || "-";
document.getElementById("travelDate").textContent = travelDate || "-";
document.getElementById("busType").textContent = busType || "Any";

const resultsSection = document.getElementById("resultsSection");

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function busCardHtml(bus) {
  const seatCount = bus.availableSeats ?? 40;
  const low = seatCount <= 10 ? " low" : "";

  return `
    <div class="bus-card">
      <div class="card-top">
        <div>
          <h2>${escapeHtml(bus.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHtml(bus.to)}</h2>
          <p>Bus No: <b>${escapeHtml(bus.busNo)}</b> &middot; ${escapeHtml(bus.type)}</p>
        </div>
        <span class="seat-badge${low}">${seatCount} Seats</span>
      </div>

      <div class="bus-info">
        <div><i class="fa-regular fa-clock"></i><span>Departure</span><b>${escapeHtml(bus.depart)}</b></div>
        <div><i class="fa-solid fa-clock"></i><span>Arrival</span><b>${escapeHtml(bus.arrive)}</b></div>
        <div><i class="fa-solid fa-road"></i><span>Distance</span><b>${bus.distanceKm} KM</b></div>
        <div><i class="fa-solid fa-ticket"></i><span>Fare</span><b>Rs. ${bus.fareMin}</b></div>
      </div>

      <button class="book-btn"
        data-bus-id="${bus.id || bus._id}"
        data-bus-no="${escapeHtml(bus.busNo)}"
        data-from="${escapeHtml(bus.from)}"
        data-to="${escapeHtml(bus.to)}"
        data-depart="${escapeHtml(bus.depart)}"
        data-arrive="${escapeHtml(bus.arrive)}"
        data-fare="${bus.fareMin}"
        ${seatCount <= 0 ? "disabled" : ""}
      >${seatCount <= 0 ? "Fully Booked" : "Book Now"}</button>
    </div>
  `;
}

async function loadBuses() {
  if (!district) {
    resultsSection.innerHTML = `<p>Please go back and choose a destination district.</p>`;
    return;
  }

  try {
    const qs = new URLSearchParams({ to: district });

    if (busType) {
      qs.set("type", busType);
    }

    const url = `${API_BASE}/buses/search?${qs.toString()}`;
    console.log("Bus Search URL:", url);

    const res = await fetch(url);
    const data = await res.json();

    console.log("Bus Search Data:", data);

    if (!data.success || !data.buses || data.buses.length === 0) {
      resultsSection.innerHTML = `<p>No buses found for Mihintale → ${district}.</p>`;
      return;
    }

    resultsSection.innerHTML = data.buses.map(busCardHtml).join("");

    document.querySelectorAll(".book-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bus = {
          id: btn.dataset.busId,
          busNo: btn.dataset.busNo,
          from: btn.dataset.from,
          to: btn.dataset.to,
          depart: btn.dataset.depart,
          arrive: btn.dataset.arrive,
          fare: Number(btn.dataset.fare),
        };

        localStorage.setItem("selectedBus", JSON.stringify(bus));
        localStorage.setItem("travelDate", travelDate);

        if (typeof window.openSeatModal === "function") {
          window.openSeatModal(bus, travelDate);
        } else {
          showToast("Seat selection file not loaded", "error");
        }
      });
    });

  } catch (error) {
    console.error(error);
    resultsSection.innerHTML =
      `<p>Could not reach the booking server. Please make sure backend is running.</p>`;
  }
}

loadBuses();