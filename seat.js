
const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");
  const busLayout = document.getElementById("busLayout");
  const selectedSeatsText =
    document.getElementById("selectedSeats");
  const totalFareText =
    document.getElementById("totalFare");
  const proceedBtn =
    document.getElementById("proceedBtn");

  if (!seatModal || !busLayout) return;

  // =====================================================
  // STATE
  // =====================================================

  let selectedSeats = [];
  let currentBus = null;
  let currentDate = null;
  let fare = 0;

  let realtimeStream = null;
  let seatMapReady = false;
  let queuedRealtimeUpdates = [];

  let session = 0;
  let seatFetchController = null;

  // =====================================================
  // NOTIFICATION
  // =====================================================

  function notify(message, type = "error") {
    if (typeof showToast === "function") {
      showToast(message, type);
    } else {
      alert(message);
    }
  }

  // =====================================================
  // UPDATE SELECTION AND FARE
  // =====================================================

  function updateSummary() {
    if (selectedSeatsText) {
      selectedSeatsText.textContent = selectedSeats.length
        ? `[ ${selectedSeats.join(", ")} ]`
        : "[ 00 ]";
    }

    if (totalFareText) {
      totalFareText.textContent = String(
        selectedSeats.length * fare
      );
    }

    if (proceedBtn) {
      proceedBtn.disabled =
        !seatMapReady || selectedSeats.length === 0;
    }
  }

  // =====================================================
  // CLOSE SSE CONNECTION
  // =====================================================

  function closeRealtimeConnection() {
    if (realtimeStream) {
      realtimeStream.close();
      realtimeStream = null;
    }
  }

  // =====================================================
  // CANCEL OLD FETCH REQUEST
  // =====================================================

  function stopSeatFetch() {
    if (seatFetchController) {
      seatFetchController.abort();
      seatFetchController = null;
    }
  }

  function isActiveSession(openSession) {
    return (
      session === openSession &&
      seatModal.classList.contains("show") &&
      currentBus !== null
    );
  }

  // =====================================================
  // REMOVE SEAT FROM GREEN SELECTION
  // =====================================================

  function removeFromSelection(seatNumber) {
    const number = String(seatNumber);

    if (!selectedSeats.includes(number)) {
      return false;
    }

    selectedSeats = selectedSeats.filter(
      (seat) => seat !== number
    );

    updateSummary();
    return true;
  }

  // =====================================================
  // APPLY REAL-TIME SEAT UPDATE
  //
  // held     = ORANGE
  // booked   = RED
  // released = AVAILABLE
  // =====================================================

  function applyRealtimeUpdate(update) {
    if (!currentBus || !currentDate || !update) {
      return;
    }

    // Only accept updates from the selected trip.
    if (
      String(update.tripId || "") !==
        String(currentBus.tripId) ||
      String(update.busId || "") !==
        String(currentBus.id) ||
      String(update.journeyDate || "") !==
        String(currentDate)
    ) {
      return;
    }

    // Queue updates while seat map is loading.
    if (!seatMapReady) {
      queuedRealtimeUpdates.push(update);
      return;
    }

    const seats = Array.isArray(update.seats)
      ? update.seats
      : [];

    for (const seatNo of seats) {
      const seatNumber = String(seatNo);

      const seatElement = [
        ...busLayout.querySelectorAll(
          ".seat[data-seat]"
        ),
      ].find(
        (element) =>
          element.dataset.seat === seatNumber
      );

      if (!seatElement) continue;

      // Fixed counter seats cannot change.
      if (
        seatElement.classList.contains("counter")
      ) {
        continue;
      }

      // -----------------------------------------------
      // HELD - ORANGE
      // -----------------------------------------------

      if (update.action === "held") {
        // Never downgrade an already booked seat.
        if (
          seatElement.classList.contains("booked")
        ) {
          continue;
        }

        const wasSelected =
          removeFromSelection(seatNumber);

        seatElement.classList.remove("processing");
        seatElement.classList.add("held");

        if (wasSelected) {
          notify(
            `Seat ${seatNumber} is temporarily held by another passenger.`
          );
        }
      }

      // -----------------------------------------------
      // BOOKED - RED
      // -----------------------------------------------

      else if (update.action === "booked") {
        const wasSelected =
          removeFromSelection(seatNumber);

        seatElement.classList.remove(
          "processing",
          "held"
        );

        seatElement.classList.add("booked");

        if (wasSelected) {
          notify(
            `Seat ${seatNumber} has been booked by another passenger.`
          );
        }
      }

      // -----------------------------------------------
      // RELEASED - AVAILABLE
      // -----------------------------------------------

      else if (update.action === "released") {
        seatElement.classList.remove(
          "held",
          "booked",
          "processing"
        );
      }
    }

    updateSummary();
  }

  // =====================================================
  // RENDER SEAT MAP
  //
  // processing = GREEN
  // held       = ORANGE
  // booked     = RED
  // counter    = FIXED COUNTER SEAT
  // =====================================================

  function renderSeats(
    pattern,
    counterSeats,
    heldSeats,
    bookedSeats,
    preserveSelection
  ) {
    const previousSelection = preserveSelection
      ? [...selectedSeats]
      : [];

    selectedSeats = [];
    busLayout.innerHTML = "";

    const counterSet = new Set(
      (counterSeats || []).map(String)
    );

    const heldSet = new Set(
      (heldSeats || []).map(String)
    );

    const bookedSet = new Set(
      (bookedSeats || []).map(String)
    );

    for (const no of pattern || []) {
      const seat = document.createElement("div");

      // -----------------------------------------------
      // EMPTY / AISLE
      // -----------------------------------------------

      if (no === "x") {
        seat.className = "seat empty";
        busLayout.appendChild(seat);
        continue;
      }

      const seatNo = String(no);

      seat.className = "seat";
      seat.dataset.seat = seatNo;

      seat.appendChild(
        document.createTextNode(seatNo)
      );

      const handle =
        document.createElement("span");

      handle.className = "handle";
      seat.appendChild(handle);

      // -----------------------------------------------
      // EXISTING SEAT STATES
      // -----------------------------------------------

      if (counterSet.has(seatNo)) {
        seat.classList.add("counter");
      } else if (bookedSet.has(seatNo)) {
        seat.classList.add("booked");
      } else if (heldSet.has(seatNo)) {
        seat.classList.add("held");
      } else if (
        previousSelection.includes(seatNo)
      ) {
        seat.classList.add("processing");
        selectedSeats.push(seatNo);
      }

      // -----------------------------------------------
      // SEAT CLICK
      // -----------------------------------------------

      seat.addEventListener("click", () => {
        if (!seatMapReady) {
          return;
        }

        if (
          seat.classList.contains("counter") ||
          seat.classList.contains("booked") ||
          seat.classList.contains("held")
        ) {
          return;
        }

        if (selectedSeats.includes(seatNo)) {
          removeFromSelection(seatNo);
          seat.classList.remove("processing");
        } else {
          selectedSeats.push(seatNo);
          seat.classList.add("processing");
        }

        updateSummary();
      });

      busLayout.appendChild(seat);
    }

    // -----------------------------------------------
    // APPLY EVENTS RECEIVED WHILE LOADING
    // -----------------------------------------------

    seatMapReady = true;

    const updates = queuedRealtimeUpdates;
    queuedRealtimeUpdates = [];

    for (const update of updates) {
      applyRealtimeUpdate(update);
    }

    updateSummary();
  }

  // =====================================================
  // LOAD SEATS FROM BACKEND
  //
  // IMPORTANT:
  // Uses busId + date + tripId.
  // =====================================================

  async function loadSeatMap(
    openSession,
    preserveSelection = false
  ) {
    if (!isActiveSession(openSession)) {
      return false;
    }

    stopSeatFetch();

    const controller = new AbortController();
    seatFetchController = controller;

    seatMapReady = false;
    queuedRealtimeUpdates = [];

    updateSummary();

    const busId = currentBus.id;
    const tripId = currentBus.tripId;
    const journeyDate = currentDate;

    const url =
      `${API_BASE}/buses/${encodeURIComponent(busId)}/seats` +
      `?date=${encodeURIComponent(journeyDate)}` +
      `&tripId=${encodeURIComponent(tripId)}`;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      const data = await response.json();

      if (
        !isActiveSession(openSession) ||
        controller.signal.aborted
      ) {
        return false;
      }

      if (!response.ok || !data.success) {
        busLayout.textContent =
          data.message || "Could not load seats.";

        return false;
      }

      // Verify backend returned the same trip.
      if (
        String(data.tripId || "") !==
        String(tripId)
      ) {
        busLayout.textContent =
          "Seat data does not match the selected trip.";

        return false;
      }

      // Use the fare returned by the server.
      if (
        Number.isFinite(Number(data.bus?.fare))
      ) {
        fare = Number(data.bus.fare);
      }

      renderSeats(
        data.pattern || [],
        data.counterSeats || [],
        data.heldSeats || [],
        data.bookedSeats || [],
        preserveSelection
      );

      return true;

    } catch (error) {
      if (error.name === "AbortError") {
        return false;
      }

      console.error(
        "Seat loading error:",
        error
      );

      if (isActiveSession(openSession)) {
        busLayout.textContent =
          "Could not reach the booking server.";
      }

      return false;

    } finally {
      if (seatFetchController === controller) {
        seatFetchController = null;
      }
    }
  }

  // =====================================================
  // CONNECT TO TRIP-SPECIFIC REAL-TIME SERVER
  // =====================================================

  function connectRealtimeUpdates(openSession) {
    closeRealtimeConnection();

    if (
      !isActiveSession(openSession) ||
      !currentBus?.tripId
    ) {
      return;
    }

    const url =
      `${API_BASE}/realtime/seats` +
      `?tripId=${encodeURIComponent(currentBus.tripId)}` +
      `&busId=${encodeURIComponent(currentBus.id)}` +
      `&date=${encodeURIComponent(currentDate)}`;

    console.log(
      "Connecting real-time:",
      url
    );

    const stream = new EventSource(url);
    realtimeStream = stream;

    // -----------------------------------------------
    // CONNECTED
    //
    // Reload seats after connection/reconnection
    // to recover updates missed while disconnected.
    // -----------------------------------------------

    stream.addEventListener(
      "connected",
      (event) => {
        if (
          !isActiveSession(openSession) ||
          realtimeStream !== stream
        ) {
          return;
        }

        console.log(
          "Real-time connected:",
          event.data
        );

        loadSeatMap(openSession, true);
      }
    );

    // -----------------------------------------------
    // SEAT UPDATE
    // -----------------------------------------------

    stream.addEventListener(
      "seat-update",
      (event) => {
        if (
          !isActiveSession(openSession) ||
          realtimeStream !== stream
        ) {
          return;
        }

        try {
          const update = JSON.parse(event.data);
          applyRealtimeUpdate(update);
        } catch (error) {
          console.error(
            "Invalid real-time seat update:",
            error
          );
        }
      }
    );

    stream.onerror = () => {
      if (isActiveSession(openSession)) {
        console.warn(
          "Real-time connection interrupted; reconnecting..."
        );
      }
    };
  }

  // =====================================================
  // CLOSE SEAT MODAL
  // =====================================================

  function closeModal() {
    session++;

    stopSeatFetch();
    closeRealtimeConnection();

    seatModal.classList.remove("show");

    seatMapReady = false;
    queuedRealtimeUpdates = [];
    selectedSeats = [];

    currentBus = null;
    currentDate = null;
    fare = 0;

    updateSummary();
  }

  // =====================================================
  // OPEN SEAT MODAL
  //
  // Called by result.js:
  // openSeatModal(bus, journeyDate)
  // =====================================================

  window.openSeatModal = async function (
    bus,
    journeyDate
  ) {
    session++;
    const openSession = session;

    stopSeatFetch();
    closeRealtimeConnection();

    const busId =
      bus?.id ?? bus?.busId ?? bus?._id;

    const tripId = bus?.tripId;

    currentBus = bus
      ? {
          ...bus,

          id: busId
            ? String(busId)
            : "",

          tripId: tripId
            ? String(tripId)
            : "",
        }
      : null;

    currentDate = journeyDate
      ? String(journeyDate)
      : "";

    fare = Number(
      bus?.fare ?? bus?.fareMin ?? 0
    );

    if (
      !Number.isFinite(fare) ||
      fare < 0
    ) {
      fare = 0;
    }

    selectedSeats = [];
    queuedRealtimeUpdates = [];
    seatMapReady = false;

    updateSummary();

    // -----------------------------------------------
    // BOARDING AND DROPPING
    // -----------------------------------------------

    const modalBoarding =
      document.getElementById("modalBoarding");

    const modalDropping =
      document.getElementById("modalDropping");

    if (modalBoarding) {
      modalBoarding.textContent =
        bus?.from || "";
    }

    if (modalDropping) {
      modalDropping.textContent =
        bus?.to || "";
    }

    seatModal.classList.add("show");
    busLayout.textContent = "Loading seats...";

    // -----------------------------------------------
    // VALIDATE SELECTED TRIP
    // -----------------------------------------------

    if (!currentDate) {
      busLayout.textContent =
        "Please select a journey date first.";

      return;
    }

    if (!currentBus?.id) {
      busLayout.textContent =
        "Bus information is missing.";

      return;
    }

    if (!currentBus.tripId) {
      busLayout.textContent =
        "Trip ID is missing. Select a scheduled trip from search results.";

      return;
    }

    console.log("Opening seat map:", {
      tripId: currentBus.tripId,
      busId: currentBus.id,
      journeyDate: currentDate,
    });

    // -----------------------------------------------
    // INITIAL SEAT MAP
    // -----------------------------------------------

    const loaded = await loadSeatMap(
      openSession,
      false
    );

    // Connect real-time only after the seat map loads.
    if (
      loaded &&
      isActiveSession(openSession)
    ) {
      connectRealtimeUpdates(openSession);
    }
  };

  // =====================================================
  // CLOSE BUTTON
  // =====================================================

  closeSeat?.addEventListener(
    "click",
    closeModal
  );

  // =====================================================
  // CLICK OUTSIDE MODAL
  // =====================================================

  seatModal.addEventListener(
    "click",
    (event) => {
      if (event.target === seatModal) {
        closeModal();
      }
    }
  );

  // =====================================================
  // PROCEED TO PASSENGER DETAILS
  // =====================================================

  proceedBtn?.addEventListener(
    "click",
    () => {
      if (
        !seatMapReady ||
        !currentBus?.tripId ||
        !currentDate
      ) {
        notify(
          "Please select a valid scheduled trip first."
        );

        return;
      }

      if (selectedSeats.length === 0) {
        notify(
          "Please select at least one seat."
        );

        return;
      }

      if (
        !Number.isFinite(fare) ||
        fare <= 0
      ) {
        notify(
          "The selected trip does not have a valid payable fare."
        );

        return;
      }

      // ---------------------------------------------
      // BUILD PENDING BOOKING
      // ---------------------------------------------

      const pendingBooking = {
        tripId: currentBus.tripId,

        busId: currentBus.id,
        busNo: currentBus.busNo,
        regNo: currentBus.regNo || "",
        type: currentBus.type || "",

        from: currentBus.from,
        to: currentBus.to,

        departTime: currentBus.depart,
        arriveTime: currentBus.arrive,

        journeyDate: currentDate,

        seats: [...selectedSeats],

        fare,

        totalFare:
          selectedSeats.length * fare,

        boardingPoint: currentBus.from,
        droppingPoint: currentBus.to,
      };

      console.log(
        "Pending Booking:",
        pendingBooking
      );

      // ---------------------------------------------
      // SAVE SELECTED BOOKING
      // ---------------------------------------------

      localStorage.setItem(
        "pendingBooking",
        JSON.stringify(pendingBooking)
      );

      localStorage.setItem(
        "selectedTrip",
        JSON.stringify(currentBus)
      );

      // ---------------------------------------------
      // GO TO PASSENGER DETAILS
      // ---------------------------------------------

      stopSeatFetch();
      closeRealtimeConnection();

      window.location.href =
        "booking-details.html";
    }
  );

  // =====================================================
  // PAGE CLOSE / REFRESH
  // =====================================================

  window.addEventListener(
    "beforeunload",
    () => {
      stopSeatFetch();
      closeRealtimeConnection();
    }
  );
});
