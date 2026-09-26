const express = require("express");

const Bus = require("../models/Bus");
const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");
const SearchLog = require("../models/SearchLog");

const {
  SEAT_PATTERN,
  COUNTER_SEATS,
  BOOKABLE_SEATS,
} = require("../config/seatLayout");


const router = express.Router();


// ======================================================
// TEST
// GET /api/buses/test
// ======================================================

router.get("/test", (req, res) => {
  res.json({
    message: "Bus route working",
  });
});


// ======================================================
// SEARCH BUSES
// GET /api/buses/search?to=Jaffna&date=2026-07-01&type=CTB
// ======================================================

router.get("/search", async (req, res) => {
  try {
    const {
      to,
      date,
      type,
    } = req.query;


    // --------------------------------------------------
    // DESTINATION REQUIRED
    // --------------------------------------------------

    if (!to || !to.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Destination (to) is required",
      });
    }


    // --------------------------------------------------
    // BUS FILTER
    // --------------------------------------------------

    const filter = {
      to: new RegExp(
        `^${to.trim()}$`,
        "i"
      ),
    };


    // Search history
    SearchLog.create({
      to: to.trim(),
    }).catch(() => {});


    // Optional bus type
    if (type && type.trim()) {
      filter.type =
        new RegExp(
          `^${type.trim()}$`,
          "i"
        );
    }


    // --------------------------------------------------
    // FIND BUSES
    // --------------------------------------------------

    const buses =
      await Bus.find(
        filter
      ).sort({
        depart: 1,
      });


    // --------------------------------------------------
    // AVAILABLE SEAT CALCULATION
    // --------------------------------------------------

    let occupiedMap = {};


    if (
      date &&
      buses.length > 0
    ) {
      const busIds =
        buses.map(
          (bus) => bus._id
        );


      const now =
        new Date();


      /*
        Count as unavailable:

        1. status = booked
           Payment complete → RED

        2. status = held
           Hold not expired → ORANGE

        3. Old SeatLock documents without status
           Treat as booked for compatibility.
      */
      const activeLocks =
        await SeatLock.find({
          busId: {
            $in: busIds,
          },

          journeyDate:
            date,

          $or: [
            {
              status:
                "booked",
            },

            {
              status:
                "held",

              expiresAt: {
                $gt: now,
              },
            },

            {
              status: {
                $exists: false,
              },
            },
          ],
        }).select(
          "busId seat status expiresAt"
        );


      occupiedMap =
        activeLocks.reduce(
          (acc, lock) => {

            const key =
              String(
                lock.busId
              );


            acc[key] =
              (acc[key] || 0) + 1;


            return acc;
          },

          {}
        );
    }


    // --------------------------------------------------
    // FORMAT RESULT
    // --------------------------------------------------

    const result =
      buses.map(
        (bus) => {

          const occupiedCount =
            occupiedMap[
              String(bus._id)
            ] || 0;


          const availableSeats =
            date
              ? Math.max(
                  0,
                  BOOKABLE_SEATS.length -
                    occupiedCount
                )
              : BOOKABLE_SEATS.length;


          return {
            id:
              bus._id,

            from:
              bus.from,

            to:
              bus.to,

            type:
              bus.type,

            busNo:
              bus.busNo,

            regNo:
              bus.regNo,

            depart:
              bus.depart,

            arrive:
              bus.arrive,

            distanceKm:
              bus.distanceKm,

            fareMin:
              bus.fareMin,

            fareMax:
              bus.fareMax,

            totalSeats:
              BOOKABLE_SEATS.length,

            availableSeats,
          };
        }
      );


    return res.json({
      success: true,

      date:
        date || null,

      buses:
        result,
    });

  } catch (error) {

    console.error(
      "Bus search error:",
      error
    );


    return res.status(500).json({
      success: false,

      message:
        "Failed to search buses",

      error:
        error.message,
    });
  }
});


// ======================================================
// DISTINCT DESTINATIONS
// GET /api/buses/distinct/destinations
// ======================================================

