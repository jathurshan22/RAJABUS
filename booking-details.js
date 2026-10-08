const API_BASE =
  "http://localhost:5000/api";


// ======================================================
// CURRENT USER
// ======================================================

const user =
  JSON.parse(
    localStorage.getItem("user") ||
    "null"
  );


// ======================================================
// PENDING BOOKING
// ======================================================

const pendingBooking =
  JSON.parse(
    localStorage.getItem(
      "pendingBooking"
    ) || "null"
  );


// ======================================================
// NO PENDING BOOKING
// ======================================================

if (!pendingBooking) {

  showToast(
    "Please search and select seats first.",
    "error"
  );

  setTimeout(() => {

    window.location.href =
      "home.html";

  }, 1500);
}


// ======================================================
// TRIP ID CHECK
//
// Bus operator system:
// booking must belong to a scheduled Trip.
// ======================================================

if (
  pendingBooking &&
  !pendingBooking.tripId
) {

  console.error(
    "Trip ID missing from pendingBooking:",
    pendingBooking
  );

  showToast(
    "Trip information is missing. Please search and select the bus again.",
    "error"
  );

  setTimeout(() => {

    window.location.href =
      "home.html";

  }, 1800);
}


// ======================================================
// SHOW BOOKING SUMMARY
// ======================================================

if (
  pendingBooking &&
  pendingBooking.tripId
) {

  const summaryBus =
    document.getElementById(
      "summaryBus"
    );

  const summaryDate =
    document.getElementById(
      "summaryDate"
    );

  const summarySeats =
    document.getElementById(
      "summarySeats"
    );

  const summaryBoarding =
    document.getElementById(
      "summaryBoarding"
    );

  const summaryDropping =
    document.getElementById(
      "summaryDropping"
    );

  const summaryFare =
    document.getElementById(
      "summaryFare"
    );


  // --------------------------------------------------
  // BUS
  // --------------------------------------------------

  if (summaryBus) {

    summaryBus.textContent =
      `${pendingBooking.busNo} ` +
      `(${pendingBooking.departTime} - ${pendingBooking.arriveTime})`;
  }


  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  if (summaryDate) {

    summaryDate.textContent =
      pendingBooking.journeyDate;
  }


  // --------------------------------------------------
  // SEATS
  // --------------------------------------------------

  if (summarySeats) {

    summarySeats.textContent =
      Array.isArray(
        pendingBooking.seats
      )
        ? pendingBooking.seats.join(
            ", "
          )
        : "";
  }


  // --------------------------------------------------
  // BOARDING
  // --------------------------------------------------

  if (summaryBoarding) {

    summaryBoarding.textContent =
      pendingBooking.boardingPoint;
  }


  // --------------------------------------------------
  // DROPPING
  // --------------------------------------------------

  if (summaryDropping) {

    summaryDropping.textContent =
      pendingBooking.droppingPoint;
  }


  // --------------------------------------------------
  // TOTAL
  // --------------------------------------------------

  if (summaryFare) {

    summaryFare.textContent =
      `Rs.${pendingBooking.totalFare}`;
  }


  console.log(
    "Booking Trip ID:",
    pendingBooking.tripId
  );

  console.log(
    "Pending Booking:",
    pendingBooking
  );
}


// ======================================================
// PAYMENT BUTTON
// ======================================================

const paymentBtn =
  document.getElementById(
    "paymentBtn"
  );


// ======================================================
// CONTINUE TO PAYMENT
// ======================================================

