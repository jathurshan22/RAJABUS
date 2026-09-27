const API_BASE = "http://localhost:5000/api";


// ======================================================
// HELPERS
// ======================================================

function toast(message, type = "success") {
  if (typeof showToast === "function") {
    showToast(message, type);
  } else {
    alert(message);
  }
}


function setPayButton(text, disabled = false) {
  const button = document.getElementById("payBtn");

  if (!button) {
    return;
  }

  button.disabled = disabled;

  button.innerHTML = `
    <i class="fa-solid fa-lock"></i>
    ${text}
  `;
}


// ======================================================
// ELEMENTS
// ======================================================

const payBtn =
  document.getElementById("payBtn");

const paymentAmount =
  document.getElementById("paymentAmount");

const holdTimer =
  document.getElementById("holdTimer");


// ======================================================
// GET CURRENT BOOKING
// ======================================================

let booking = null;

try {
  booking = JSON.parse(
    localStorage.getItem("currentBooking") || "null"
  );
} catch (error) {
  console.error(
    "Invalid currentBooking:",
    error
  );
}


if (!booking) {
  toast(
    "No booking found.",
    "error"
  );

  setPayButton(
    "Booking Not Found",
    true
  );

  setTimeout(() => {
    window.location.href =
      "booking-details.html";
  }, 1800);
}


// Mongo booking id support
const bookingId =
  booking?._id ||
  booking?.id ||
  null;


// ======================================================
// SHOW PAYMENT AMOUNT
// ======================================================

if (
  booking &&
  paymentAmount
) {
  const amount =
    Number(
      booking.totalFare || 0
    );

  paymentAmount.textContent =
    `Rs. ${amount.toFixed(2)}`;
}


// ======================================================
// 15 MINUTE HOLD TIMER
// ======================================================

let timerInterval = null;

let expiryHandled = false;

let paymentStarted = false;


function handleExpired() {
  if (expiryHandled) {
    return;
  }

  expiryHandled = true;


  if (timerInterval) {
    clearInterval(
      timerInterval
    );

    timerInterval = null;
  }


  if (holdTimer) {
    holdTimer.innerHTML = `
      <i class="fa-solid fa-circle-exclamation"></i>
      Seat hold expired
    `;

    holdTimer.style.background =
      "#f8d7da";

    holdTimer.style.color =
      "#842029";

    holdTimer.style.borderColor =
      "#f5c2c7";
  }


  setPayButton(
    "Hold Expired",
    true
  );


  localStorage.removeItem(
    "holdExpiresAt"
  );


  toast(
    "Your 15-minute seat hold has expired. Please select the seats again.",
    "error"
  );


  setTimeout(() => {

    localStorage.removeItem(
      "currentBooking"
    );

    window.location.href =
      "home.html";

  }, 2500);
}


function startHoldTimer() {
  if (!booking) {
    return;
  }


  const expiresAt =
    booking.holdExpiresAt ||
    localStorage.getItem(
      "holdExpiresAt"
    );


  if (!expiresAt) {
    console.warn(
      "No holdExpiresAt found for booking."
    );

    return;
  }


  const expiryTime =
    new Date(
      expiresAt
    ).getTime();


  if (
    Number.isNaN(
      expiryTime
    )
  ) {
    console.error(
      "Invalid hold expiry:",
      expiresAt
    );

    return;
  }


  function updateTimer() {

    const remaining =
      expiryTime -
      Date.now();


    if (remaining <= 0) {
      handleExpired();

      return;
    }


    const totalSeconds =
      Math.ceil(
        remaining / 1000
      );


    const minutes =
      Math.floor(
        totalSeconds / 60
      );


    const seconds =
      totalSeconds % 60;


    if (holdTimer) {
      holdTimer.innerHTML = `
        <i class="fa-regular fa-clock"></i>
        Seats held for:
        ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}
      `;
    }
  }


  updateTimer();


  timerInterval =
    setInterval(
      updateTimer,
      1000
    );
}


startHoldTimer();


// ======================================================
// CHECK LOGIN
// ======================================================

function getToken() {
  return localStorage.getItem(
    "userToken"
  );
}


// ======================================================
// CHECK PAYMENT STATUS FROM BACKEND
// ======================================================

