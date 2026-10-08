
const express = require("express");
const mongoose = require("mongoose");

const Bus = require("../models/Bus");
const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");
const SearchLog = require("../models/SearchLog");

const {
  SEAT_PATTERN,
  COUNTER_SEATS,
  BOOKABLE_SEATS,
} = require("../config/seatLayout");

const router = express.Router();

const bookableSeatSet = new Set(BOOKABLE_SEATS.map(String));

function exactRegex(value) {
  const escaped = String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function activeLockFilter(now = new Date()) {
  return {
    $or: [
      { status: "booked" },
      { status: "held", expiresAt: { $gt: now } },
      // Legacy records without status still count if they already have tripId.
      { status: { $exists: false } },
    ],
  };
}

function busSummary(bus, trip = null, availableSeats = null) {
  return {
    id: bus._id,
    tripId: trip?._id || null,
    from: trip?.from || bus.from,
    to: trip?.to || bus.to,
    type: bus.type,
    busNo: bus.busNo,
    regNo: bus.regNo,
    depart: trip?.departureTime || bus.depart,
    arrive: trip?.arrivalTime || bus.arrive,
    distanceKm: bus.distanceKm,
    fare: trip ? trip.fare : null,
    fareMin: trip ? trip.fare : bus.fareMin,
    fareMax: trip ? trip.fare : bus.fareMax,
    journeyDate: trip?.journeyDate || null,
    totalSeats: BOOKABLE_SEATS.length,
    availableSeats,
  };
}

// ======================================================
// TEST
// GET /api/buses/test
// ======================================================
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Bus route working" });
});

// ======================================================
// TRIP-BASED SEARCH (legacy /buses/search compatibility)
// GET /api/buses/search?to=Jaffna&date=2026-10-20&type=CTB
//
// With a date: returns ONE result per active scheduled trip.
// Without a date: returns bus catalog only, not bookable inventory.
// The dedicated /api/trips/search endpoint can stay as-is.
// ======================================================
router.get("/search", async (req, res) => {
  try {
    const to = String(req.query.to || "").trim();
    const date = String(req.query.date || "").trim();
    const type = String(req.query.type || "").trim();

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Destination (to) is required",
      });
    }

    if (date && !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid YYYY-MM-DD date",
      });
    }

    SearchLog.create({ to }).catch(() => {});

    if (!date) {
      const filter = { to: exactRegex(to) };
      if (type) filter.type = exactRegex(type);
      const buses = await Bus.find(filter).sort({ depart: 1 });
      return res.json({
        success: true,
        date: null,
        buses: buses.map((bus) => busSummary(bus)),
        message: "Select a journey date to see scheduled trips and available seats",
      });
    }

    const trips = await Trip.find({
      to: exactRegex(to),
      journeyDate: date,
      status: "Active",
    })
      .sort({ departureTime: 1 })
      .populate("busId");

    const matchingTrips = trips.filter(
      (trip) =>
        trip.busId &&
        (!type || exactRegex(type).test(String(trip.busId.type || "")))
    );

    const tripIds = matchingTrips.map((trip) => trip._id);
    const occupiedByTrip = new Map();

    if (tripIds.length > 0) {
      const locks = await SeatLock.find({
        tripId: { $in: tripIds },
        ...activeLockFilter(),
      }).select("tripId seat");

      for (const lock of locks) {
        const key = String(lock.tripId);
        if (!occupiedByTrip.has(key)) occupiedByTrip.set(key, new Set());
        if (bookableSeatSet.has(String(lock.seat))) {
          occupiedByTrip.get(key).add(String(lock.seat));
        }
      }
    }

    const buses = matchingTrips.map((trip) => {
      const occupied = occupiedByTrip.get(String(trip._id))?.size || 0;
      const remaining = Math.max(0, BOOKABLE_SEATS.length - occupied);
      return busSummary(trip.busId, trip, remaining);
    });

    return res.json({ success: true, date, buses });
  } catch (error) {
    console.error("Bus search error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search buses",
    });
  }
});

// ======================================================
// DISTINCT DESTINATIONS
// GET /api/buses/distinct/destinations
// ======================================================
router.get("/distinct/destinations", async (req, res) => {
  try {
    const destinations = await Bus.distinct("to");
    return res.json({ success: true, destinations: destinations.sort() });
  } catch (error) {
    console.error("Destination loading error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load destinations",
    });
  }
});

