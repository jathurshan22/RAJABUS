const express = require("express");

const Trip = require("../models/Trip");

const router = express.Router();


// =====================================================
// PUBLIC TRIP SEARCH
// GET /api/trips/search
// Example:
// /api/trips/search?from=Mihintale&to=Colombo&date=2026-09-29
// =====================================================

router.get(
  "/search",
  async (req, res) => {
    try {

      const {
        from,
        to,
        date,
      } = req.query;


      // ---------------------------------------------
      // VALIDATION
      // ---------------------------------------------

      if (
        !from ||
        !to ||
        !date
      ) {
        return res.status(400).json({
          success: false,
          message:
            "From, to and date are required",
        });
      }


      // ---------------------------------------------
      // FIND ACTIVE TRIPS
      // ---------------------------------------------

      const trips =
        await Trip.find({

          from: {
            $regex:
              `^${escapeRegex(
                from.trim()
              )}$`,
            $options: "i",
          },

          to: {
            $regex:
              `^${escapeRegex(
                to.trim()
              )}$`,
            $options: "i",
          },

          journeyDate:
            date,

          status:
            "Active",

        })
          .populate(
            "busId",
            "busNo regNo type operatorId"
          )
          .sort({
            departureTime: 1,
          });


      // ---------------------------------------------
      // FORMAT FOR USER SIDE
      // Compatible with existing seat.js
      // ---------------------------------------------

      const results =
        trips
          .filter(
            (trip) =>
              trip.busId
          )
          .map(
            (trip) => ({

              tripId:
                trip._id,

              // seat.js uses bus.id
              id:
                trip.busId._id,

              busId:
                trip.busId._id,

              busNo:
                trip.busId.busNo,

              regNo:
                trip.busId.regNo,

              type:
                trip.busId.type,

              from:
                trip.from,

              to:
                trip.to,

              depart:
                trip.departureTime,

              arrive:
                trip.arrivalTime,

              fare:
                trip.fare,

              journeyDate:
                trip.journeyDate,

              status:
                trip.status,
            })
          );


      // ---------------------------------------------
      // SUCCESS
      // ---------------------------------------------

      return res.json({
        success: true,

        count:
          results.length,

        trips:
          results,
      });

    } catch (error) {

      console.error(
        "Trip search error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Failed to search trips",

        error:
          error.message,
      });
    }
  }
);


// =====================================================
// REGEX SAFE FUNCTION
// =====================================================

function escapeRegex(value) {

  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}


module.exports = router;