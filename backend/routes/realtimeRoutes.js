
const express = require("express");
const mongoose = require("mongoose");

const Trip = require("../models/Trip");

const {
  subscribe,
} = require("../utils/realtimeSeats");

const router = express.Router();


// ======================================================
// REAL-TIME SEAT UPDATES - TRIP BASED
//
// GET /api/realtime/seats
//
// Required query parameters:
// tripId = scheduled Trip ID
// busId  = physical Bus ID
// date   = YYYY-MM-DD
//
// Example:
// /api/realtime/seats?tripId=...&busId=...&date=2026-10-20
//
// SSE = Server-Sent Events
// ======================================================

router.get("/seats", async (req, res) => {

  try {

    const {
      tripId,
      busId,
      date,
    } = req.query;


    // ==================================================
    // REQUIRED PARAMETERS
    // ==================================================

    if (!tripId || !busId || !date) {

      return res.status(400).json({
        success: false,
        message:
          "tripId, busId and date are required",
      });
    }


    // ==================================================
    // VALIDATE MONGODB IDS
    // ==================================================

    if (
      !mongoose.isValidObjectId(tripId) ||
      !mongoose.isValidObjectId(busId)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid tripId or busId",
      });
    }


    // ==================================================
    // VALIDATE DATE FORMAT
    // ==================================================

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Date must be YYYY-MM-DD",
      });
    }


    // ==================================================
    // FIND SCHEDULED TRIP
    // ==================================================

    const trip = await Trip.findById(tripId);

    if (!trip) {

      return res.status(404).json({
        success: false,
        message:
          "Scheduled trip not found",
      });
    }


    // ==================================================
    // VERIFY TRIP BELONGS TO SELECTED BUS
    // ==================================================

    if (
      String(trip.busId) !== String(busId)
    ) {

      return res.status(409).json({
        success: false,
        message:
          "Trip does not belong to this bus",
      });
    }


    // ==================================================
    // VERIFY JOURNEY DATE
    // ==================================================

    if (
      String(trip.journeyDate) !== String(date)
    ) {

      return res.status(409).json({
        success: false,
        message:
          "Trip does not match the journey date",
      });
    }


    // ==================================================
    // SSE HEADERS
    // ==================================================

    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );


    if (
      typeof res.flushHeaders === "function"
    ) {
      res.flushHeaders();
    }


    // ==================================================
    // BROWSER RECONNECT DELAY
    // ==================================================

    res.write("retry: 3000\n\n");


    // ==================================================
    // CONNECTED EVENT
    // ==================================================

    res.write(
      `event: connected\n` +
      `data: ${JSON.stringify({
        success: true,
        message: "Real-time connected",
        tripId: String(trip._id),
        busId: String(trip.busId),
        journeyDate: trip.journeyDate,
      })}\n\n`
    );


    // ==================================================
    // SUBSCRIBE TO THIS SPECIFIC TRIP
    //
    // realtimeSeats.js must support:
    // subscribe(tripId, res)
    // ==================================================

    const unsubscribe = subscribe(
      String(trip._id),
      res
    );


    console.log(
      `SSE connected: Trip ${trip._id}`
    );


    // ==================================================
    // HEARTBEAT
    //
    // Keeps SSE connection alive.
    // ==================================================

    const heartbeat = setInterval(() => {

      if (
        !res.writableEnded &&
        !res.destroyed
      ) {

        res.write(": heartbeat\n\n");
      }

    }, 25000);


    // ==================================================
    // CLEANUP
    // ==================================================

    let closed = false;

    function cleanup() {

      if (closed) {
        return;
      }

      closed = true;

      clearInterval(heartbeat);

      unsubscribe();

      console.log(
        `SSE disconnected: Trip ${trip._id}`
      );
    }


    res.on("close", cleanup);

    res.on("error", cleanup);

  } catch (error) {

    console.error(
      "Real-time route error:",
      error
    );

    if (!res.headersSent) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to establish real-time connection",
      });
    }

    res.end();
  }
});


module.exports = router;
