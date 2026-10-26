
const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // DOM ELEMENTS
  // ==========================================

  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");
  const busLayout = document.getElementById("busLayout");

  const selectedSeatsText =
    document.getElementById("selectedSeats");

  const totalFareText =
    document.getElementById("totalFare");

  const proceedBtn =
    document.getElementById("proceedBtn");

  const modalBoarding =
    document.getElementById("modalBoarding");

  const modalDropping =
    document.getElementById("modalDropping");

  if (!seatModal || !busLayout) return;

  // ==========================================
  // STATE
  // ==========================================

  let currentBus = null;
  let currentDate = "";
  let fare = 0;

  let selectedSeats = [];
  let seatMapReady = false;

  let realtimeStream = null;
  let seatFetchController = null;
  let queuedRealtimeUpdates = [];

  let session = 0;

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  function notify(message, type = "error") {

    if (typeof showToast === "function") {
      showToast(message, type);
    } else {
      alert(message);
    }
  }

  // ==========================================
  // UPDATE SELECTED SEATS & FARE
  // ==========================================

  function updateSummary() {

    if (selectedSeatsText) {

      selectedSeatsText.textContent =
        selectedSeats.length
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
        !seatMapReady ||
        selectedSeats.length === 0;
    }
  }

  // ==========================================
  // CLOSE REAL-TIME CONNECTION
  // ==========================================

  function closeRealtimeConnection() {

    if (realtimeStream) {

      realtimeStream.close();

      realtimeStream = null;
    }
  }

  // ==========================================
  // STOP PREVIOUS FETCH
  // ==========================================

  function stopSeatFetch() {

    if (seatFetchController) {

      seatFetchController.abort();

      seatFetchController = null;
    }
  }

  // ==========================================
  // CHECK ACTIVE SESSION
  // ==========================================

  function isActiveSession(openSession) {

    return (
      session === openSession &&
      seatModal.classList.contains("show") &&
      currentBus !== null
    );
  }

  // ==========================================
  // REMOVE SELECTED SEAT
  // ==========================================

  function removeFromSelection(seatNumber) {

    const number = String(seatNumber);

    const wasSelected =
      selectedSeats.includes(number);

    selectedSeats = selectedSeats.filter(
      (seat) => seat !== number
    );

    return wasSelected;
  }

  // ==========================================
  // REAL-TIME SEAT UPDATE
  // ==========================================

  function applyRealtimeUpdate(update) {

    if (!currentBus || !currentDate || !update) {
      return;
    }

    // Accept updates only for current trip.

    if (
      String(update.tripId || "") !==
        currentBus.tripId ||

      String(update.busId || "") !==
        currentBus.id ||

      String(update.journeyDate || "") !==
        currentDate
    ) {
      return;
    }

    // Queue updates while loading.

    if (!seatMapReady) {

      queuedRealtimeUpdates.push(update);

      return;
    }

    const seatElements = [
      ...busLayout.querySelectorAll(
        ".seat[data-seat]"
      )
    ];

    const seats = Array.isArray(update.seats)
      ? update.seats
      : [];

    for (const value of seats) {

      const number = String(value);

      const element = seatElements.find(
        (seat) =>
          seat.dataset.seat === number
      );

      if (!element) continue;

      if (
        element.classList.contains("counter")
      ) {
        continue;
      }

      // ======================================
      // HELD SEAT - ORANGE
      // ======================================

      if (update.action === "held") {

        if (
          element.classList.contains("booked")
        ) {
          continue;
        }

        const wasSelected =
          removeFromSelection(number);

        element.classList.remove(
          "processing"
        );

        element.classList.add("held");

        if (wasSelected) {

          notify(
            `Seat ${number} is now held by another passenger.`
          );
        }
      }

      // ======================================
      // BOOKED SEAT - RED
      // ======================================

      else if (update.action === "booked") {

        const wasSelected =
          removeFromSelection(number);

        element.classList.remove(
          "processing",
          "held"
        );

        element.classList.add("booked");

        if (wasSelected) {

          notify(
            `Seat ${number} has been booked by another passenger.`
          );
        }
      }

      // ======================================
      // RELEASED SEAT
      // ======================================

      else if (
        update.action === "released"
      ) {

        // Do not release a confirmed booked seat.

        if (
          !element.classList.contains("booked")
        ) {

          element.classList.remove("held");
        }
      }
    }

    updateSummary();
  }

  // ==========================================
  // VALIDATE DYNAMIC 50 / 54 LAYOUT
  // ==========================================

  function validateSeatLayout(data) {

    const capacity =
      Number(data.bus?.totalSeats);

    const columns =
      Number(data.columns);

    // 50 Seats -> 13 Columns
    // 54 Seats -> 11 Columns

    const validConfiguration =

      (capacity === 50 && columns === 13) ||

      (capacity === 54 && columns === 11);

    if (
      !validConfiguration ||
      !Array.isArray(data.pattern)
    ) {
      return null;
    }

    // Both reference layouts contain six rows.

    if (
      data.pattern.length !== columns * 6
    ) {
      return null;
    }

    // Count actual numbered seats.

    const numbers = data.pattern

      .filter(
        (seat) => seat !== "x"
      )

      .map(String);

    // Verify seat count and uniqueness.

    if (
      numbers.length !== capacity ||
      new Set(numbers).size !== capacity
    ) {
      return null;
    }

    // Verify numbers 01 through capacity.

    const seatSet = new Set(numbers);

    for (
      let index = 1;
      index <= capacity;
      index += 1
    ) {

      const expected =
        String(index).padStart(2, "0");

      if (!seatSet.has(expected)) {
        return null;
      }
    }

    return {
      capacity,
      columns
    };
  }

  // ==========================================
  // RENDER DYNAMIC SEAT MAP
  // ==========================================

  function renderSeats(
    pattern,
    counterSeats,
    heldSeats,
    bookedSeats,
    preserveSelection = false
  ) {

    const previousSelection =
      preserveSelection
        ? [...selectedSeats]
        : [];

    const counters = new Set(
      counterSeats.map(String)
    );

    const held = new Set(
      heldSeats.map(String)
    );

    const booked = new Set(
      bookedSeats.map(String)
    );

    selectedSeats = [];

    busLayout.innerHTML = "";

    // Pattern controls exact seat positions.

    for (const value of pattern) {

      const seat =
        document.createElement("div");

      // ======================================
      // EMPTY SPACE / WALKING AISLE
      // ======================================

      if (value === "x") {

        seat.className = "seat empty";

        busLayout.appendChild(seat);

        continue;
      }

      // ======================================
      // CREATE PHYSICAL SEAT
      // ======================================

      const number = String(value);

      seat.className = "seat";

      seat.dataset.seat = number;

      seat.appendChild(
        document.createTextNode(number)
      );

      const handle =
        document.createElement("span");

      handle.className = "handle";

      seat.appendChild(handle);

      // ======================================
      // SET SEAT STATUS
      // ======================================

      if (counters.has(number)) {

        seat.classList.add("counter");

      } else if (booked.has(number)) {

        seat.classList.add("booked");

      } else if (held.has(number)) {

        seat.classList.add("held");

      } else if (
        previousSelection.includes(number)
      ) {

        seat.classList.add("processing");

        selectedSeats.push(number);
      }

      // ======================================
      // SEAT CLICK EVENT
      // ======================================

      seat.addEventListener(
        "click",
        () => {

          if (!seatMapReady) {
            return;
          }

          if (
            seat.classList.contains("counter") ||
            seat.classList.contains("held") ||
            seat.classList.contains("booked")
          ) {
            return;
          }

          // Deselect seat.

          if (
            selectedSeats.includes(number)
          ) {

            removeFromSelection(number);

            seat.classList.remove(
              "processing"
            );

          } else {

            // Select seat - Green.

            selectedSeats.push(number);

            seat.classList.add(
              "processing"
            );
          }

          updateSummary();
        }
      );

      busLayout.appendChild(seat);
    }

    // ======================================
    // APPLY QUEUED REAL-TIME UPDATES
    // ======================================

    seatMapReady = true;

    const updates =
      queuedRealtimeUpdates;

    queuedRealtimeUpdates = [];

    updates.forEach(
      applyRealtimeUpdate
    );

    updateSummary();
  }

  // ==========================================
  // LOAD SEAT MAP FROM BACKEND
  // ==========================================

  async function loadSeatMap(
    openSession,
    preserveSelection = false
  ) {

    if (
      !isActiveSession(openSession)
    ) {
      return false;
    }

    stopSeatFetch();

    const controller =
      new AbortController();

    seatFetchController = controller;

    seatMapReady = false;

    queuedRealtimeUpdates = [];

    updateSummary();

    const busId = currentBus.id;

    const tripId = currentBus.tripId;

    const date = currentDate;

    // ======================================
    // TRIP-SPECIFIC SEAT API
    // ======================================

    const url =

      `${API_BASE}/buses/${encodeURIComponent(busId)}/seats` +

      `?date=${encodeURIComponent(date)}` +

      `&tripId=${encodeURIComponent(tripId)}`;

    try {

      const response = await fetch(
        url,
        {
          signal: controller.signal
        }
      );

      const data = await response.json();

      if (
        !isActiveSession(openSession) ||
        controller.signal.aborted
      ) {
        return false;
      }

      // ======================================
      // CHECK BACKEND RESPONSE
      // ======================================

      if (
        !response.ok ||
        !data.success
      ) {

        busLayout.textContent =
          data.message ||
          "Could not load seats.";

        return false;
      }

      // ======================================
      // VERIFY SELECTED TRIP
      // ======================================

      if (
        String(data.tripId || "") !==
        tripId
      ) {

        busLayout.textContent =
          "Seat data does not match the selected trip.";

        return false;
      }

      // ======================================
      // VALIDATE 50 / 54 SEAT LAYOUT
      // ======================================

      const config =
        validateSeatLayout(data);

      if (!config) {

        busLayout.textContent =
          "Seat layout does not match the bus capacity (50/54).";

        return false;
      }

      // ======================================
      // DYNAMIC GRID COLUMNS
      // ======================================

      // 50 Seats -> 13 Columns
      // 54 Seats -> 11 Columns

      busLayout.style.gridTemplateColumns =
        `repeat(${config.columns}, 46px)`;

      busLayout.dataset.capacity =
        String(config.capacity);

      // ======================================
      // GET SERVER TRIP FARE
      // ======================================

      const serverFare =
        Number(data.bus?.fare);

      if (
        Number.isFinite(serverFare) &&
        serverFare >= 0
      ) {

        fare = serverFare;
      }

      // ======================================
      // RENDER EXACT BACKEND PATTERN
      // ======================================

      renderSeats(
        data.pattern,
        data.counterSeats || [],
        data.heldSeats || [],
        data.bookedSeats || [],
        preserveSelection
      );

      console.log(
        "RAJABUS seat map loaded:",
        {
          busNo: data.bus?.busNo,

          tripId,

          capacity: config.capacity,

          columns: config.columns
        }
      );

      return true;

    } catch (error) {

      if (
        error.name !== "AbortError"
      ) {

        console.error(
          "Seat loading error:",
          error
        );

        if (
          isActiveSession(openSession)
        ) {

          busLayout.textContent =
            "Could not reach the booking server.";
        }
      }

      return false;

    } finally {

      if (
        seatFetchController === controller
      ) {

        seatFetchController = null;
      }

      updateSummary();
    }
  }

  // ==========================================
  // TRIP-SPECIFIC REAL-TIME SSE
  // ==========================================

  function connectRealtimeUpdates(
    openSession
  ) {

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

    const stream =
      new EventSource(url);

    realtimeStream = stream;

    // ======================================
    // CONNECTED / RECONNECTED
    // ======================================

    stream.addEventListener(
      "connected",
      () => {

        if (
          !isActiveSession(openSession) ||
          realtimeStream !== stream
        ) {
          return;
        }

        console.log(
          "Real-time connected:",
          currentBus.tripId
        );

        // Reload after reconnect.

        loadSeatMap(
          openSession,
          true
        );
      }
    );

    // ======================================
    // REAL-TIME SEAT STATUS
    // ======================================

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

          const update =
            JSON.parse(event.data);

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

      if (
        isActiveSession(openSession)
      ) {

        console.warn(
          "Real-time connection interrupted; reconnecting..."
        );
      }
    };
  }

  // ==========================================
  // CLOSE SEAT MODAL
  // ==========================================

  function closeModal() {

    session += 1;

    stopSeatFetch();

    closeRealtimeConnection();

    seatModal.classList.remove(
      "show"
    );

    seatMapReady = false;

    queuedRealtimeUpdates = [];

    selectedSeats = [];

    currentBus = null;

    currentDate = "";

    fare = 0;

    updateSummary();
  }

  // ==========================================
  // OPEN SEAT MODAL
  // CALLED FROM result.js
  // ==========================================

  window.openSeatModal =
    async function (bus, journeyDate) {

      session += 1;

      const openSession = session;

      stopSeatFetch();

      closeRealtimeConnection();

      const busId =
        bus?.id ??
        bus?.busId ??
        bus?._id;

      const tripId =
        bus?.tripId;

      currentBus = bus
        ? {
            ...bus,

            id: String(
              busId || ""
            ),

            tripId: String(
              tripId || ""
            )
          }
        : null;

      currentDate = String(
        journeyDate || ""
      );

      fare = Number(
        bus?.fare ??
        bus?.fareMin ??
        0
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

      // ====================================
      // BOARDING & DROPPING
      // ====================================

      if (modalBoarding) {

        modalBoarding.textContent =
          bus?.from || "";
      }

      if (modalDropping) {

        modalDropping.textContent =
          bus?.to || "";
      }

      seatModal.classList.add(
        "show"
      );

      busLayout.textContent =
        "Loading seats...";

      // ====================================
      // VALIDATE BUS / TRIP / DATE
      // ====================================

      if (
        !currentBus?.id ||
        !currentBus.tripId ||
        !currentDate
      ) {

        busLayout.textContent =
          "Bus, scheduled Trip ID, or journey date is missing.";

        return;
      }

      console.log(
        "Opening seat map:",
        {
          busId: currentBus.id,

          tripId: currentBus.tripId,

          journeyDate: currentDate
        }
      );

      // ====================================
      // INITIAL SEAT MAP LOAD
      // ====================================

      const loaded =
        await loadSeatMap(
          openSession,
          false
        );

      if (
        loaded &&
        isActiveSession(openSession)
      ) {

        connectRealtimeUpdates(
          openSession
        );
      }
    };

  // ==========================================
  // CLOSE BUTTON
  // ==========================================

  closeSeat?.addEventListener(
    "click",
    closeModal
  );

  // ==========================================
  // CLICK OUTSIDE MODAL
  // ==========================================

  seatModal.addEventListener(
    "click",
    (event) => {

      if (
        event.target === seatModal
      ) {

        closeModal();
      }
    }
  );

  // ==========================================
  // PROCEED TO PASSENGER DETAILS
  // ==========================================

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

      if (
        selectedSeats.length === 0
      ) {

        notify(
          "Please select at least one available seat."
        );

        return;
      }

      if (
        !Number.isFinite(fare) ||
        fare <= 0
      ) {

        notify(
          "This trip does not have a valid payable fare."
        );

        return;
      }

      // ====================================
      // BUILD PENDING BOOKING
      // ====================================

      const pendingBooking = {

        tripId: currentBus.tripId,

        busId: currentBus.id,

        busNo: currentBus.busNo,

        regNo:
          currentBus.regNo || "",

        type:
          currentBus.type || "",

        from: currentBus.from,

        to: currentBus.to,

        departTime:
          currentBus.depart,

        arriveTime:
          currentBus.arrive,

        journeyDate: currentDate,

        seats: [
          ...selectedSeats
        ],

        fare,

        totalFare:
          selectedSeats.length * fare,

        boardingPoint:
          currentBus.from,

        droppingPoint:
          currentBus.to
      };

      // ====================================
      // SAVE PENDING BOOKING
      // ====================================

      localStorage.setItem(
        "pendingBooking",

        JSON.stringify(
          pendingBooking
        )
      );

      localStorage.setItem(
        "selectedTrip",

        JSON.stringify(
          currentBus
        )
      );

      // ====================================
      // REDIRECT
      // ====================================

      stopSeatFetch();

      closeRealtimeConnection();

      window.location.href =
        "booking-details.html";
    }
  );

  // ==========================================
  // CLEANUP ON PAGE EXIT
  // ==========================================

  window.addEventListener(
    "beforeunload",
    () => {

      stopSeatFetch();

      closeRealtimeConnection();
    }
  );

  updateSummary();
});