paymentBtn?.addEventListener(
  "click",

  async () => {

    // ==================================================
    // USER LOGIN CHECK
    // ==================================================

    if (!user) {

      showToast(
        "Please login first",
        "error"
      );

      setTimeout(() => {

        window.location.href =
          "login.html";

      }, 1500);

      return;
    }


    // ==================================================
    // PENDING BOOKING CHECK
    // ==================================================

    if (!pendingBooking) {

      showToast(
        "Booking information is missing.",
        "error"
      );

      return;
    }


    // ==================================================
    // TRIP CHECK
    // ==================================================

    if (!pendingBooking.tripId) {

      showToast(
        "Trip information is missing. Please select the bus again.",
        "error"
      );

      return;
    }


    // ==================================================
    // AUTH TOKEN
    // ==================================================

    const token =
      localStorage.getItem(
        "userToken"
      );


    if (!token) {

      showToast(
        "Your login session has expired. Please login again.",
        "error"
      );

      localStorage.removeItem(
        "user"
      );

      setTimeout(() => {

        window.location.href =
          "login.html";

      }, 1500);

      return;
    }


    // ==================================================
    // PREVENT DOUBLE CLICK
    // ==================================================

    paymentBtn.disabled =
      true;


    const originalText =
      paymentBtn.textContent;


    paymentBtn.textContent =
      "Holding seats...";


    // ==================================================
    // PASSENGER DETAILS
    // ==================================================

    const passengerNameInput =
      document.getElementById(
        "passengerName"
      );

    const mobileNoInput =
      document.getElementById(
        "mobileNo"
      );

    const nicNoInput =
      document.getElementById(
        "nicNo"
      );

    const emailInput =
      document.getElementById(
        "passengerEmail"
      );


    const passengerName =
      passengerNameInput
        ?.value
        ?.trim() || "";


    const mobileNo =
      mobileNoInput
        ?.value
        ?.trim() || "";


    const nicNo =
      nicNoInput
        ?.value
        ?.trim() || "";


    const email =
      emailInput
        ?.value
        ?.trim() || "";


    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !passengerName ||
      !mobileNo ||
      !email
    ) {

      showToast(
        "Please fill required details",
        "error"
      );

      paymentBtn.disabled =
        false;

      paymentBtn.textContent =
        originalText;

      return;
    }


    // ==================================================
    // PREPARE BOOKING DATA
    // ==================================================

    const bookingData = {

      // -----------------------------------------------
      // SCHEDULED TRIP ID
      // -----------------------------------------------

      tripId:
        pendingBooking.tripId,


      // -----------------------------------------------
      // USER
      // -----------------------------------------------

      userId:
        user.id,


      // -----------------------------------------------
      // PHYSICAL BUS
      // -----------------------------------------------

      busId:
        pendingBooking.busId,


      // -----------------------------------------------
      // JOURNEY
      // -----------------------------------------------

      journeyDate:
        pendingBooking.journeyDate,


      // -----------------------------------------------
      // PASSENGER
      // -----------------------------------------------

      passengerName,

      mobileNo,

      nicNo,

      email,


      // -----------------------------------------------
      // SEATS
      // -----------------------------------------------

      seats:
        pendingBooking.seats,


      // -----------------------------------------------
      // BOARDING / DROPPING
      // -----------------------------------------------

      boardingPoint:
        pendingBooking.boardingPoint,

      droppingPoint:
        pendingBooking.droppingPoint,


      // -----------------------------------------------
      // FARE
      // -----------------------------------------------

      totalFare:
        pendingBooking.totalFare,
    };


    console.log(
      "Sending booking data:",
      bookingData
    );


    // ==================================================
    // CREATE TEMPORARY BOOKING HOLD
    // ==================================================

    try {

      const res =
        await fetch(
          `${API_BASE}/bookings/create`,

          {
            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                bookingData
              ),
          }
        );


      const data =
        await res.json();


      console.log(
        "Booking response:",
        data
      );


      // ==================================================
      // AUTH ERROR
      // ==================================================

      if (
        res.status === 401 ||
        res.status === 403
      ) {

        showToast(
          data.message ||
            "Your login session has expired. Please login again.",
          "error"
        );


        localStorage.removeItem(
          "user"
        );

        localStorage.removeItem(
          "userToken"
        );


        setTimeout(() => {

          window.location.href =
            "login.html";

        }, 1500);


        return;
      }


      // ==================================================
      // BOOKING CREATED SUCCESSFULLY
      // ==================================================

      if (
        res.ok &&
        data.success
      ) {

        /*
          Booking should now contain:

          tripId
          busId
          userId
          seats
          status = Pending
          holdExpiresAt
        */


        // -----------------------------------------------
        // SAVE CURRENT BOOKING
        // -----------------------------------------------

        localStorage.setItem(
          "currentBooking",

          JSON.stringify(
            data.booking
          )
        );


        // -----------------------------------------------
        // SAVE HOLD EXPIRY
        // -----------------------------------------------

        if (
          data.booking
            ?.holdExpiresAt
        ) {

          localStorage.setItem(
            "holdExpiresAt",

            data.booking
              .holdExpiresAt
          );
        }


        // -----------------------------------------------
        // KEEP SELECTED TRIP
        //
        // Useful for debugging / future pages.
        // -----------------------------------------------

        if (
          pendingBooking.tripId
        ) {

          localStorage.setItem(
            "currentTripId",
            pendingBooking.tripId
          );
        }


        // -----------------------------------------------
        // REMOVE PENDING BOOKING
        // -----------------------------------------------

        localStorage.removeItem(
          "pendingBooking"
        );


        // -----------------------------------------------
        // SUCCESS MESSAGE
        // -----------------------------------------------

        showToast(
          "Seats held for 15 minutes. Complete payment to confirm your booking.",
          "success"
        );


        // -----------------------------------------------
        // GO TO PAYMENT
        // -----------------------------------------------

        setTimeout(() => {

          window.location.href =
            "payment.html";

        }, 700);


        return;
      }


      // ==================================================
      // SEAT CONFLICT
      // ==================================================

      if (
        Array.isArray(
          data.conflicts
        ) &&
        data.conflicts.length >
          0
      ) {

        showToast(
          `Seat ${data.conflicts.join(
            ", "
          )} is no longer available. Please select another seat.`,
          "error"
        );


        setTimeout(() => {

          window.history.back();

        }, 1800);


        return;
      }


      // ==================================================
      // TRIP ERROR
      // ==================================================

      if (
        data.tripError ===
        true
      ) {

        showToast(
          data.message ||
            "This trip is no longer available.",
          "error"
        );


        setTimeout(() => {

          window.location.href =
            "home.html";

        }, 1800);


        return;
      }


      // ==================================================
      // OTHER BACKEND ERROR
      // ==================================================

      showToast(
        data.message ||
          "Could not hold the selected seats.",
        "error"
      );


    } catch (error) {

      console.error(
        "Booking hold error:",
        error
      );


      showToast(
        "Could not reach the booking server. Please make sure the backend is running.",
        "error"
      );


    } finally {

      paymentBtn.disabled =
        false;


      paymentBtn.textContent =
        originalText;
    }
  }
);