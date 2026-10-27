
const express = require("express");
const mongoose = require("mongoose");

const Bus = require("../models/Bus");
const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");
const SearchLog = require("../models/SearchLog");

const {
  getBusSeatLayout,
} = require("../config/busSeatLayouts");

const router = express.Router();

// =============================================
// OPERATOR-OWNED BUSES ONLY
// =============================================

const OPERATOR_BUS_FILTER = {
  operatorId: {
    $type: "objectId"
  }
};

// =============================================
// DYNAMIC BUS SEAT LAYOUT
// =============================================

function layoutForBus(bus) {
  const capacity = Number(bus?.totalSeats);

  if (capacity === 50 || capacity === 54) {
    return getBusSeatLayout(capacity);
  }

  // Legacy compatibility.
  if (
    bus?.totalSeats == null ||
    capacity === 40
  ) {
    return getBusSeatLayout(54);
  }

  // Unsupported capacities are not converted
  // silently to 54 seats.
  return null;
}

// =============================================
// EXACT MATCH REGEX
// =============================================

function exactRegex(value) {
  const escaped = String(value)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`^${escaped}$`, "i");
}

// =============================================
// VALIDATE JOURNEY DATE
// =============================================

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// =============================================
// ACTIVE SEAT LOCK FILTER
// =============================================

function activeLockFilter(now = new Date()) {
  return {
    $or: [
      { status: "booked" },
      {
        status: "held",
        expiresAt: { $gt: now },
      },
      {
        status: { $exists: false },
      },
    ],
  };
}

// =============================================
// BUS SUMMARY
// =============================================

function busSummary(
  bus,
  trip = null,
  availableSeats = null
) {
  const layout = layoutForBus(bus);

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

    // Preserve existing frontend response:
    // totalSeats represents online bookable seats.
    totalSeats: layout?.bookableSeats.length ?? 0,

    availableSeats,
  };
}

// =============================================
// TEST API
// GET /api/buses/test
// =============================================

router.get("/test", (req, res) => {
  return res.json({
    success: true,
    message: "Bus route working",
  });
});

// =============================================
// PASSENGER BUS SEARCH
// GET /api/buses/search
// =============================================

router.get("/search", async (req, res) => {
  try {
    const to = String(req.query.to || "").trim();
    const date = String(req.query.date || "").trim();
    const type = String(req.query.type || "").trim();

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Destination is required",
      });
    }

    if (date && !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid journey date",
      });
    }

    SearchLog.create({ to }).catch(() => {});

    // =========================================
    // SEARCH WITHOUT DATE
    // =========================================
    // Route information now belongs to Trip.
    // Dummy buses are excluded by population.

    if (!date) {
      const trips = await Trip.find({
        to: exactRegex(to),
        status: "Active",
      })
        .sort({
          journeyDate: 1,
          departureTime: 1
        })
        .populate({
          path: "busId",
          match: OPERATOR_BUS_FILTER,
        });

      const buses = trips
        .filter((trip) =>
          trip.busId &&
          (
            !type ||
            exactRegex(type).test(
              String(trip.busId.type || "")
            )
          )
        )
        .map((trip) =>
          busSummary(trip.busId, trip)
        );

      return res.json({
        success: true,
        date: null,
        buses,
        message:
          "Select a journey date to see available seats",
      });
    }

    // =========================================
    // ACTIVE SCHEDULED TRIPS
    // =========================================

    const trips = await Trip.find({
      to: exactRegex(to),
      journeyDate: date,
      status: "Active",
    })
      .sort({ departureTime: 1 })
      .populate({
        path: "busId",
        match: OPERATOR_BUS_FILTER,
      });

    const matchingTrips = trips.filter(
      (trip) =>
        trip.busId &&
        (
          !type ||
          exactRegex(type).test(
            String(trip.busId.type || "")
          )
        )
    );

    // =========================================
    // LOAD TRIP-SPECIFIC SEAT LOCKS
    // =========================================

    const tripIds = matchingTrips.map(
      (trip) => trip._id
    );

    const occupiedByTrip = new Map();

    if (tripIds.length > 0) {
      const locks = await SeatLock.find({
        tripId: { $in: tripIds },
        ...activeLockFilter(),
      }).select("tripId seat");

      for (const lock of locks) {
        const key = String(lock.tripId);

        if (!occupiedByTrip.has(key)) {
          occupiedByTrip.set(key, new Set());
        }

        occupiedByTrip
          .get(key)
          .add(String(lock.seat));
      }
    }

    // =========================================
    // DYNAMIC AVAILABLE SEATS
    // =========================================

    const buses = matchingTrips.map((trip) => {
      const layout = layoutForBus(trip.busId);

      if (!layout) {
        return busSummary(
          trip.busId,
          trip,
          0
        );
      }

      const occupiedSeats =
        occupiedByTrip.get(String(trip._id)) ||
        new Set();

      // Count only online-bookable seats.
      const occupied = layout.bookableSeats.filter(
        (seat) =>
          occupiedSeats.has(String(seat))
      ).length;

      const remaining = Math.max(
        0,
        layout.bookableSeats.length - occupied
      );

      return busSummary(
        trip.busId,
        trip,
        remaining
      );
    });

    return res.json({
      success: true,
      date,
      buses,
    });

  } catch (error) {
    console.error("Bus search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search buses",
    });
  }
});