// ======================================================
// TOP SEARCHED ROUTES
// GET /api/buses/top-searched?limit=9
// ======================================================
router.get("/top-searched", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 20))
      : 9;

    const topDestinations = await SearchLog.aggregate([
      {
        $group: {
          _id: { $toLower: "$to" },
          searchCount: { $sum: 1 },
        },
      },
      { $sort: { searchCount: -1, _id: 1 } },
      { $limit: limit },
    ]);

    const routes = [];

    for (const entry of topDestinations) {
      if (!entry._id) continue;
      const bus = await Bus.findOne({
        to: exactRegex(entry._id),
      }).sort({ depart: 1, _id: 1 });

      if (!bus) continue;
      routes.push({
        from: bus.from,
        to: bus.to,
        type: bus.type,
        depart: bus.depart,
        arrive: bus.arrive,
        distanceKm: bus.distanceKm,
        fareMin: bus.fareMin,
        fareMax: bus.fareMax,
        searchCount: entry.searchCount,
      });
    }

    if (routes.length === 0) {
      const destinations = (await Bus.distinct("to")).slice(0, limit);
      for (const destination of destinations) {
        const bus = await Bus.findOne({ to: destination }).sort({
          depart: 1,
          _id: 1,
        });
        if (!bus) continue;
        routes.push({
          from: bus.from,
          to: bus.to,
          type: bus.type,
          depart: bus.depart,
          arrive: bus.arrive,
          distanceKm: bus.distanceKm,
          fareMin: bus.fareMin,
          fareMax: bus.fareMax,
          searchCount: 0,
        });
      }
    }

    return res.json({ success: true, routes });
  } catch (error) {
    console.error("Top searched route error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load top searched routes",
    });
  }
});

// ======================================================
// STATS
// GET /api/buses/stats
// ======================================================
router.get("/stats", async (req, res) => {
  try {
    const [passengerAgg, totalRoutes] = await Promise.all([
      Booking.aggregate([
        { $match: { status: "Paid" } },
        {
          $project: {
            seatCount: { $size: { $ifNull: ["$seats", []] } },
          },
        },
        { $group: { _id: null, total: { $sum: "$seatCount" } } },
      ]),
      Bus.countDocuments(),
    ]);

    const passengers = passengerAgg[0] ? passengerAgg[0].total : 0;
    return res.json({
      success: true,
      passengers,
      searchRoutes: totalRoutes,
      districts: 25,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load stats",
    });
  }
});

// ======================================================
// TRIP-SPECIFIC SEAT MAP
// GET /api/buses/:id/seats?date=YYYY-MM-DD&tripId=TRIP_ID
// ======================================================
router.get("/:id/seats", async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    const tripId = String(req.query.tripId || "").trim();
    const busId = req.params.id;

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date (YYYY-MM-DD) is required",
      });
    }

    if (!mongoose.isValidObjectId(busId) || !mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Valid bus ID and tripId are required",
      });
    }

    const [bus, trip] = await Promise.all([
      Bus.findById(busId),
      Trip.findById(tripId),
    ]);

    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }
    if (String(trip.busId) !== String(bus._id) || trip.journeyDate !== date) {
      return res.status(409).json({
        success: false,
        message: "Trip does not match the selected bus and date",
      });
    }
    if (trip.status !== "Active") {
      return res.status(409).json({
        success: false,
        message: "This trip is not available for booking",
      });
    }

    const seatLocks = await SeatLock.find({
      tripId: trip._id,
      ...activeLockFilter(),
    }).select("seat status");

    const heldSeats = [];
    const bookedSeats = [];
    for (const lock of seatLocks) {
      const seat = String(lock.seat);
      if (!bookableSeatSet.has(seat)) continue;
      if (lock.status === "held") heldSeats.push(seat);
      else bookedSeats.push(seat);
    }

    return res.json({
      success: true,
      bus: {
        id: bus._id,
        busNo: bus.busNo,
        from: trip.from,
        to: trip.to,
        depart: trip.departureTime,
        arrive: trip.arrivalTime,
        fare: trip.fare,
        fareMin: trip.fare,
        fareMax: trip.fare,
      },
      tripId: trip._id,
      date: trip.journeyDate,
      pattern: SEAT_PATTERN,
      counterSeats: COUNTER_SEATS,
      heldSeats,
      bookedSeats,
    });
  } catch (error) {
    console.error("Seat map error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load seat map",
    });
  }
});

// ======================================================
// SINGLE BUS
// GET /api/buses/:id
// ======================================================
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID",
      });
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }
    return res.json({ success: true, bus });
  } catch (error) {
    console.error("Bus loading error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get bus",
    });
  }
});

module.exports = router;
