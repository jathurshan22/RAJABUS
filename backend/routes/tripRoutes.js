const express = require("express");

const Trip = require("../models/Trip");

const router = express.Router();


// =====================================================
// PUBLIC TRIP SEARCH
// GET /api/trips/search
// Example:
// /api/trips/search?from=Mihintale&to=Colombo&date=2026-09-29
// =====================================================

// ======================================================
// TODAY'S TRIPS FOR CHAT
// GET /api/trips/today
// ======================================================

router.get("/today", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    // Today's date in Sri Lanka.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const getPart = (type) =>
      parts.find((part) => part.type === type).value;

    const today =
      `${getPart("year")}-` +
      `${getPart("month")}-` +
      `${getPart("day")}`;

    // Today's active trips from all operators.
    const trips = await Trip.find({
      journeyDate: today,
      status: "Active",
    })
      .populate("busId", "busNo regNo type")
      .sort({
        departureTime: 1,
        _id: 1,
      });

    const results = trips
      .filter((trip) => {
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

        // Arrival earlier than departure means next day.
        // Example: departure 22:00, arrival 05:00.
        

        // Hide trips that have already reached arrival time.
        return arrivalAt > Date.now();
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