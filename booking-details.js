const API_BASE =
  "http://localhost:5000/api";


// ======================================================
// CURRENT USER
// ======================================================

const user =
  JSON.parse(
    localStorage.getItem(
      "user"
    ) || "null"
  );


// ======================================================
// PENDING BOOKING
//
// seat.js saves:
// - busId
// - seats
// - journeyDate
// - selectionId
// ======================================================

const pendingBooking =
  JSON.parse(
    localStorage.getItem(
      "pendingBooking"
    ) || "null"
  );


// ======================================================
// VARIABLES
// ======================================================

let holdRefreshInterval =
  null;


// ======================================================
// AUTH TOKEN
// ======================================================

function getAuthToken() {
  return localStorage.getItem(
    "userToken"
  );
}


// ======================================================
// STOP REFRESH
// ======================================================

function stopHoldRefresh() {
  if (
    holdRefreshInterval
  ) {
    clearInterval(
      holdRefreshInterval
    );

    holdRefreshInterval =
      null;
  }
}


// ======================================================
// REFRESH TEMPORARY SEAT HOLD
//
// Seat click hold = about 2 minutes.
//
// While passenger fills details,
// refresh every 60 seconds so seat
// doesn't expire.
// ======================================================

async function refreshTemporaryHold() {

  if (
    !pendingBooking ||
    !pendingBooking.busId ||
    !pendingBooking.journeyDate ||
    !pendingBooking.selectionId
  ) {
    return false;
  }


  const token =
    getAuthToken();


  if (!token) {
    return false;
  }


  try {

    const response =
      await fetch(
        `${API_BASE}/seat-holds/refresh`,
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
            JSON.stringify({
              busId:
                pendingBooking.busId,

              journeyDate:
                pendingBooking
                  .journeyDate,

              selectionId:
                pendingBooking
                  .selectionId,
            }),
        }
      );


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      stopHoldRefresh();

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "userToken"
      );


      showToast(
        "Your login session has expired. Please login again.",
        "error"
      );


      setTimeout(
        () => {
          window.location.href =
            "login.html";
        },
        1500
      );


      return false;
    }


    const data =
      await response.json();


    if (!response.ok) {

      console.warn(
        "Seat hold refresh failed:",
        data
      );

      return false;
    }


    console.log(
      "Temporary seat hold refreshed:",
      data
    );


    return true;


  } catch (error) {

    console.error(
      "Temporary hold refresh error:",
      error
    );


    return false;
  }
}


// ======================================================
// START TEMP HOLD REFRESH
// ======================================================

function startHoldRefresh() {

  stopHoldRefresh();


  // Refresh once immediately
  refreshTemporaryHold();


  // Then every 60 seconds
  holdRefreshInterval =
    setInterval(
      () => {
        refreshTemporaryHold();
      },

      60 * 1000
    );
}


// ======================================================
// NO PENDING BOOKING
// ======================================================

if (!pendingBooking) {

  showToast(
    "Please search and select seats first.",
    "error"
  );


  setTimeout(
    () => {
      window.location.href =
        "home.html";
    },
    1500
  );
}


// ======================================================
// OLD / INVALID PENDING BOOKING
//
// New system requires selectionId.
// ======================================================

if (
  pendingBooking &&
  !pendingBooking.selectionId
) {

  localStorage.removeItem(
    "pendingBooking"
  );


  showToast(
    "Your seat selection session is invalid. Please select the seats again.",
    "error"
  );


  setTimeout(
    () => {
      window.location.href =
        "home.html";
    },
    1800
  );
}


// ======================================================
// SHOW BOOKING SUMMARY
// ======================================================

