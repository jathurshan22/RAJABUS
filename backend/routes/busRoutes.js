const express = require("express");
const Bus = require("../models/Bus");
const Booking = require("../models/Booking");
const SearchLog = require("../models/SearchLog");
const {
  SEAT_PATTERN,
  COUNTER_SEATS,
  BOOKABLE_SEATS,
} = require("../config/seatLayout");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Bus route working" });
});

// GET /api/buses/search?to=Jaffna&date=2026-07-01&type=CTB
// "date" is optional but if given, each bus also reports how many seats
// are still free for that specific date.
router.get("/search", async (req, res) => {
  try {
    const { to, date, type } = req.query;

    if (!to || !to.trim()) {
      return res.status(400).json({
        success: false,
        message: "Destination (to) is required",
      });
    }

    const filter = {
      to: new RegExp(`^${to.trim()}$`, "i"),
    };

    // Fire-and-forget: log this search for the "Top Search Routes" home
    // page section. Never let a logging failure affect the real search.
    SearchLog.create({ to: to.trim() }).catch(() => {});

    if (type && type.trim()) {
      filter.type = new RegExp(`^${type.trim()}$`, "i");
    }

    const buses = await Bus.find(filter).sort({ depart: 1 });

    let bookedMap = {};
    if (date) {
      const busIds = buses.map((b) => b._id);
      const bookings = await Booking.find({
        busId: { $in: busIds },
        journeyDate: date,
        status: { $ne: "Cancelled" },
      }).select("busId seats");

      bookedMap = bookings.reduce((acc, b) => {
        const key = String(b.busId);
        acc[key] = (acc[key] || 0) + (b.seats ? b.seats.length : 0);
        return acc;
      }, {});
    }

    const result = buses.map((bus) => {
      const bookedCount = bookedMap[String(bus._id)] || 0;
      const availableSeats = date
        ? BOOKABLE_SEATS.length - bookedCount
        : BOOKABLE_SEATS.length;

      return {
        id: bus._id,
        from: bus.from,
        to: bus.to,
        type: bus.type,
        busNo: bus.busNo,
        regNo: bus.regNo,
        depart: bus.depart,
        arrive: bus.arrive,
        distanceKm: bus.distanceKm,
        fareMin: bus.fareMin,
        fareMax: bus.fareMax,
        totalSeats: BOOKABLE_SEATS.length,
        availableSeats,
      };
    });

    res.json({ success: true, date: date || null, buses: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search buses",
      error: error.message,
    });
  }
});

// GET /api/buses/distinct/destinations -> list of all "to" values (handy
// for building dropdowns automatically from real data)
router.get("/distinct/destinations", async (req, res) => {
  try {
    const destinations = await Bus.distinct("to");
    res.json({ success: true, destinations: destinations.sort() });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load destinations",
      error: error.message,
    });
  }
});

// GET /api/buses/top-searched?limit=9 -> most-searched destinations, each
// paired with one representative bus (cheapest/fastest match) so the home
// page can render real route cards instead of hardcoded ones.
router.get("/top-searched", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 9, 20);

    const topDestinations = await SearchLog.aggregate([
      { $group: { _id: { $toLower: "$to" }, searchCount: { $sum: 1 } } },
      // Secondary sort on _id (destination name) is required: without it,
      // ties in searchCount have no guaranteed stable order, so the top-9
      // list (and therefore which bus/type shows) can shuffle between
      // identical requests even with nothing actually changed.
      { $sort: { searchCount: -1, _id: 1 } },
      { $limit: limit },
    ]);

    const routes = [];

    for (const entry of topDestinations) {
      // Always the earliest-departure bus for that destination. This is a
      // predictable, explainable rule (not an arbitrary hash) - editing the
      // currently-shown (earliest) bus always reflects immediately here.
      const bus = await Bus.findOne({
        to: new RegExp(`^${entry._id}$`, "i"),
      }).sort({ depart: 1, _id: 1 });

      if (!bus) continue; // destination was searched but no bus exists for it anymore

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

    // Fallback for a fresh install with no search history yet: show one
    // bus per distinct destination (earliest departure), so the section
    // isn't empty (and isn't just the first destination repeated 4x from
    // seed insertion order).
    if (routes.length === 0) {
      const destinations = (await Bus.distinct("to")).slice(0, limit);

      for (const destination of destinations) {
        const bus = await Bus.findOne({ to: destination }).sort({ depart: 1, _id: 1 });
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

    res.json({ success: true, routes });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load top searched routes",
      error: error.message,
    });
  }
});

// GET /api/buses/stats -> homepage stats banner (real numbers, not fake)
// Passengers = total seats across non-cancelled bookings
// Search Routes = total bus schedules/routes in the system (destinations x
// buses per destination). NOT distinct destinations, since that duplicates
// the Districts number below (1 destination per district in this dataset).
// Districts = fixed at 25 (Sri Lanka has 25 districts, not a DB-driven number)
router.get("/stats", async (req, res) => {
  try {
    const [passengerAgg, totalRoutes] = await Promise.all([
      Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $project: { seatCount: { $size: { $ifNull: ["$seats", []] } } } },
        { $group: { _id: null, total: { $sum: "$seatCount" } } },
      ]),
      Bus.countDocuments(),
    ]);

    const passengers = passengerAgg[0] ? passengerAgg[0].total : 0;

    res.json({
      success: true,
      passengers,
      searchRoutes: totalRoutes,
      districts: 25,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load stats",
      error: error.message,
    });
  }
});

// GET /api/buses/:id -> single bus detail
router.get("/:id", async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res
        .status(404)
        .json({ success: false, message: "Bus not found" });
    }
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load bus",
      error: error.message,
    });
  }
});

// GET /api/buses/:id/seats?date=2026-07-01 -> seat map for that bus/date
router.get("/:id/seats", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: "date is required" });
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res
        .status(404)
        .json({ success: false, message: "Bus not found" });
    }

    const bookings = await Booking.find({
      busId: bus._id,
      journeyDate: date,
      status: { $ne: "Cancelled" },
    }).select("seats");

    const bookedSeats = bookings.flatMap((b) => b.seats || []);

    res.json({
      success: true,
      bus: {
        id: bus._id,
        busNo: bus.busNo,
        from: bus.from,
        to: bus.to,
        depart: bus.depart,
        arrive: bus.arrive,
        fareMin: bus.fareMin,
        fareMax: bus.fareMax,
      },
      date,
      pattern: SEAT_PATTERN,
      counterSeats: COUNTER_SEATS,
      bookedSeats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load seat map",
      error: error.message,
    });
  }
});

module.exports = router;
