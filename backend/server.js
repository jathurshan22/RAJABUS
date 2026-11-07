
"use strict";

// ======================================================
// DNS USED FOR MONGODB CONNECTION
// ======================================================

require("node:dns").setServers([
  "1.1.1.1",
  "8.8.8.8",
]);


// ======================================================
// IMPORT PACKAGES
// ======================================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");


// ======================================================
// LOAD ENV FIRST
// ======================================================

dotenv.config();


// ======================================================
// DATABASE
// ======================================================

const connectDB =
  require("./config/db");

const ensureAdminAccount =
  require("./config/ensureAdminAccount");


// ======================================================
// EXISTING ROUTES
// ======================================================

const authRoutes =
  require("./routes/authRoutes");

const bookingRoutes =
  require("./routes/bookingRoutes");

const busRoutes =
  require("./routes/busRoutes");

const reviewRoutes =
  require("./routes/reviewRoutes");

const busReviewRoutes =
  require("./routes/busReviewRoutes");

const contactRoutes =
  require("./routes/contactRoutes");

const adminRoutes =
  require("./routes/adminRoutes");

const realtimeRoutes =
  require("./routes/realtimeRoutes");

const paymentRoutes =
  require("./routes/paymentRoutes");


// ======================================================
// OPERATOR ROUTES
// ======================================================

const operatorRoutes =
  require("./routes/operatorRoutes");

const operatorBusRoutes =
  require("./routes/operatorBusRoutes");

const operatorTripRoutes =
  require("./routes/operatorTripRoutes");

const operatorDailyBookingsRoutes =
  require("./routes/operatorDailyBookingsRoutes");

const operatorDashboardStatsRoutes =
  require("./routes/operatorDashboardStatsRoutes");


// ======================================================
// PASSENGER TRIP ROUTES
// ======================================================

const tripRoutes =
  require("./routes/tripRoutes");

const tripChatRoutes =
  require("./routes/tripChatRoutes");


// ======================================================
// 15-MINUTE SEAT HOLD CLEANUP
// ======================================================

const {
  startHoldCleanup,
} = require("./utils/holdCleanup");


// ======================================================
// NEW: AUTOMATIC TRIP COMPLETION
// 1 HOUR BEFORE DEPARTURE
// ======================================================

const {
  completeTripsPastCutoff,
  startAutoCompleteTrips,
} = require("./utils/autoCompleteTrips");


// ======================================================
// CREATE EXPRESS APP
// ======================================================

const app = express();


// ======================================================
// FRONTEND STATIC FILES
// ======================================================

const frontendPath = path.join(
  __dirname,
  ".."
);

app.use(
  express.static(frontendPath)
);


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors()
);

app.use(
  express.json()
);


// ======================================================
// NEW: ENFORCE TRIP BOOKING CUTOFF
//
// PURPOSE:
// 1. Automatically complete expired trips
// 2. Prevent expired trips from passenger search
// 3. Update operator trip status
// 4. Prevent new booking after cutoff
//
// TIMEZONE: ASIA/COLOMBO
// ======================================================

app.use(
  "/api",
  async (req, res, next) => {

    // -----------------------------------------------
    // GET API PATH
    // -----------------------------------------------

    const relativePath =
      req.path;


    // -----------------------------------------------
    // PASSENGER / OPERATOR TRIP APIs
    // -----------------------------------------------

    const tripApi =
      /^\/(?:buses|trips|operator-trips)(?:\/|$)/
        .test(relativePath);


    // -----------------------------------------------
    // NEW BOOKING API
    // POST /api/bookings/create
    // -----------------------------------------------

    const creatingBooking =
      req.method === "POST" &&
      relativePath === "/bookings/create";


    // -----------------------------------------------
    // SKIP UNRELATED REQUESTS
    // -----------------------------------------------

    if (
      !tripApi &&
      !creatingBooking
    ) {

      return next();

    }


    // -----------------------------------------------
    // UPDATE EXPIRED TRIPS BEFORE API EXECUTION
    // -----------------------------------------------

    try {

      await completeTripsPastCutoff();

      return next();

    } catch (error) {

      console.error(
        "Trip cutoff verification failed:",
        error
      );

      return res.status(503).json({

        success: false,

        message:
          "Unable to verify trip availability. Please try again."

      });

    }

  }
);


