
const express = require("express");

const Trip = require("../models/Trip");

const router = express.Router();

// =====================================================
// OPERATOR-OWNED BUSES ONLY
// =====================================================

const OPERATOR_BUS_FILTER = {
  operatorId: {
    $type: "objectId",
  },
};

// =====================================================
// REGEX SAFE FUNCTION
// =====================================================

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =====================================================
// VALIDATE JOURNEY DATE (YYYY-MM-DD)
// =====================================================

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// =====================================================
// TODAY'S TRIPS FOR CHAT
// GET /api/trips/today
// =====================================================

router.get("/today", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    // Today's calendar date in Sri Lanka.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const getPart = (type) =>
      parts.find((part) => part.type === type)?.value;

    const today =
      `${getPart("year")}-` +
      `${getPart("month")}-` +
      `${getPart("day")}`;

    // Only today's active trips whose buses have operatorId.
    const trips = await Trip.find({
      journeyDate: today,
      status: "Active",
    })
      .populate({
        path: "busId",
        select: "busNo regNo type operatorId",
        match: OPERATOR_BUS_FILTER,
      })
      .sort({
        departureTime: 1,
        _id: 1,
      });

    const now = Date.now();

    const results = trips
      .filter((trip) => {
        // Trips linked to dummy or missing buses are excluded.
        if (!trip.busId) {
          return false;
        }

        const departureAt = new Date(
          `${trip.journeyDate}T${trip.departureTime}+05:30`
        ).getTime();

        let arrivalAt = new Date(
          `${trip.journeyDate}T${trip.arrivalTime}+05:30`
        ).getTime();

        if (
          !Number.isFinite(departureAt) ||
          !Number.isFinite(arrivalAt)
        ) {
          return false;
        }

        // Arrival at or before departure means arrival next day.
        // Example: departure 22:00, arrival 05:00.
        
        if (arrivalAt === departureAt) {
          // Zero-duration trips are invalid.
          return false;
        }

        if (arrivalAt < departureAt) {
          // Overnight journey: arrival is next day.
          arrivalAt += 24 * 60 * 60 * 1000;
        }

        // Hide trips that have already reached arrival time.
        return arrivalAt > now;
      })
      .map((trip) => ({
        tripId: String(trip._id),
        busId: String(trip.busId._id),

        busNo: trip.busId.busNo,
        regNo: trip.busId.regNo,
        type: trip.busId.type,

        from: trip.from,
        to: trip.to,

        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,

        journeyDate: trip.journeyDate,
        status: trip.status,
      }));

    return res.json({
      success: true,
      date: today,
      timezone: "Asia/Colombo",
      count: results.length,
      trips: results,
    });
  } catch (error) {
    console.error("Today's chat trips error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load today's trips",
    });
  }
});

// =====================================================
// PUBLIC TRIP SEARCH
// GET /api/trips/search
// Example:
// /api/trips/search?from=Mihintale&to=Colombo&date=2026-11-02
// =====================================================

router.get("/search", async (req, res) => {
  try {
    const from =
      typeof req.query.from === "string"
        ? req.query.from.trim()
        : "";

    const to =
      typeof req.query.to === "string"
        ? req.query.to.trim()
        : "";

    const date =
      typeof req.query.date === "string"
        ? req.query.date.trim()
        : "";

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    if (!from || !to || !date) {
      return res.status(400).json({
        success: false,
        message: "From, to and date are required",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid journey date",
      });
    }

    // ---------------------------------------------
    // FIND ACTIVE TRIPS FROM OPERATOR BUSES ONLY
    // ---------------------------------------------

    const trips = await Trip.find({
      from: {
        $regex: `^${escapeRegex(from)}$`,
        $options: "i",
      },
      to: {
        $regex: `^${escapeRegex(to)}$`,
        $options: "i",
      },
      journeyDate: date,
      status: "Active",
    })
      .populate({
        path: "busId",
        select: "busNo regNo type operatorId",
        match: OPERATOR_BUS_FILTER,
      })
      .sort({
        departureTime: 1,
      });

    // ---------------------------------------------
    // PRESERVE EXISTING FRONTEND/seat.js RESPONSE
    // ---------------------------------------------

    const results = trips
      .filter((trip) => trip.busId)
      .map((trip) => ({
        tripId: trip._id,

        // seat.js uses bus.id.
        id: trip.busId._id,
        busId: trip.busId._id,

        busNo: trip.busId.busNo,
        regNo: trip.busId.regNo,
        type: trip.busId.type,

        from: trip.from,
        to: trip.to,

        depart: trip.departureTime,
        arrive: trip.arrivalTime,

        fare: trip.fare,
        journeyDate: trip.journeyDate,
        status: trip.status,
      }));

    return res.json({
      success: true,
      count: results.length,
      trips: results,
    });
  } catch (error) {
    console.error("Trip search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search trips",
    });
  }
});

module.exports = router;