// =============================================
// DISTINCT DESTINATIONS
// GET /api/buses/distinct/destinations
// =============================================

router.get(
  "/distinct/destinations",
  async (req, res) => {
    try {
      // Find operator-owned buses.
      const operatorBusIds = await Bus.distinct(
        "_id",
        OPERATOR_BUS_FILTER
      );

      // Only active trips belonging to them.
      const destinations = await Trip.distinct(
        "to",
        {
          status: "Active",
          busId: {
            $in: operatorBusIds
          }
        }
      );

      return res.json({
        success: true,

        destinations: destinations
          .filter(Boolean)
          .sort(),
      });

    } catch (error) {
      console.error(
        "Destination error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load destinations",
      });
    }
  }
);

// =============================================
// TOP SEARCHED ROUTES
// GET /api/buses/top-searched
// =============================================

router.get("/top-searched", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(
      req.query.limit,
      10
    );

    const limit = Number.isInteger(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 20))
      : 9;

    // =========================================
    // GET OPERATOR-OWNED BUSES
    // =========================================

    const operatorBusIds = await Bus.distinct(
      "_id",
      OPERATOR_BUS_FILTER
    );

    // =========================================
    // GET ACTIVE TRIPS
    // =========================================

    const trips = await Trip.find({
      status: "Active",
      busId: {
        $in: operatorBusIds
      }
    })
      .sort({
        journeyDate: 1,
        departureTime: 1
      })
      .populate({
        path: "busId",
        match: OPERATOR_BUS_FILTER,
      });

    // =========================================
    // UNIQUE DESTINATIONS
    // =========================================

    const tripByDestination = new Map();

    for (const trip of trips) {
      if (!trip.busId || !trip.to) {
        continue;
      }

      const key = String(trip.to)
        .trim()
        .toLowerCase();

      if (!key) continue;

      if (!tripByDestination.has(key)) {
        tripByDestination.set(key, trip);
      }
    }

    // =========================================
    // SEARCH COUNTS
    // =========================================

    const counts = await SearchLog.aggregate([
      {
        $group: {
          _id: {
            $toLower: "$to"
          },

          searchCount: {
            $sum: 1
          },
        },
      },
    ]);

    const searchCounts = new Map(
      counts.map((item) => [
        String(item._id || "")
          .trim()
          .toLowerCase(),

        item.searchCount,
      ])
    );

    // =========================================
    // BUILD HOMEPAGE ROUTES
    // =========================================

    const routes = [
      ...tripByDestination.entries()
    ]
      .map(([key, trip]) => ({
        trip,
        searchCount:
          searchCounts.get(key) || 0,
      }))

      .sort(
        (a, b) =>
          b.searchCount - a.searchCount
      )

      .slice(0, limit)

      .map(({ trip, searchCount }) => ({
        from: trip.from,
        to: trip.to,

        type: trip.busId.type,

        depart: trip.departureTime,
        arrive: trip.arrivalTime,

        distanceKm:
          trip.busId.distanceKm ?? null,

        fareMin: trip.fare,
        fareMax: trip.fare,

        searchCount,
      }));

    return res.json({
      success: true,
      routes,
    });

  } catch (error) {
    console.error(
      "Top searched routes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load popular routes",
    });
  }
});

// =============================================
// WEBSITE STATISTICS
// GET /api/buses/stats
// =============================================