// ======================================================
// API ROUTES
// ======================================================


// AUTH

app.use(
  "/api/auth",
  authRoutes
);


// BOOKINGS

app.use(
  "/api/bookings",
  bookingRoutes
);


// BUSES

app.use(
  "/api/buses",
  busRoutes
);


// WEBSITE REVIEWS

app.use(
  "/api/reviews",
  reviewRoutes
);


// BUS REVIEWS

app.use(
  "/api/bus-reviews",
  busReviewRoutes
);


// CONTACT MESSAGES

app.use(
  "/api/contact",
  contactRoutes
);


// ADMIN

app.use(
  "/api/admin",
  adminRoutes
);


// REALTIME SEAT UPDATES

app.use(
  "/api/realtime",
  realtimeRoutes
);


// PAYMENTS

app.use(
  "/api/payments",
  paymentRoutes
);


// ======================================================
// OPERATOR APIs
// ======================================================


// OPERATOR AUTH / PROFILE

app.use(
  "/api/operators",
  operatorRoutes
);


// OPERATOR DAILY BOOKINGS

app.use(
  "/api/operators",
  operatorDailyBookingsRoutes
);


// OPERATOR BUSES

app.use(
  "/api/operator-buses",
  operatorBusRoutes
);


// OPERATOR TRIPS

app.use(
  "/api/operator-trips",
  operatorTripRoutes
);


// ======================================================
// PASSENGER TRIP APIs
// ======================================================

app.use(
  "/api/trips",
  tripRoutes
);


// TRIP LIVE CHAT

app.use(
  "/api/trip-chat",
  tripChatRoutes
);


// OPERATOR DASHBOARD STATS

app.use(
  "/api/operators",
  operatorDashboardStatsRoutes
);


// ======================================================
// ROOT TEST
// ======================================================

app.get(
  "/",
  (req, res) => {

    res.send(
      "Raja Bus Backend Running"
    );

  }
);


// ======================================================
// PORT
// ======================================================

const PORT =
  process.env.PORT || 5000;


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

  try {

    // -----------------------------------------------
    // STEP 1: CONNECT DATABASE
    // -----------------------------------------------

    await connectDB();

    console.log(
      "MongoDB Connected"
    );


    // -----------------------------------------------
    // STEP 2: ENSURE ADMIN ACCOUNT
    // -----------------------------------------------

    try {

      await ensureAdminAccount();

    } catch (error) {

      console.warn(
        "Admin account check warning:",
        error.message
      );

    }


    // -----------------------------------------------
    // STEP 3: START SEAT HOLD CLEANUP
    // -----------------------------------------------

    startHoldCleanup();

    console.log(
      "15-minute seat hold cleanup started"
    );


    // -----------------------------------------------
    // STEP 4: START AUTO TRIP COMPLETION
    // -----------------------------------------------

    startAutoCompleteTrips();

    console.log(
      "Automatic trip completion started"
    );


    // -----------------------------------------------
    // STEP 5: START EXPRESS SERVER
    // -----------------------------------------------

    app.listen(
      PORT,
      () => {

        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          "Real-time seat updates enabled"
        );

        console.log(
          "15-minute seat hold system enabled"
        );

        console.log(
          "Trip cutoff: 1 hour before departure"
        );

        console.log(
          "Trip timezone: Asia/Colombo"
        );

      }
    );

  } catch (error) {

    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);

  }

}


// ======================================================
// RUN SERVER
// ======================================================

startServer();
