const API_BASE = "http://localhost:5000/api";

const user = JSON.parse(
  localStorage.getItem("user") || "null"
);

const pendingBooking = JSON.parse(
  localStorage.getItem("pendingBooking") || "null"
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
    window.location.href = "home.html";
  }, 1500);
}


// ======================================================
// SHOW BOOKING SUMMARY
// ======================================================

if (pendingBooking) {
  const summaryBus =
    document.getElementById("summaryBus");

  const summaryDate =
    document.getElementById("summaryDate");

  const summarySeats =
    document.getElementById("summarySeats");

  const summaryBoarding =
    document.getElementById("summaryBoarding");

  const summaryDropping =
    document.getElementById("summaryDropping");

  const summaryFare =
    document.getElementById("summaryFare");


  if (summaryBus) {
    summaryBus.textContent =
      `${pendingBooking.busNo} ` +
      `(${pendingBooking.departTime} - ${pendingBooking.arriveTime})`;
  }


  if (summaryDate) {
    summaryDate.textContent =
      pendingBooking.journeyDate;
  }


  if (summarySeats) {
    summarySeats.textContent =
      pendingBooking.seats.join(", ");
  }


  if (summaryBoarding) {
    summaryBoarding.textContent =
      pendingBooking.boardingPoint;
  }


  if (summaryDropping) {
    summaryDropping.textContent =
      pendingBooking.droppingPoint;
  }


  if (summaryFare) {
    summaryFare.textContent =
      `Rs.${pendingBooking.totalFare}`;
  }
}


// ======================================================
// CONTINUE TO PAYMENT
// ======================================================

const paymentBtn =
  document.getElementById("paymentBtn");


paymentBtn?.addEventListener(
  "click",
  async () => {

    // --------------------------------------------------
    // USER LOGIN CHECK
    // --------------------------------------------------

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


    if (!pendingBooking) {
      return;
    }


    // Prevent double click
    paymentBtn.disabled = true;

    const originalText =
      paymentBtn.textContent;

    paymentBtn.textContent =
      "Holding seats...";


    // --------------------------------------------------
    // PASSENGER DETAILS
    // --------------------------------------------------

    const passengerName =
      document
        .getElementById("passengerName")
        .value
        .trim();


    const mobileNo =
      document
        .getElementById("mobileNo")
        .value
        .trim();


    const nicNo =
      document
        .getElementById("nicNo")
        .value
        .trim();


    const email =
      document
        .getElementById("passengerEmail")
        .value
        .trim();


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !passengerName ||
      !mobileNo ||
      !email
    ) {
      showToast(
        "Please fill required details",
        "error"
      );

      paymentBtn.disabled = false;

      paymentBtn.textContent =
        originalText;

      return;
    }


    // --------------------------------------------------
    // PREPARE BOOKING DATA
    // --------------------------------------------------

    const bookingData = {
      userId:
        user.id,

      busId:
        pendingBooking.busId,

      journeyDate:
        pendingBooking.journeyDate,

      passengerName,

      mobileNo,

      nicNo,

      email,

      seats:
        pendingBooking.seats,

      boardingPoint:
        pendingBooking.boardingPoint,

      droppingPoint:
        pendingBooking.droppingPoint,

      totalFare:
        pendingBooking.totalFare,
    };


    // --------------------------------------------------
    // CREATE TEMPORARY BOOKING HOLD
    // --------------------------------------------------

    try {
      const token =
        localStorage.getItem(
          "userToken"
        );


      if (!token) {
        showToast(
          "Your login session has expired. Please login again.",
          "error"
        );

        localStorage.removeItem("user");

        setTimeout(() => {
          window.location.href =
            "login.html";
        }, 1500);

        return;
      }


      const res = await fetch(
        `${API_BASE}/bookings/create`,
        {
          method: "POST",

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


      // --------------------------------------------------
      // HOLD CREATED SUCCESSFULLY
      // --------------------------------------------------

      if (data.success) {

        /*
          Backend bookingRoutes.js
          must return something like:

          booking.status = "Pending"
          booking.holdExpiresAt = ...

          From this point seats are HELD,
          not permanently booked.
        */


        localStorage.setItem(
          "currentBooking",
          JSON.stringify(
            data.booking
          )
        );


        // Save hold expiry separately
        // payment page timer use pannum
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


        // Original green seat selection
        // no longer needed
        localStorage.removeItem(
          "pendingBooking"
        );


        showToast(
          "Seats held for 15 minutes. Complete payment to confirm your booking.",
          "success"
        );


        // Go payment page
        setTimeout(() => {
          window.location.href =
            "payment.html";
        }, 700);


        return;
      }


      // --------------------------------------------------
      // HOLD FAILED
      // Example:
      // another user already held/booked same seat
      // --------------------------------------------------

      if (
        Array.isArray(
          data.conflicts
        ) &&
        data.conflicts.length > 0
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

      } else {
        showToast(
          data.message ||
            "Could not hold the selected seats.",
          "error"
        );
      }


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

      paymentBtn.disabled = false;

      paymentBtn.textContent =
        originalText;
    }
  }
);