if (
  pendingBooking &&
  pendingBooking.selectionId
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


  if (summaryBus) {

    summaryBus.textContent =
      `${pendingBooking.busNo} ` +
      `(${pendingBooking.departTime} - ${pendingBooking.arriveTime})`;
  }


  if (summaryDate) {

    summaryDate.textContent =
      pendingBooking
        .journeyDate;
  }


  if (summarySeats) {

    summarySeats.textContent =
      Array.isArray(
        pendingBooking.seats
      )
        ? pendingBooking
            .seats
            .join(", ")
        : "";
  }


  if (summaryBoarding) {

    summaryBoarding.textContent =
      pendingBooking
        .boardingPoint;
  }


  if (summaryDropping) {

    summaryDropping.textContent =
      pendingBooking
        .droppingPoint;
  }


  if (summaryFare) {

    summaryFare.textContent =
      `Rs.${pendingBooking.totalFare}`;
  }


  // Keep temporary seats alive
  // while passenger fills the form.
  startHoldRefresh();
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


      setTimeout(
        () => {
          window.location.href =
            "login.html";
        },
        1500
      );


      return;
    }


    // ==================================================
    // PENDING BOOKING CHECK
    // ==================================================

    if (!pendingBooking) {

      showToast(
        "Booking information is missing. Please select seats again.",
        "error"
      );

      return;
    }


    // ==================================================
    // SELECTION ID CHECK
    // ==================================================

    if (
      !pendingBooking
        .selectionId
    ) {

      showToast(
        "Seat selection session is missing. Please select seats again.",
        "error"
      );

      return;
    }


    // ==================================================
    // TOKEN CHECK
    // ==================================================

    const token =
      getAuthToken();


    if (!token) {

      showToast(
        "Your login session has expired. Please login again.",
        "error"
      );


      localStorage.removeItem(
        "user"
      );


      setTimeout(
        () => {
          window.location.href =
            "login.html";
        },
        1500
      );


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
      "Confirming seats...";


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
    // REFRESH ONCE BEFORE SUBMIT
    //
    // Gives us the safest chance that
    // temporary lock is still active.
    // ==================================================

    await refreshTemporaryHold();


    // ==================================================
    // PREPARE BOOKING DATA
    // ==================================================

    const bookingData = {

      userId:
        user.id,

      busId:
        pendingBooking
          .busId,

      journeyDate:
        pendingBooking
          .journeyDate,

      passengerName,

      mobileNo,

      nicNo,

      email,

      seats:
        pendingBooking
          .seats,

      boardingPoint:
        pendingBooking
          .boardingPoint,

      droppingPoint:
        pendingBooking
          .droppingPoint,

      totalFare:
        pendingBooking
          .totalFare,


      // ================================================
      // VERY IMPORTANT
      //
      // Backend uses this to find the SeatLocks
      // created when user clicked seats.
      // ================================================

      selectionId:
        pendingBooking
          .selectionId,
    };


    console.log(
      "Creating booking:",
      bookingData
    );


    // ==================================================
    // CREATE PENDING BOOKING
    //
    // Existing temporary locks:
    //
    // bookingId = null
    //       ↓
    // bookingId = booking._id
    //
    // Hold:
    // 2 min temporary
    //       ↓
    // 15 min payment hold
    // ==================================================

    try {

      const response =
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
        await response.json();


      // ==================================================
      // LOGIN EXPIRED
      // ==================================================

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        stopHoldRefresh();


        localStorage.removeItem(
          "user"
        );

        localStorage.removeItem(
          "userToken"
        );


        showToast(
          data.message ||
            "Your login session has expired. Please login again.",
          "error"
        );


        setTimeout(
          () => {

            window.location.href =
              "login.html";

          },
          1500
        );


        return;
      }


      // ==================================================
      // BOOKING CREATED
      // ==================================================

      if (
        response.ok &&
        data.success
      ) {

        stopHoldRefresh();


        // ================================================
        // SAVE CURRENT BOOKING
        // ================================================

        localStorage.setItem(
          "currentBooking",

          JSON.stringify(
            data.booking
          )
        );


        // ================================================
        // SAVE 15-MIN HOLD EXPIRY
        // ================================================

        const holdExpiresAt =
          data.booking
            ?.holdExpiresAt ||

          data.holdExpiresAt;


        if (
          holdExpiresAt
        ) {

          localStorage.setItem(
            "holdExpiresAt",
            holdExpiresAt
          );
        }


        // ================================================
        // PENDING SELECTION NO LONGER REQUIRED
        //
        // SeatLocks now belong to Booking.
        // ================================================

        localStorage.removeItem(
          "pendingBooking"
        );


        showToast(
          "Seats held for 15 minutes. Complete payment to confirm your booking.",
          "success"
        );


        // ================================================
        // GO TO PAYMENT PAGE
        // ================================================

        setTimeout(
          () => {

            window.location.href =
              "payment.html";

          },
          700
        );


        return;
      }


      // ==================================================
      // SEAT HOLD LOST / EXPIRED
      // ==================================================

      if (
        response.status === 409 ||
        data.expired
      ) {

        stopHoldRefresh();


        const conflicts =
          Array.isArray(
            data.conflicts
          )
            ? data.conflicts
            : [];


        if (
          conflicts.length >
          0
        ) {

          showToast(
            `Seat ${conflicts.join(
              ", "
            )} is no longer available. Please select another seat.`,
            "error"
          );

        } else {

          showToast(
            data.message ||
              "Your seat hold is no longer valid. Please select the seats again.",
            "error"
          );
        }


        // Old pending selection should not be reused
        localStorage.removeItem(
          "pendingBooking"
        );


        setTimeout(
          () => {

            window.history.back();

          },
          1800
        );


        return;
      }


      // ==================================================
      // OTHER BACKEND ERROR
      // ==================================================

      showToast(
        data.message ||
          "Could not create the booking.",
        "error"
      );


    } catch (error) {

      console.error(
        "Booking create error:",
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


// ======================================================
// PAGE UNLOAD
//
// Don't release seats here.
//
// Reasons:
//
// booking-details → payment
// also triggers beforeunload.
//
// Temporary hold will expire automatically
// if user completely leaves.
//
// Once booking created,
// 15 minute hold handles it.
// ======================================================

window.addEventListener(
  "beforeunload",
  () => {

    stopHoldRefresh();
  }
);