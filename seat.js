const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");
  const busLayout = document.getElementById("busLayout");
  const selectedSeatsText = document.getElementById("selectedSeats");
  const totalFareText = document.getElementById("totalFare");
  const proceedBtn = document.getElementById("proceedBtn");

  if (!seatModal || !busLayout) return;

  // =====================================================
  // CURRENT SELECTION
  // =====================================================

  let selectedSeats = [];

  let currentBus = null;

  let currentDate = null;

  let fare = 0;

  // One seat-modal session = one selection ID
  let currentSelectionId = null;

  // =====================================================
  // REAL-TIME
  // =====================================================

  let realtimeStream = null;

  let seatMapReady = false;

  let queuedRealtimeUpdates = [];

  // Refresh temporary holds while user stays in modal
  let holdRefreshTimer = null;


  // =====================================================
  // AUTH TOKEN
  // =====================================================

  function getAuthToken() {
  return (
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwtToken") ||
    localStorage.getItem("accessToken") ||
    ""
    );
  }


  // =====================================================
  // SELECTION ID
  // =====================================================

  function createSelectionId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "selection-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }


  // =====================================================
  // MESSAGE
  // =====================================================

  function showMessage(message, type = "error") {
    if (
      typeof showToast ===
      "function"
    ) {
      showToast(
        message,
        type
      );

      return;
    }

    alert(message);
  }


  // =====================================================
  // UPDATE SUMMARY
  // =====================================================

  function updateSummary() {
    if (selectedSeatsText) {
      selectedSeatsText.textContent =
        selectedSeats.length > 0
          ? `[ ${selectedSeats.join(", ")} ]`
          : "[ 00 ]";
    }

    if (totalFareText) {
      totalFareText.textContent =
        selectedSeats.length *
        fare;
    }
  }


  // =====================================================
  // REMOVE FROM LOCAL SELECTION
  // =====================================================

  function removeFromSelection(
    seatNumber
  ) {
    const normalizedSeat =
      String(seatNumber);

    if (
      !selectedSeats.includes(
        normalizedSeat
      )
    ) {
      return false;
    }

    selectedSeats =
      selectedSeats.filter(
        (seat) =>
          String(seat) !==
          normalizedSeat
      );

    updateSummary();

    return true;
  }


  // =====================================================
  // ADD TO LOCAL SELECTION
  // =====================================================

  function addToSelection(
    seatNumber
  ) {
    const normalizedSeat =
      String(seatNumber);

    if (
      !selectedSeats.includes(
        normalizedSeat
      )
    ) {
      selectedSeats.push(
        normalizedSeat
      );
    }

    updateSummary();
  }


  // =====================================================
  // CLOSE REALTIME CONNECTION
  // =====================================================

  function closeRealtimeConnection() {
    if (realtimeStream) {
      realtimeStream.close();

      realtimeStream =
        null;

      console.log(
        "Real-time seat connection closed"
      );
    }
  }


  // =====================================================
  // STOP HOLD REFRESH TIMER
  // =====================================================

  function stopHoldRefreshTimer() {
    if (holdRefreshTimer) {
      clearInterval(
        holdRefreshTimer
      );

      holdRefreshTimer =
        null;
    }
  }


  // =====================================================
  // HOLD ONE SEAT
  //
  // User clicks white seat
  // ↓
  // Backend immediately creates SeatLock
  // ↓
  // Other passengers see ORANGE
  // =====================================================

  async function holdSeat(
    seatNumber
  ) {
    if (
      !currentBus ||
      !currentDate ||
      !currentSelectionId
    ) {
      return {
        success: false,
      };
    }

    const token =
      getAuthToken();

    if (!token) {
      showMessage(
        "Please login before selecting a seat.",
        "error"
      );

      return {
        success: false,
      };
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/seat-holds/hold`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                busId:
                  currentBus.id,

                journeyDate:
                  currentDate,

                seat:
                  String(
                    seatNumber
                  ),

                selectionId:
                  currentSelectionId,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return {
          success: false,

          status:
            data.status || null,

          message:
            data.message ||
            "Could not hold seat.",
        };
      }

      return {
        success: true,

        data,
      };
    } catch (error) {
      console.error(
        "Hold seat error:",
        error
      );

      return {
        success: false,

        message:
          "Could not connect to the booking server.",
      };
    }
  }


  // =====================================================
  // RELEASE ONE SEAT
  //
  // Current passenger deselects green seat
  // ↓
  // SeatLock deleted
  // ↓
  // SSE released
  // ↓
  // Other passengers see WHITE
  // =====================================================

  async function releaseSeat(
    seatNumber
  ) {
    if (
      !currentBus ||
      !currentDate ||
      !currentSelectionId
    ) {
      return {
        success: false,
      };
    }

    const token =
      getAuthToken();

    if (!token) {
      return {
        success: false,
      };
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/seat-holds/release`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                busId:
                  currentBus.id,

                journeyDate:
                  currentDate,

                seat:
                  String(
                    seatNumber
                  ),

                selectionId:
                  currentSelectionId,
              }),
          }
        );

      const data =
        await response.json();

      // Hold already expired/deleted-na
      // frontend-la release pannalaam.
      if (
        response.status === 404
      ) {
        return {
          success: true,
          data,
        };
      }

      if (!response.ok) {
        return {
          success: false,

          message:
            data.message ||
            "Could not release seat.",
        };
      }

      return {
        success: true,

        data,
      };
    } catch (error) {
      console.error(
        "Release seat error:",
        error
      );

      return {
        success: false,

        message:
          "Could not connect to the booking server.",
      };
    }
  }


  // =====================================================
  // RELEASE ALL CURRENT TEMP HOLDS
  //
  // Used when seat modal manually closed
  // =====================================================

  async function releaseAllTemporaryHolds(
    busId,
    journeyDate,
    selectionId
  ) {
    if (
      !busId ||
      !journeyDate ||
      !selectionId
    ) {
      return;
    }

    const token =
      getAuthToken();

    if (!token) {
      return;
    }

    try {
      await fetch(
        `${API_BASE}/seat-holds/release-all`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              busId,
              journeyDate,
              selectionId,
            }),
        }
      );
    } catch (error) {
      console.error(
        "Release all temporary holds error:",
        error
      );
    }
  }


  // =====================================================
  // REFRESH CURRENT TEMP HOLD
  // =====================================================

  async function refreshCurrentHolds() {
    if (
      !currentBus ||
      !currentDate ||
      !currentSelectionId ||
      selectedSeats.length ===
        0
    ) {
      return;
    }

    const token =
      getAuthToken();

    if (!token) {
      return;
    }

    try {
      await fetch(
        `${API_BASE}/seat-holds/refresh`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              busId:
                currentBus.id,

              journeyDate:
                currentDate,

              selectionId:
                currentSelectionId,
            }),
        }
      );
    } catch (error) {
      console.error(
        "Seat hold refresh error:",
        error
      );
    }
  }


  // =====================================================
  // START HOLD REFRESH
  // =====================================================

  function startHoldRefreshTimer() {
    stopHoldRefreshTimer();

    // Backend initial hold = 2 minutes.
    // Refresh every 60 seconds while modal is open.
    holdRefreshTimer =
      setInterval(
        () => {
          refreshCurrentHolds();
        },
        60 * 1000
      );
  }


  // =====================================================
  // APPLY REALTIME UPDATE
  //
  // Own held:
  // GREEN
  //
  // Other passenger held:
  // ORANGE
  //
  // booked:
  // RED
  //
  // released:
  // WHITE
  // =====================================================

  function applyRealtimeUpdate(
    update
  ) {
    if (
      !currentBus ||
      !currentDate
    ) {
      return;
    }

    // Same bus only
    if (
      String(
        update.busId
      ) !==
      String(
        currentBus.id
      )
    ) {
      return;
    }

    // Same journey date only
    if (
      String(
        update.journeyDate
      ) !==
      String(
        currentDate
      )
    ) {
      return;
    }

    // Seat map still loading
    if (!seatMapReady) {
      queuedRealtimeUpdates.push(
        update
      );

      return;
    }

    const seats =
      Array.isArray(
        update.seats
      )
        ? update.seats
        : [];

    const isOwnSelection =
      Boolean(
        currentSelectionId &&
        update.selectionId &&
        String(
          update.selectionId
        ) ===
          String(
            currentSelectionId
          )
      );

    seats.forEach(
      (seatNo) => {
        const seatNumber =
          String(seatNo);

        const seatElement =
          busLayout.querySelector(
            `[data-seat="${seatNumber}"]`
          );

        if (!seatElement) {
          return;
        }

        // Counter seat never changes
        if (
          seatElement.classList.contains(
            "counter"
          )
        ) {
          return;
        }


        // ===============================================
        // HELD
        // ===============================================

        if (
          update.action ===
          "held"
        ) {

          // ---------------------------------------------
          // THIS PASSENGER'S OWN HOLD
          //
          // Keep GREEN.
          // ---------------------------------------------

          if (isOwnSelection) {
            seatElement.classList.remove(
              "held"
            );

            seatElement.classList.remove(
              "booked"
            );

            seatElement.classList.add(
              "processing"
            );

            return;
          }


          // ---------------------------------------------
          // ANOTHER PASSENGER
          //
          // Show ORANGE.
          // ---------------------------------------------

          const wasSelected =
            removeFromSelection(
              seatNumber
            );

          seatElement.classList.remove(
            "processing"
          );

          seatElement.classList.remove(
            "booked"
          );

          seatElement.classList.add(
            "held"
          );

          if (wasSelected) {
            showMessage(
              `Seat ${seatNumber} was just selected by another passenger.`,
              "error"
            );
          }

          return;
        }


        // ===============================================
        // BOOKED
        // Payment success
        // RED
        // ===============================================

        if (
          update.action ===
          "booked"
        ) {
          const wasSelected =
            removeFromSelection(
              seatNumber
            );

          seatElement.classList.remove(
            "processing"
          );

          seatElement.classList.remove(
            "held"
          );

          seatElement.classList.add(
            "booked"
          );

          if (
            wasSelected &&
            !isOwnSelection
          ) {
            showMessage(
              `Seat ${seatNumber} has been booked.`,
              "error"
            );
          }

          return;
        }


        // ===============================================
        // RELEASED
        // WHITE AGAIN
        // ===============================================

        if (
          update.action ===
          "released"
        ) {
          seatElement.classList.remove(
            "held"
          );

          seatElement.classList.remove(
            "booked"
          );

          if (isOwnSelection) {
            seatElement.classList.remove(
              "processing"
            );

            removeFromSelection(
              seatNumber
            );
          }

          return;
        }
      }
    );

    updateSummary();
  }


  // =====================================================
  // CONNECT SSE
  // =====================================================

  function connectRealtimeUpdates(
    busId,
    journeyDate
  ) {
    closeRealtimeConnection();

    const realtimeUrl =
      `${API_BASE}/realtime/seats` +
      `?busId=${encodeURIComponent(
        busId
      )}` +
      `&date=${encodeURIComponent(
        journeyDate
      )}`;

    console.log(
      "Connecting real-time:",
      realtimeUrl
    );

    realtimeStream =
      new EventSource(
        realtimeUrl
      );


    // CONNECTED
    realtimeStream.addEventListener(
      "connected",
      (event) => {
        try {
          const data =
            JSON.parse(
              event.data
            );

          console.log(
            "Real-time connected:",
            data
          );
        } catch {
          console.log(
            "Real-time connected"
          );
        }
      }
    );


    // SEAT UPDATE
    realtimeStream.addEventListener(
      "seat-update",
      (event) => {
        try {
          const update =
            JSON.parse(
              event.data
            );

          console.log(
            "Real-time seat update:",
            update
          );

          applyRealtimeUpdate(
            update
          );
        } catch (error) {
          console.error(
            "Failed to parse real-time update:",
            error
          );
        }
      }
    );


    realtimeStream.onerror =
      (error) => {
        console.warn(
          "Real-time connection interrupted. Browser will reconnect automatically.",
          error
        );
      };
  }


  // =====================================================
  // HANDLE SEAT CLICK
  // =====================================================

  async function handleSeatClick(
    seatElement,
    seatNo
  ) {
    // Prevent fast double-click
    if (
      seatElement.dataset.busy ===
      "true"
    ) {
      return;
    }


    // Cannot select these
    if (
      seatElement.classList.contains(
        "booked"
      ) ||
      seatElement.classList.contains(
        "held"
      ) ||
      seatElement.classList.contains(
        "counter"
      )
    ) {
      return;
    }


    const alreadySelected =
      selectedSeats.includes(
        seatNo
      );


    // ===================================================
    // DESELECT CURRENT USER'S GREEN SEAT
    // ===================================================

    if (alreadySelected) {
      seatElement.dataset.busy =
        "true";

      const result =
        await releaseSeat(
          seatNo
        );

      seatElement.dataset.busy =
        "false";

      if (!result.success) {
        showMessage(
          result.message ||
            "Could not release seat.",
          "error"
        );

        return;
      }

      removeFromSelection(
        seatNo
      );

      seatElement.classList.remove(
        "processing"
      );

      seatElement.classList.remove(
        "held"
      );

      return;
    }


    // ===================================================
    // NEW SEAT CLICK
    //
    // Do NOT make it green before server confirms lock.
    // ===================================================

    seatElement.dataset.busy =
      "true";

    const result =
      await holdSeat(
        seatNo
      );

    seatElement.dataset.busy =
      "false";


    // Server rejected
    if (!result.success) {
      seatElement.classList.remove(
        "processing"
      );

      if (
        result.status ===
        "booked"
      ) {
        seatElement.classList.remove(
          "held"
        );

        seatElement.classList.add(
          "booked"
        );
      } else {
        // Most conflict cases = another passenger hold
        seatElement.classList.add(
          "held"
        );
      }

      showMessage(
        result.message ||
          `Seat ${seatNo} is no longer available.`,
        "error"
      );

      return;
    }


    // ===================================================
    // BACKEND LOCK SUCCESS
    //
    // Passenger 1 sees GREEN
    // ===================================================

    seatElement.classList.remove(
      "held"
    );

    seatElement.classList.remove(
      "booked"
    );

    seatElement.classList.add(
      "processing"
    );

    addToSelection(
      seatNo
    );
  }


  // =====================================================
  // RENDER SEATS
  // =====================================================

  function renderSeats(
    pattern,
    counterSeats,
    heldSeats,
    bookedSeats
  ) {
    busLayout.innerHTML =
      "";

    selectedSeats =
      [];

    updateSummary();


    const counterList =
      (counterSeats || [])
        .map(String);

    const heldList =
      (heldSeats || [])
        .map(String);

    const bookedList =
      (bookedSeats || [])
        .map(String);


    pattern.forEach(
      (no) => {
        const seat =
          document.createElement(
            "div"
          );


        // AISLE
        if (no === "x") {
          seat.className =
            "seat empty";

          busLayout.appendChild(
            seat
          );

          return;
        }


        const seatNo =
          String(no);

        seat.className =
          "seat";

        seat.dataset.seat =
          seatNo;

        seat.dataset.busy =
          "false";

        seat.innerHTML =
          `${seatNo}<span class="handle"></span>`;


        // COUNTER
        if (
          counterList.includes(
            seatNo
          )
        ) {
          seat.classList.add(
            "counter"
          );
        }


        // BOOKED
        if (
          bookedList.includes(
            seatNo
          )
        ) {
          seat.classList.add(
            "booked"
          );
        }

        // HELD
        else if (
          heldList.includes(
            seatNo
          ) &&
          !counterList.includes(
            seatNo
          )
        ) {
          seat.classList.add(
            "held"
          );
        }


        seat.addEventListener(
          "click",
          async () => {
            await handleSeatClick(
              seat,
              seatNo
            );
          }
        );


        busLayout.appendChild(
          seat
        );
      }
    );


    seatMapReady =
      true;


    // Apply SSE received while loading
    const pendingUpdates = [
      ...queuedRealtimeUpdates,
    ];

    queuedRealtimeUpdates =
      [];

    pendingUpdates.forEach(
      (update) => {
        applyRealtimeUpdate(
          update
        );
      }
    );
  }


  // =====================================================
  // LOAD SEAT MAP
  // =====================================================

  async function loadSeatMap(
    bus,
    journeyDate
  ) {
    try {
      const response =
        await fetch(
          `${API_BASE}/buses/${bus.id}/seats?date=${encodeURIComponent(
            journeyDate
          )}`
        );

      const data =
        await response.json();

      if (!data.success) {
        busLayout.innerHTML =
          `<p>${
            data.message ||
            "Could not load seats."
          }</p>`;

        return;
      }

      renderSeats(
        data.pattern || [],
        data.counterSeats || [],
        data.heldSeats || [],
        data.bookedSeats || []
      );

    } catch (error) {
      console.error(
        "Seat loading error:",
        error
      );

      busLayout.innerHTML =
        "<p>Could not reach the booking server.</p>";
    }
  }


  // =====================================================
  // OPEN SEAT MODAL
  // =====================================================

  window.openSeatModal =
    async function (
      bus,
      journeyDate
    ) {
      currentBus =
        bus;

      currentDate =
        journeyDate;

      fare =
        Number(
          bus.fare
        ) || 0;


      selectedSeats =
        [];

      updateSummary();


      currentSelectionId =
        createSelectionId();


      console.log(
        "Seat selection ID:",
        currentSelectionId
      );


      seatMapReady =
        false;

      queuedRealtimeUpdates =
        [];


      const modalBoarding =
        document.getElementById(
          "modalBoarding"
        );

      const modalDropping =
        document.getElementById(
          "modalDropping"
        );


      if (modalBoarding) {
        modalBoarding.textContent =
          bus.from;
      }

      if (modalDropping) {
        modalDropping.textContent =
          bus.to;
      }


      busLayout.innerHTML =
        "<p>Loading seats...</p>";

      seatModal.classList.add(
        "show"
      );


      if (!journeyDate) {
        busLayout.innerHTML =
          "<p>Please go back and pick a travel date first.</p>";

        return;
      }


      // START REALTIME FIRST
      connectRealtimeUpdates(
        bus.id,
        journeyDate
      );


      // Start hold refresh
      startHoldRefreshTimer();


      // LOAD CURRENT SEATS
      await loadSeatMap(
        bus,
        journeyDate
      );
    };


  // =====================================================
  // CLOSE MODAL
  //
  // User manually closes:
  // release his temporary seats.
  // =====================================================

  closeSeat?.addEventListener(
    "click",
    async () => {
      const oldBusId =
        currentBus?.id;

      const oldDate =
        currentDate;

      const oldSelectionId =
        currentSelectionId;


      seatModal.classList.remove(
        "show"
      );

      seatMapReady =
        false;

      queuedRealtimeUpdates =
        [];

      stopHoldRefreshTimer();

      closeRealtimeConnection();


      // Reset UI immediately
      selectedSeats =
        [];

      updateSummary();


      currentBus =
        null;

      currentDate =
        null;

      currentSelectionId =
        null;


      // Release backend holds
      await releaseAllTemporaryHolds(
        oldBusId,
        oldDate,
        oldSelectionId
      );
    }
  );


  // =====================================================
  // PROCEED TO PASSENGER DETAILS
  // =====================================================

  proceedBtn?.addEventListener(
    "click",
    async () => {
      if (
        !currentBus ||
        selectedSeats.length ===
          0
      ) {
        showMessage(
          "Please select at least one seat.",
          "error"
        );

        return;
      }


      if (
        !currentSelectionId
      ) {
        showMessage(
          "Seat selection session is missing. Please select your seats again.",
          "error"
        );

        return;
      }


      // Give temporary hold fresh time
      // before passenger details page opens.
      await refreshCurrentHolds();


      const pendingBooking = {
        busId:
          currentBus.id,

        busNo:
          currentBus.busNo,

        from:
          currentBus.from,

        to:
          currentBus.to,

        departTime:
          currentBus.depart,

        arriveTime:
          currentBus.arrive,

        journeyDate:
          currentDate,

        seats: [
          ...selectedSeats,
        ],

        fare,

        totalFare:
          selectedSeats.length *
          fare,

        boardingPoint:
          currentBus.from,

        droppingPoint:
          currentBus.to,


        // ==============================================
        // IMPORTANT
        // Passenger details page must send this to
        // bookingRoutes.js
        // ==============================================

        selectionId:
          currentSelectionId,
      };


      localStorage.setItem(
        "pendingBooking",
        JSON.stringify(
          pendingBooking
        )
      );


      // IMPORTANT:
      // Do NOT release seats here.
      // Passenger is continuing booking.

      stopHoldRefreshTimer();

      closeRealtimeConnection();


      window.location.href =
        "booking-details.html";
    }
  );


  // =====================================================
  // PAGE CLOSE
  //
  // We don't release here because:
  //
  // result.html → booking-details.html
  // navigation also triggers beforeunload.
  //
  // Temporary hold will expire automatically if
  // passenger completely leaves the website.
  // =====================================================

  window.addEventListener(
    "beforeunload",
    () => {
      stopHoldRefreshTimer();

      closeRealtimeConnection();
    }
  );
});