async function checkPaymentStatus() {

  if (!bookingId) {
    console.error(
      "Booking ID missing."
    );

    return {
      paid: false,
      expired: false,
    };
  }


  const token =
    getToken();


  if (!token) {
    return {
      paid: false,
      expired: false,
    };
  }


  try {

    const response =
      await fetch(
        `${API_BASE}/payments/status/${bookingId}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );


    let data = null;


    try {
      data =
        await response.json();
    } catch (error) {

      console.error(
        "Payment status returned invalid JSON."
      );

      return {
        paid: false,
        expired: false,
      };
    }


    console.log(
      "PAYMENT STATUS:",
      data
    );


    if (!response.ok) {
      console.error(
        "Payment status request failed:",
        response.status,
        data
      );

      return {
        paid: false,
        expired: false,
      };
    }


    if (
      data.success &&
      data.paid
    ) {

      if (timerInterval) {
        clearInterval(
          timerInterval
        );

        timerInterval = null;
      }


      booking.status =
        "Paid";

      booking.holdExpiresAt =
        null;


      localStorage.setItem(
        "currentBooking",
        JSON.stringify(
          booking
        )
      );


      localStorage.removeItem(
        "holdExpiresAt"
      );


      toast(
        "Payment successful. Your booking is confirmed.",
        "success"
      );


      setPayButton(
        "Payment Successful",
        true
      );


      setTimeout(() => {

        window.location.href =
          "booking-history.html";

      }, 1800);


      return {
        paid: true,
        expired: false,
      };
    }


    if (
      data.success &&
      data.expired
    ) {

      handleExpired();


      return {
        paid: false,
        expired: true,
      };
    }


    return {
      paid: false,
      expired: false,
    };


  } catch (error) {

    console.error(
      "Payment status check error:",
      error
    );


    return {
      paid: false,
      expired: false,
    };
  }
}


// ======================================================
// PAYHERE SDK CHECK
// ======================================================

function payHereAvailable() {

  return (
    typeof window.payhere !==
      "undefined" &&

    typeof window.payhere.startPayment ===
      "function"
  );
}


// ======================================================
// PAYHERE CALLBACKS
// ======================================================

if (payHereAvailable()) {

  // ----------------------------------------------------
  // CHECKOUT COMPLETED
  //
  // IMPORTANT:
  // This does NOT automatically mean successful payment.
  // Backend notify_url must verify it.
  // ----------------------------------------------------

  window.payhere.onCompleted =
    function (orderId) {

      console.log(
        "PayHere checkout completed."
      );

      console.log(
        "Order ID:",
        orderId
      );


      toast(
        "Payment processed. Verifying payment...",
        "success"
      );


      setPayButton(
        "Verifying Payment...",
        true
      );


      let attempts = 0;

      const maxAttempts = 20;


      const verificationTimer =
        setInterval(
          async () => {

            attempts++;


            console.log(
              `Checking payment status ${attempts}/${maxAttempts}`
            );


            const result =
              await checkPaymentStatus();


            if (
              result.paid ||
              result.expired
            ) {

              clearInterval(
                verificationTimer
              );

              return;
            }


            if (
              attempts >=
              maxAttempts
            ) {

              clearInterval(
                verificationTimer
              );


              toast(
                "Payment is still being verified. Please check Journey History shortly.",
                "error"
              );


              paymentStarted =
                false;


              setPayButton(
                "Pay with PayHere",
                false
              );
            }

          },
          1500
        );
    };


  // ----------------------------------------------------
  // USER CLOSED POPUP
  // ----------------------------------------------------

  window.payhere.onDismissed =
    function () {

      console.log(
        "PayHere payment window dismissed."
      );


      paymentStarted =
        false;


      if (!expiryHandled) {

        setPayButton(
          "Pay with PayHere",
          false
        );

      }


      toast(
        "Payment window closed. Your seats remain held until the timer expires.",
        "error"
      );
    };


  // ----------------------------------------------------
  // PAYHERE PARAMETER / DOMAIN ERROR
  // ----------------------------------------------------

  window.payhere.onError =
    function (error) {

      console.error(
        "=============================="
      );

      console.error(
        "PAYHERE EXACT ERROR:"
      );

      console.error(
        error
      );

      console.error(
        "Current page:",
        window.location.href
      );

      console.error(
        "Current origin:",
        window.location.origin
      );

      console.error(
        "=============================="
      );


      paymentStarted =
        false;


      let message =
        "PayHere payment request failed.";


      if (
        typeof error ===
        "string"
      ) {

        message =
          error;

      } else if (
        error &&
        typeof error.message ===
          "string"
      ) {

        message =
          error.message;

      } else if (error) {

        try {

          message =
            JSON.stringify(
              error
            );

        } catch (_) {
          // keep default
        }
      }


      toast(
        `PayHere: ${message}`,
        "error"
      );


      if (!expiryHandled) {

        setPayButton(
          "Pay with PayHere",
          false
        );

      }
    };

} else {

  console.error(
    "PayHere SDK was not loaded."
  );


  toast(
    "PayHere SDK could not be loaded. Please refresh the page.",
    "error"
  );


  setPayButton(
    "PayHere Unavailable",
    true
  );
}


// ======================================================
// CREATE + START PAYHERE PAYMENT
// ======================================================

async function startPayHerePayment() {

  if (!booking) {

    toast(
      "Booking information is missing.",
      "error"
    );

    return;
  }


  if (!bookingId) {

    toast(
      "Booking ID is missing.",
      "error"
    );

    console.error(
      "Current booking:",
      booking
    );

    return;
  }


  if (expiryHandled) {

    toast(
      "Your seat hold has expired.",
      "error"
    );

    return;
  }


  if (paymentStarted) {

    console.log(
      "Payment already being started."
    );

    return;
  }


  const token =
    getToken();


  if (!token) {

    toast(
      "Please login again.",
      "error"
    );


    setTimeout(() => {

      window.location.href =
        "login.html";

    }, 1200);


    return;
  }


  if (!payHereAvailable()) {

    toast(
      "PayHere SDK is not available. Refresh the page and try again.",
      "error"
    );

    return;
  }


  paymentStarted =
    true;


  setPayButton(
    "Opening PayHere...",
    true
  );


  try {

    // ==================================================
    // CALL BACKEND
    // ==================================================

    const response =
      await fetch(
        `${API_BASE}/payments/create/${bookingId}`,
        {
          method:
            "POST",

          headers: {

            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",
          },
        }
      );


    const rawResponse =
      await response.text();


    let data = null;


    try {

      data =
        JSON.parse(
          rawResponse
        );

    } catch (error) {

      console.error(
        "Backend returned non-JSON response:"
      );

      console.error(
        rawResponse
      );


      throw new Error(
        `Backend returned invalid response (${response.status})`
      );
    }


    console.log(
      "PAYMENT CREATE RESPONSE:",
      data
    );


    if (
      !response.ok ||
      !data.success
    ) {

      paymentStarted =
        false;


      const message =
        data.message ||
        `Payment request failed (${response.status})`;


      console.error(
        "Create payment failed:",
        data
      );


      toast(
        message,
        "error"
      );


      if (
        data.expired
      ) {

        handleExpired();

        return;
      }


      setPayButton(
        "Pay with PayHere",
        false
      );


      return;
    }


    if (!data.payment) {

      paymentStarted =
        false;


      throw new Error(
        "Backend did not return PayHere payment data."
      );
    }


    // ==================================================
    // BUILD FINAL PAYHERE PAYMENT OBJECT
    // ==================================================

    const payment = {
      ...data.payment,
    };


    /*
      VERY IMPORTANT

      When backend sends JSON,
      properties whose value is undefined
      disappear.

      PayHere JavaScript SDK example
      expects these properties explicitly.
    */

    payment.return_url =
      undefined;

    payment.cancel_url =
      undefined;


    // Force correct Sandbox boolean
    payment.sandbox =
      true;


    // Clean strings
    payment.merchant_id =
      String(
        payment.merchant_id || ""
      ).trim();


    payment.order_id =
      String(
        payment.order_id || ""
      ).trim();


    payment.items =
      String(
        payment.items ||
        "Raja Bus Ticket"
      ).trim();


    payment.currency =
      String(
        payment.currency ||
        "LKR"
      )
        .trim()
        .toUpperCase();


    payment.amount =
      Number(
        payment.amount
      ).toFixed(2);


    payment.hash =
      String(
        payment.hash || ""
      )
        .trim()
        .toUpperCase();


    payment.first_name =
      String(
        payment.first_name ||
        "Passenger"
      ).trim();


    payment.last_name =
      String(
        payment.last_name ||
        payment.first_name ||
        "Passenger"
      ).trim();


    payment.email =
      String(
        payment.email || ""
      ).trim();


    payment.phone =
      String(
        payment.phone || ""
      ).trim();


    payment.address =
      String(
        payment.address ||
        "Sri Lanka"
      ).trim();


    payment.city =
      String(
        payment.city ||
        "Anuradhapura"
      ).trim();


    payment.country =
      "Sri Lanka";


    // ==================================================
    // REQUIRED FIELD VALIDATION
    // ==================================================

    const requiredFields = [
      "merchant_id",
      "notify_url",
      "order_id",
      "items",
      "amount",
      "currency",
      "hash",
      "first_name",
      "last_name",
      "email",
      "phone",
      "address",
      "city",
      "country",
    ];


    const missingFields =
      requiredFields.filter(
        (field) => {

          const value =
            payment[field];


          return (
            value ===
              undefined ||

            value ===
              null ||

            String(value).trim() ===
              ""
          );
        }
      );


    if (
      missingFields.length >
      0
    ) {

      paymentStarted =
        false;


      console.error(
        "Missing PayHere fields:",
        missingFields
      );


      console.error(
        "Payment object:",
        payment
      );


      toast(
        `Missing payment information: ${missingFields.join(", ")}`,
        "error"
      );


      setPayButton(
        "Pay with PayHere",
        false
      );


      return;
    }


    // ==================================================
    // EMAIL VALIDATION
    // ==================================================

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        payment.email
      );


    if (!validEmail) {

      paymentStarted =
        false;


      console.error(
        "Invalid PayHere email:",
        payment.email
      );


      toast(
        "Passenger email address is invalid.",
        "error"
      );


      setPayButton(
        "Pay with PayHere",
        false
      );


      return;
    }


    // ==================================================
    // AMOUNT VALIDATION
    // ==================================================

    const amountNumber =
      Number(
        payment.amount
      );


    if (
      !Number.isFinite(
        amountNumber
      ) ||
      amountNumber <= 0
    ) {

      paymentStarted =
        false;


      console.error(
        "Invalid payment amount:",
        payment.amount
      );


      toast(
        "Invalid payment amount.",
        "error"
      );


      setPayButton(
        "Pay with PayHere",
        false
      );


      return;
    }


    // ==================================================
    // SAFE DEBUG OUTPUT
    //
    // Don't print actual hash.
    // ==================================================

    console.log(
      "================================"
    );

    console.log(
      "STARTING PAYHERE PAYMENT"
    );

    console.log(
      "Page origin:",
      window.location.origin
    );

    console.log(
      "Merchant ID:",
      payment.merchant_id
    );

    console.log(
      "Order ID:",
      payment.order_id
    );

    console.log(
      "Amount:",
      payment.amount
    );

    console.log(
      "Currency:",
      payment.currency
    );

    console.log(
      "Email:",
      payment.email
    );

    console.log(
      "Phone:",
      payment.phone
    );

    console.log(
      "Notify URL:",
      payment.notify_url
    );

    console.log(
      "Hash:",
      payment.hash
        ? "[GENERATED]"
        : "[MISSING]"
    );

    console.log(
      "Sandbox:",
      payment.sandbox
    );

    console.log(
      "================================"
    );


    // ==================================================
    // OPEN PAYHERE
    // ==================================================

    window.payhere.startPayment(
      payment
    );


  } catch (error) {

    paymentStarted =
      false;


    console.error(
      "=============================="
    );

    console.error(
      "PAYHERE START ERROR:"
    );

    console.error(
      error
    );

    console.error(
      "=============================="
    );


    const message =
      error?.message ||
      "Could not start PayHere payment.";


    toast(
      message,
      "error"
    );


    if (!expiryHandled) {

      setPayButton(
        "Pay with PayHere",
        false
      );

    }
  }
}


// ======================================================
// PAYMENT BUTTON
// ======================================================

payBtn?.addEventListener(
  "click",
  startPayHerePayment
);


// ======================================================
// PAGE UNLOAD
// ======================================================

window.addEventListener(
  "beforeunload",
  () => {

    if (timerInterval) {

      clearInterval(
        timerInterval
      );

      timerInterval =
        null;
    }
  }
);


// ======================================================
// DEBUG INFORMATION
// ======================================================

console.log(
  "Payment page origin:",
  window.location.origin
);

console.log(
  "Current booking ID:",
  bookingId
);

console.log(
  "PayHere SDK loaded:",
  payHereAvailable()
);