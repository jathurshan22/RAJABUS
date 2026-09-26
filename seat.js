const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");
  const busLayout = document.getElementById("busLayout");
  const selectedSeatsText = document.getElementById("selectedSeats");
  const totalFareText = document.getElementById("totalFare");
  const proceedBtn = document.getElementById("proceedBtn");

  if (!seatModal || !busLayout) return;

  let selectedSeats = [];
  let currentBus = null;
  let currentDate = null;
  let fare = 0;

  // =====================================================
  // REAL-TIME VARIABLES
  // =====================================================

  let realtimeStream = null;

  let seatMapReady = false;

  let queuedRealtimeUpdates = [];


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
        selectedSeats.length * fare;
    }
  }


  // =====================================================
  // CLOSE REAL-TIME CONNECTION
  // =====================================================

  function closeRealtimeConnection() {
    if (realtimeStream) {
      realtimeStream.close();

      realtimeStream = null;

      console.log(
        "Real-time seat connection closed"
      );
    }
  }


  // =====================================================
  // REMOVE SEAT FROM CURRENT SELECTION
  // =====================================================

  function removeFromSelection(seatNumber) {
    if (
      selectedSeats.includes(
        String(seatNumber)
      )
    ) {
      selectedSeats =
        selectedSeats.filter(
          (seat) =>
            String(seat) !==
            String(seatNumber)
        );

      updateSummary();

      return true;
    }

    return false;
  }


  // =====================================================
  // APPLY REAL-TIME UPDATE
  //
  // held     → ORANGE
  // booked   → RED
  // released → AVAILABLE
  // =====================================================

  function applyRealtimeUpdate(update) {
    if (!currentBus || !currentDate) {
      return;
    }


    // Same bus only
    if (
      String(update.busId) !==
      String(currentBus.id)
    ) {
      return;
    }


    // Same date only
    if (
      String(update.journeyDate) !==
      String(currentDate)
    ) {
      return;
    }


    // Seat map loading-na event queue pannuvom
    if (!seatMapReady) {
      queuedRealtimeUpdates.push(
        update
      );

      return;
    }


    const seats =
      Array.isArray(update.seats)
        ? update.seats
        : [];


    seats.forEach((seatNo) => {
      const seatNumber =
        String(seatNo);


      const seatElement =
        busLayout.querySelector(
          `[data-seat="${seatNumber}"]`
        );


      if (!seatElement) {
        return;
      }


      // Counter seats cannot change
      if (
        seatElement.classList.contains(
          "counter"
        )
      ) {
        return;
      }


      // =================================================
      // HELD
      // Passenger details submitted
      // ORANGE
      // =================================================

      if (update.action === "held") {
        const wasSelected =
          removeFromSelection(
            seatNumber
          );


        // Remove green selected state
        seatElement.classList.remove(
          "processing"
        );


        // Remove old booked state if any
        seatElement.classList.remove(
          "booked"
        );


        // Add held state
        seatElement.classList.add(
          "held"
        );


        if (wasSelected) {
          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              `Seat ${seatNumber} is temporarily held by another passenger.`,
              "error"
            );
          } else {
            alert(
              `Seat ${seatNumber} is temporarily held by another passenger.`
            );
          }
        }
      }


      // =================================================
      // BOOKED
      // Payment successful
      // RED
      // =================================================

      if (
        update.action ===
        "booked"
      ) {
        const wasSelected =
          removeFromSelection(
            seatNumber
          );


        // Remove temporary states
        seatElement.classList.remove(
          "processing"
        );

        seatElement.classList.remove(
          "held"
        );


        // Final booked
        seatElement.classList.add(
          "booked"
        );


        if (wasSelected) {
          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              `Seat ${seatNumber} has been booked by another passenger.`,
              "error"
            );
          } else {
            alert(
              `Seat ${seatNumber} has been booked by another passenger.`
            );
          }
        }
      }


      // =================================================
      // RELEASED
      // Cancel / expiry
      // AVAILABLE AGAIN
      // =================================================

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

        seatElement.classList.remove(
          "processing"
        );
      }
    });


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


    // ---------------------------------------------------
    // CONNECTED
    // ---------------------------------------------------

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

        } catch (error) {
          console.log(
            "Real-time connected"
          );
        }
      }
    );


    // ---------------------------------------------------
    // SEAT UPDATE
    // ---------------------------------------------------

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


    // ---------------------------------------------------
    // CONNECTION ERROR
    // ---------------------------------------------------

    realtimeStream.onerror =
      (error) => {
        console.warn(
          "Real-time connection interrupted. Browser will reconnect automatically.",
          error
        );
      };
  }


  // =====================================================
  // RENDER SEATS
  //
  // counterSeats → fixed counter
  // heldSeats    → ORANGE
  // bookedSeats  → RED
  // =====================================================

  function renderSeats(
    pattern,
    counterSeats,
    heldSeats,
    bookedSeats
  ) {
    busLayout.innerHTML = "";

    selectedSeats = [];

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


    pattern.forEach((no) => {
      const seat =
        document.createElement(
          "div"
        );


      // -------------------------------------------------
      // EMPTY / AISLE
      // -------------------------------------------------

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


      // Important for real-time lookup
      seat.dataset.seat =
        seatNo;


      seat.innerHTML =
        `${seatNo}<span class="handle"></span>`;


      // -------------------------------------------------
      // COUNTER SEAT
      // -------------------------------------------------

      if (
        counterList.includes(
          seatNo
        )
      ) {
        seat.classList.add(
          "counter"
        );
      }


      // -------------------------------------------------
      // BOOKED SEAT
      // Payment complete
      // RED
      // -------------------------------------------------

      if (
        bookedList.includes(
          seatNo
        )
      ) {
        seat.classList.add(
          "booked"
        );
      }


      // -------------------------------------------------
      // HELD SEAT
      // Payment pending
      // ORANGE
      //
      // Only if not already booked/counter
      // -------------------------------------------------

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


      // -------------------------------------------------
      // CLICK
      // -------------------------------------------------

      seat.addEventListener(
        "click",
        () => {

          // Cannot select:
          // booked / held / counter
          if (
            seat.classList.contains(
              "booked"
            ) ||
            seat.classList.contains(
              "held"
            ) ||
            seat.classList.contains(
              "counter"
            )
          ) {
            return;
          }


          // Green selected state
          seat.classList.toggle(
            "processing"
          );


          if (
            selectedSeats.includes(
              seatNo
            )
          ) {
            selectedSeats =
              selectedSeats.filter(
                (selectedSeat) =>
                  selectedSeat !==
                  seatNo
              );

          } else {
            selectedSeats.push(
              seatNo
            );
          }


          updateSummary();
        }
      );


      busLayout.appendChild(
        seat
      );
    });


    // Seat map ready
    seatMapReady =
      true;


    // Apply SSE events received while loading
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
        Number(bus.fare) ||
        0;


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


      // -------------------------------------------------
      // DATE REQUIRED
      // -------------------------------------------------

      if (!journeyDate) {
        busLayout.innerHTML =
          "<p>Please go back and pick a travel date first.</p>";

        return;
      }


      // -------------------------------------------------
      // START REAL-TIME
      // -------------------------------------------------

      connectRealtimeUpdates(
        bus.id,
        journeyDate
      );


      // -------------------------------------------------
      // LOAD CURRENT SEAT MAP
      // -------------------------------------------------

      try {
        const res =
          await fetch(
            `${API_BASE}/buses/${bus.id}/seats?date=${encodeURIComponent(
              journeyDate
            )}`
          );


        const data =
          await res.json();


        if (!data.success) {
          busLayout.innerHTML =
            `<p>${
              data.message ||
              "Could not load seats."
            }</p>`;

          return;
        }


        /*
          Backend now sends:

          counterSeats
          heldSeats
          bookedSeats
        */

        renderSeats(
          data.pattern || [],
          data.counterSeats || [],
          data.heldSeats || [],
          data.bookedSeats || []
        );

      } catch (error) {
        busLayout.innerHTML =
          "<p>Could not reach the booking server.</p>";


        console.error(
          "Seat loading error:",
          error
        );
      }
    };


  // =====================================================
  // CLOSE MODAL
  // =====================================================

  closeSeat?.addEventListener(
    "click",
    () => {
      seatModal.classList.remove(
        "show"
      );


      seatMapReady =
        false;


      queuedRealtimeUpdates =
        [];


      closeRealtimeConnection();
    }
  );


  // =====================================================
  // PROCEED TO PASSENGER DETAILS
  // =====================================================

  proceedBtn?.addEventListener(
    "click",
    () => {
      if (
        !currentBus ||
        selectedSeats.length ===
          0
      ) {
        if (
          typeof showToast ===
          "function"
        ) {
          showToast(
            "Please select at least one seat.",
            "error"
          );

        } else {
          alert(
            "Please select at least one seat."
          );
        }

        return;
      }


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
      };


      localStorage.setItem(
        "pendingBooking",
        JSON.stringify(
          pendingBooking
        )
      );


      // Leaving result page
      closeRealtimeConnection();


      window.location.href =
        "booking-details.html";
    }
  );


  // =====================================================
  // PAGE CLOSE
  // =====================================================

  window.addEventListener(
    "beforeunload",
    () => {
      closeRealtimeConnection();
    }
  );
});