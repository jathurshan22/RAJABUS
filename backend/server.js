const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");


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
// ROUTES
// ======================================================

const authRoutes =
  require("./routes/authRoutes");

const bookingRoutes =
  require("./routes/bookingRoutes");

const busRoutes =
  require("./routes/busRoutes");

const reviewRoutes =
  require("./routes/reviewRoutes");

const contactRoutes =
  require("./routes/contactRoutes");

const adminRoutes =
  require("./routes/adminRoutes");

const realtimeRoutes =
  require("./routes/realtimeRoutes");


// ======================================================
// HOLD CLEANUP
// ======================================================

const {
  startHoldCleanup,
} = require("./utils/holdCleanup");


// ======================================================
// EXPRESS APP
// ======================================================

const app =
  express();


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
// API ROUTES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/bookings",
  bookingRoutes
);

app.use(
  "/api/buses",
  busRoutes
);

app.use(
  "/api/reviews",
  reviewRoutes
);

app.use(
  "/api/contact",
  contactRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/realtime",
  realtimeRoutes
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
  process.env.PORT ||
  5000;


// ======================================================
// START SERVER
// ======================================================

async function startServer() {
  try {

    // -----------------------------------------------
    // CONNECT DATABASE FIRST
    // -----------------------------------------------

    await connectDB();


    console.log(
      "MongoDB Connected"
    );


    // -----------------------------------------------
    // CREATE / CHECK ADMIN ACCOUNT
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
    // START 15-MINUTE HOLD CLEANUP
    // -----------------------------------------------

    startHoldCleanup();


    // -----------------------------------------------
    // START EXPRESS SERVER
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
// RUN
// ======================================================

startServer();