router.get(
  "/distinct/destinations",
  async (req, res) => {

    try {

      const destinations =
        await Bus.distinct(
          "to"
        );


      return res.json({
        success: true,

        destinations:
          destinations.sort(),
      });

    } catch (error) {

      console.error(
        "Destination loading error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to load destinations",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// TOP SEARCHED ROUTES
// GET /api/buses/top-searched?limit=9
// ======================================================

router.get(
  "/top-searched",
  async (req, res) => {

    try {

      const limit =
        Math.min(
          Number(
            req.query.limit
          ) || 9,
          20
        );


      const topDestinations =
        await SearchLog.aggregate([
          {
            $group: {
              _id: {
                $toLower:
                  "$to",
              },

              searchCount: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              searchCount: -1,
              _id: 1,
            },
          },

          {
            $limit:
              limit,
          },
        ]);


      const routes = [];


      for (
        const entry
        of topDestinations
      ) {

        const bus =
          await Bus.findOne({
            to: new RegExp(
              `^${entry._id}$`,
              "i"
            ),
          }).sort({
            depart: 1,
            _id: 1,
          });


        if (!bus) {
          continue;
        }


        routes.push({
          from:
            bus.from,

          to:
            bus.to,

          type:
            bus.type,

          depart:
            bus.depart,

          arrive:
            bus.arrive,

          distanceKm:
            bus.distanceKm,

          fareMin:
            bus.fareMin,

          fareMax:
            bus.fareMax,

          searchCount:
            entry.searchCount,
        });
      }


      // --------------------------------------------------
      // FALLBACK
      // --------------------------------------------------

      if (
        routes.length === 0
      ) {

        const destinations =
          (
            await Bus.distinct(
              "to"
            )
          ).slice(
            0,
            limit
          );


        for (
          const destination
          of destinations
        ) {

          const bus =
            await Bus.findOne({
              to:
                destination,
            }).sort({
              depart: 1,
              _id: 1,
            });


          if (!bus) {
            continue;
          }


          routes.push({
            from:
              bus.from,

            to:
              bus.to,

            type:
              bus.type,

            depart:
              bus.depart,

            arrive:
              bus.arrive,

            distanceKm:
              bus.distanceKm,

            fareMin:
              bus.fareMin,

            fareMax:
              bus.fareMax,

            searchCount:
              0,
          });
        }
      }


      return res.json({
        success: true,
        routes,
      });

    } catch (error) {

      console.error(
        "Top searched route error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to load top searched routes",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// STATS
// GET /api/buses/stats
//
// Passengers = only PAID / CONFIRMED seats
// Pending holds should not count as passengers.
// ======================================================

router.get(
  "/stats",
  async (req, res) => {

    try {

      const [
        passengerAgg,
        totalRoutes,
      ] =
        await Promise.all([

          Booking.aggregate([
            {
              $match: {
                status:
                  "Paid",
              },
            },

            {
              $project: {
                seatCount: {
                  $size: {
                    $ifNull: [
                      "$seats",
                      [],
                    ],
                  },
                },
              },
            },

            {
              $group: {
                _id:
                  null,

                total: {
                  $sum:
                    "$seatCount",
                },
              },
            },
          ]),


          Bus.countDocuments(),
        ]);


      const passengers =
        passengerAgg[0]
          ? passengerAgg[0].total
          : 0;


      return res.json({
        success: true,

        passengers,

        searchRoutes:
          totalRoutes,

        districts:
          25,
      });

    } catch (error) {

      console.error(
        "Stats error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to load stats",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// SEAT MAP
// GET /api/buses/:id/seats?date=2026-07-01
//
// heldSeats   = ORANGE
// bookedSeats = RED
// ======================================================

router.get(
  "/:id/seats",
  async (req, res) => {

    try {

      const {
        date,
      } = req.query;


      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "date is required",
        });
      }


      // --------------------------------------------------
      // FIND BUS
      // --------------------------------------------------

      const bus =
        await Bus.findById(
          req.params.id
        );


      if (!bus) {
        return res.status(404).json({
          success: false,
          message:
            "Bus not found",
        });
      }


      const now =
        new Date();


      // --------------------------------------------------
      // ACTIVE SEAT LOCKS
      // --------------------------------------------------

      const seatLocks =
        await SeatLock.find({
          busId:
            bus._id,

          journeyDate:
            date,

          $or: [
            // Paid seat
            {
              status:
                "booked",
            },

            // Active temporary hold
            {
              status:
                "held",

              expiresAt: {
                $gt: now,
              },
            },

            // Compatibility with old records
            {
              status: {
                $exists: false,
              },
            },
          ],
        }).select(
          "seat status expiresAt"
        );


      // --------------------------------------------------
      // SPLIT HELD / BOOKED
      // --------------------------------------------------

      const heldSeats = [];

      const bookedSeats = [];


      seatLocks.forEach(
        (lock) => {

          const seat =
            String(
              lock.seat
            );


          if (
            lock.status ===
            "held"
          ) {

            heldSeats.push(
              seat
            );

          } else {

            // booked OR old lock
            bookedSeats.push(
              seat
            );
          }
        }
      );


      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      return res.json({
        success: true,

        bus: {
          id:
            bus._id,

          busNo:
            bus.busNo,

          from:
            bus.from,

          to:
            bus.to,

          depart:
            bus.depart,

          arrive:
            bus.arrive,

          fareMin:
            bus.fareMin,

          fareMax:
            bus.fareMax,
        },

        date,

        pattern:
          SEAT_PATTERN,

        counterSeats:
          COUNTER_SEATS,

        // Orange
        heldSeats,

        // Red
        bookedSeats,
      });

    } catch (error) {

      console.error(
        "Seat map error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to load seat map",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// SINGLE BUS
// GET /api/buses/:id
// ======================================================

router.get(
  "/:id",
  async (req, res) => {

    try {

      const bus =
        await Bus.findById(
          req.params.id
        );


      if (!bus) {
        return res.status(404).json({
          success: false,
          message:
            "Bus not found",
        });
      }


      return res.json({
        success: true,
        bus,
      });

    } catch (error) {

      console.error(
        "Bus loading error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to load bus",

        error:
          error.message,
      });
    }
  }
);


module.exports = router;