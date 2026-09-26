const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {

  // =====================================================
  // ELEMENTS
  // =====================================================

  const card3d =
    document.getElementById("card3d");

  const cardNameDisplay =
    document.getElementById("cardNameDisplay");

  const cardNumberDisplay =
    document.getElementById("cardNumberDisplay");

  const cardExpiryDisplay =
    document.getElementById("cardExpiryDisplay");

  const cardCvvDisplay =
    document.getElementById("cardCvvDisplay");


  const cardHolderInput =
    document.getElementById("cardHolderInput");

  const cardNumberInput =
    document.getElementById("cardNumberInput");

  const cardExpiryInput =
    document.getElementById("cardExpiryInput");

  const cardCvvInput =
    document.getElementById("cardCvvInput");


  const paymentAmount =
    document.getElementById("paymentAmount");

  const payBtn =
    document.getElementById("payBtn");


  // =====================================================
  // LOAD BOOKING
  // =====================================================

  const booking = JSON.parse(
    localStorage.getItem("currentBooking") || "null"
  );


  if (!booking) {

    showToast(
      "No booking found",
      "error"
    );


    setTimeout(() => {
      window.location.href =
        "booking-details.html";
    }, 1500);


    return;
  }


  // =====================================================
  // PAYMENT AMOUNT
  // =====================================================

  if (paymentAmount) {
    paymentAmount.textContent =
      `Rs. ${booking.totalFare}`;
  }


  // =====================================================
  // CARD HOLDER NAME
  // =====================================================

  if (cardHolderInput) {

    cardHolderInput.addEventListener(
      "input",
      () => {

        const name =
          cardHolderInput.value.trim();


        if (cardNameDisplay) {
          cardNameDisplay.textContent =
            name
              ? name.toUpperCase()
              : "YOUR NAME";
        }
      }
    );
  }


  // =====================================================
  // CARD NUMBER
  // =====================================================

  if (cardNumberInput) {

    cardNumberInput.addEventListener(
      "input",
      () => {

        const digits =
          cardNumberInput.value
            .replace(/\D/g, "")
            .slice(0, 16);


        const grouped =
          digits
            .replace(/(.{4})/g, "$1 ")
            .trim();


        cardNumberInput.value =
          grouped;


        const placeholder =
          "•••• •••• •••• ••••";


        if (cardNumberDisplay) {

          cardNumberDisplay.textContent =
            grouped
              ? grouped +
                placeholder.slice(
                  grouped.length
                )
              : placeholder;
        }


        if (card3d) {

          card3d.classList.remove(
            "brand-visa",
            "brand-mastercard"
          );


          // VISA
          if (
            digits.startsWith("4")
          ) {

            card3d.classList.add(
              "brand-visa"
            );

          }

          // MasterCard
          else if (
            /^5[1-5]/.test(digits)
          ) {

            card3d.classList.add(
              "brand-mastercard"
            );
          }
        }
      }
    );
  }


  // =====================================================
  // EXPIRY
  // =====================================================

  if (cardExpiryInput) {

    cardExpiryInput.addEventListener(
      "input",
      () => {

        let digits =
          cardExpiryInput.value
            .replace(/\D/g, "")
            .slice(0, 4);


        if (
          digits.length > 2
        ) {

          digits =
            digits.slice(0, 2) +
            "/" +
            digits.slice(2);
        }


        cardExpiryInput.value =
          digits;


        if (cardExpiryDisplay) {

          cardExpiryDisplay.textContent =
            digits || "MM/YY";
        }
      }
    );
  }


  // =====================================================
  // CVV
  // =====================================================

  if (cardCvvInput) {

    cardCvvInput.addEventListener(
      "input",
      () => {

        const digits =
          cardCvvInput.value
            .replace(/\D/g, "")
            .slice(0, 3);


        cardCvvInput.value =
          digits;


        const placeholder =
          "•••";


        if (cardCvvDisplay) {

          cardCvvDisplay.textContent =
            digits
              ? digits +
                placeholder.slice(
                  digits.length
                )
              : placeholder;
        }
      }
    );


    cardCvvInput.addEventListener(
      "focus",
      () => {

        if (card3d) {
          card3d.classList.add(
            "flipped"
          );
        }
      }
    );


    cardCvvInput.addEventListener(
      "blur",
      () => {

        if (card3d) {
          card3d.classList.remove(
            "flipped"
          );
        }
      }
    );
  }


  // =====================================================
  // CREATE HOLD TIMER DISPLAY
  // =====================================================

  let holdTimer =
    document.getElementById("holdTimer");


  // If payment.html does not already contain holdTimer,
  // create it automatically.
  if (!holdTimer) {

    holdTimer =
      document.createElement("div");


    holdTimer.id =
      "holdTimer";


    holdTimer.style.margin =
      "15px 0";


    holdTimer.style.padding =
      "12px";


    holdTimer.style.borderRadius =
      "8px";


    holdTimer.style.fontWeight =
      "600";


    holdTimer.style.textAlign =
      "center";


    holdTimer.style.background =
      "#fff3cd";


    holdTimer.style.color =
      "#8a5200";


    if (
      payBtn &&
      payBtn.parentNode
    ) {

      payBtn.parentNode.insertBefore(
        holdTimer,
        payBtn
      );
    }
  }


  // =====================================================
  // GET HOLD EXPIRY
  // =====================================================

  let holdExpiresAt =
    booking.holdExpiresAt ||
    localStorage.getItem(
      "holdExpiresAt"
    );


  // Fallback:
  // If backend somehow didn't provide holdExpiresAt,
  // use booking created time + 15 minutes.
  if (
    !holdExpiresAt &&
    booking.createdAt
  ) {

    holdExpiresAt =
      new Date(
        new Date(
          booking.createdAt
        ).getTime() +
        15 * 60 * 1000
      ).toISOString();
  }


  const expiryTime =
    new Date(
      holdExpiresAt
    ).getTime();


  // =====================================================
  // HOLD TIMER
  // =====================================================

  let timerInterval = null;

  let expiryHandled = false;


  function handleHoldExpired() {

    if (expiryHandled) {
      return;
    }


    expiryHandled = true;


    if (timerInterval) {
      clearInterval(
        timerInterval
      );
    }


    if (holdTimer) {

      holdTimer.textContent =
        "Seat hold expired";

      holdTimer.style.background =
        "#f8d7da";

      holdTimer.style.color =
        "#842029";
    }


    if (payBtn) {

      payBtn.disabled =
        true;

      payBtn.textContent =
        "Hold Expired";
    }


    localStorage.removeItem(
      "holdExpiresAt"
    );


    showToast(
      "Your 15-minute seat hold has expired. Please select the seats again.",
      "error"
    );


    /*
      Backend holdCleanup.js will:
      1. Delete SeatLock
      2. Change booking status to Expired
      3. Send realtime released event
      4. Orange seat becomes available again
    */


    setTimeout(() => {

      localStorage.removeItem(
        "currentBooking"
      );


      window.location.href =
        "home.html";

    }, 2500);
  }


  function updateTimer() {

    // Already Paid booking-ku timer thevai illa
    if (
      booking.status === "Paid"
    ) {

      if (holdTimer) {
        holdTimer.textContent =
          "Payment completed";
      }

      return;
    }


    if (
      !expiryTime ||
      Number.isNaN(
        expiryTime
      )
    ) {

      if (holdTimer) {

        holdTimer.textContent =
          "Complete payment to confirm your booking";
      }

      return;
    }


    const remaining =
      expiryTime -
      Date.now();


    if (remaining <= 0) {

      handleHoldExpired();

      return;
    }


    const totalSeconds =
      Math.floor(
        remaining / 1000
      );


    const minutes =
      Math.floor(
        totalSeconds / 60
      );


    const seconds =
      totalSeconds % 60;


    const display =
      `${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(
        2,
        "0"
      )}`;


    if (holdTimer) {

      holdTimer.textContent =
        `Seats held for: ${display}`;
    }
  }


  updateTimer();


  timerInterval =
    setInterval(
      updateTimer,
      1000
    );


  // =====================================================
  // VALIDATE CARD EXPIRY
  // =====================================================

  function isValidExpiry(
    value
  ) {

    if (
      !/^\d{2}\/\d{2}$/.test(
        value
      )
    ) {
      return false;
    }


    const [
      monthString,
      yearString,
    ] =
      value.split("/");


    const month =
      Number(monthString);


    const year =
      2000 +
      Number(yearString);


    if (
      month < 1 ||
      month > 12
    ) {
      return false;
    }


    const now =
      new Date();


    // Last moment of expiry month
    const expiryDate =
      new Date(
        year,
        month,
        0,
        23,
        59,
        59
      );


    return (
      expiryDate >= now
    );
  }


  // =====================================================
  // VALIDATE PAYMENT DETAILS
  // =====================================================

  function validatePaymentDetails() {

    const holder =
      cardHolderInput
        ?.value
        .trim() || "";


    const cardNumber =
      cardNumberInput
        ?.value
        .replace(/\D/g, "") ||
      "";


    const expiry =
      cardExpiryInput
        ?.value
        .trim() || "";


    const cvv =
      cardCvvInput
        ?.value
        .replace(/\D/g, "") ||
      "";


    if (!holder) {

      showToast(
        "Please enter card holder name",
        "error"
      );

      cardHolderInput?.focus();

      return false;
    }


    if (
      cardNumber.length !==
      16
    ) {

      showToast(
        "Please enter a valid 16-digit card number",
        "error"
      );

      cardNumberInput?.focus();

      return false;
    }


    if (
      !isValidExpiry(
        expiry
      )
    ) {

      showToast(
        "Please enter a valid card expiry date",
        "error"
      );

      cardExpiryInput?.focus();

      return false;
    }


    if (
      cvv.length !== 3
    ) {

      showToast(
        "Please enter a valid 3-digit CVV",
        "error"
      );

      cardCvvInput?.focus();

      return false;
    }


    return true;
  }


  // =====================================================
  // PAYMENT
  // =====================================================

  payBtn?.addEventListener(
    "click",
    async () => {

      // -------------------------------------------------
      // CHECK HOLD EXPIRY FIRST
      // -------------------------------------------------

      if (
        expiryTime &&
        Date.now() >=
          expiryTime
      ) {

        handleHoldExpired();

        return;
      }


      // -------------------------------------------------
      // VALIDATE CARD
      // -------------------------------------------------

      if (
        !validatePaymentDetails()
      ) {

        return;
      }


      const token =
        localStorage.getItem(
          "userToken"
        );


      if (!token) {

        showToast(
          "Please login again",
          "error"
        );


        setTimeout(() => {

          window.location.href =
            "login.html";

        }, 1200);


        return;
      }


      // Prevent double payment click
      payBtn.disabled =
        true;


      const originalText =
        payBtn.textContent;


      payBtn.textContent =
        "Processing Payment...";


      try {

        // -----------------------------------------------
        // PAYMENT CONFIRMATION
        // -----------------------------------------------

        const res =
          await fetch(
            `${API_BASE}/bookings/pay/${booking._id}`,
            {
              method:
                "PUT",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );


        const data =
          await res.json();


        // -----------------------------------------------
        // SUCCESS
        // -----------------------------------------------

        if (data.success) {

          if (timerInterval) {

            clearInterval(
              timerInterval
            );
          }


          localStorage.setItem(
            "currentBooking",
            JSON.stringify(
              data.booking
            )
          );


          localStorage.removeItem(
            "holdExpiresAt"
          );


          if (holdTimer) {

            holdTimer.textContent =
              "Payment completed - seats confirmed";

            holdTimer.style.background =
              "#d1e7dd";

            holdTimer.style.color =
              "#0f5132";
          }


          showToast(
            "Payment successful. Your seats are now booked.",
            "success"
          );


          /*
            Backend /pay/:id must now:

            Booking:
              Pending → Paid

            SeatLock:
              held → booked

            expiresAt:
              date → null

            Realtime event:
              action = "booked"

            Result:
              🟧 Orange → 🟥 Red
          */


          setTimeout(() => {

            window.location.href =
              "booking-history.html";

          }, 1500);


          return;
        }


        // -----------------------------------------------
        // PAYMENT FAILED / HOLD EXPIRED
        // -----------------------------------------------

        showToast(
          data.message ||
            "Payment failed",
          "error"
        );


        if (
          data.expired === true
        ) {

          handleHoldExpired();

          return;
        }


        payBtn.disabled =
          false;


        payBtn.textContent =
          originalText;

      } catch (error) {

        console.error(
          "Payment error:",
          error
        );


        showToast(
          "Could not reach the payment server.",
          "error"
        );


        payBtn.disabled =
          false;


        payBtn.textContent =
          originalText;
      }
    }
  );


  // =====================================================
  // PAGE CLOSE
  // =====================================================

  window.addEventListener(
    "beforeunload",
    () => {

      if (timerInterval) {

        clearInterval(
          timerInterval
        );
      }
    }
  );
});