router.get("/stats", async (req, res) => {
  try {
    const [
      passengerAgg,
      totalRoutes,
    ] = await Promise.all([

      // Existing passenger booking statistics
      // are intentionally unchanged.
      Booking.aggregate([
        {
          $match: {
            status: "Paid",
          },
        },
        {
          $project: {
            seatCount: {
              $size: {
                $ifNull: ["$seats", []],
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$seatCount"
            },
          },
        },
      ]),

      // Operator-owned buses only.
      Bus.countDocuments(OPERATOR_BUS_FILTER),
    ]);

    return res.json({
      success: true,

      passengers:
        passengerAgg[0]?.total || 0,

      // Keep existing frontend field name.
      searchRoutes: totalRoutes,

      districts: 25,
    });

  } catch (error) {
    console.error(
      "Statistics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load statistics",
    });
  }
});

// =============================================
// DYNAMIC TRIP-SPECIFIC SEAT MAP
// GET /api/buses/:id/seats
// =============================================

router.get("/:id/seats", async (req, res) => {
  try {
    const busId = req.params.id;

    const tripId = String(
      req.query.tripId || ""
    ).trim();

    const date = String(
      req.query.date || ""
    ).trim();

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid journey date is required",
      });
    }

    if (
      !mongoose.isValidObjectId(busId) ||
      !mongoose.isValidObjectId(tripId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid bus ID and trip ID required",
      });
    }

    // =========================================
    // OPERATOR BUS AND TRIP
    // =========================================

    const [bus, trip] = await Promise.all([
      Bus.findOne({
        _id: busId,
        ...OPERATOR_BUS_FILTER,
      }),

      Trip.findById(tripId),
    ]);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // =========================================
    // VERIFY TRIP
    // =========================================

    if (
      String(trip.busId) !== String(bus._id) ||
      trip.journeyDate !== date
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Trip does not match selected bus and date",
      });
    }

    if (trip.status !== "Active") {
      return res.status(409).json({
        success: false,
        message:
          "This trip is unavailable for booking",
      });
    }

    // =========================================
    // GET PHYSICAL SEAT LAYOUT
    // =========================================

    const layout = layoutForBus(bus);

    if (!layout) {
      return res.status(409).json({
        success: false,

        message:
          `Unsupported bus capacity (${bus.totalSeats}). ` +
          "Only 50 and 54 seats are supported.",
      });
    }

    const bookableSeatSet = new Set(
      layout.bookableSeats.map(String)
    );

    // =========================================
    // TRIP-SPECIFIC SEAT LOCKS
    // =========================================

    const seatLocks = await SeatLock.find({
      tripId: trip._id,
      ...activeLockFilter(),
    }).select("seat status");

    const heldSeats = [];
    const bookedSeats = [];

    for (const lock of seatLocks) {
      const seat = String(lock.seat);

      if (!bookableSeatSet.has(seat)) {
        continue;
      }

      if (lock.status === "held") {
        heldSeats.push(seat);
      } else {
        bookedSeats.push(seat);
      }
    }

    // =========================================
    // PASSENGER SEAT MAP RESPONSE
    // =========================================

    return res.json({
      success: true,

      bus: {
        id: bus._id,

        busNo: bus.busNo,
        regNo: bus.regNo,
        type: bus.type,

        from: trip.from,
        to: trip.to,

        depart: trip.departureTime,
        arrive: trip.arrivalTime,

        fare: trip.fare,
        fareMin: trip.fare,
        fareMax: trip.fare,

        totalSeats: layout.totalSeats,
      },

      tripId: trip._id,
      date: trip.journeyDate,

      // Preserve exact screenshot positions.
      pattern: layout.pattern,

      // 50 seats = 13 columns.
      // 54 seats = 11 columns.
      columns: layout.columns,

      counterSeats: layout.counterSeats,
      heldSeats,
      bookedSeats,
    });

  } catch (error) {
    console.error(
      "Dynamic seat map error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load seat map",
    });
  }
});

// =============================================
// SINGLE BUS DETAILS
// GET /api/buses/:id
// =============================================

router.get("/:id", async (req, res) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID",
      });
    }

    // Operator-owned buses only.
    const bus = await Bus.findOne({
      _id: req.params.id,
      ...OPERATOR_BUS_FILTER,
    });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    return res.json({
      success: true,
      bus,
    });

  } catch (error) {
    console.error(
      "Load bus error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get bus",
    });
  }
});

// =============================================
// EXPORT ROUTER
// =============================================

module.exports = router;
