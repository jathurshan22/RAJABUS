const express = require("express");

const Trip =
  require("../models/Trip");

const Bus =
  require("../models/Bus");

const {
  operatorProtect,
} =
  require("../middleware/operatorAuth");


const router = express.Router();


// =====================================================
// GET OPERATOR TRIPS
// GET /api/operator-trips
// =====================================================

router.get(
  "/",
  operatorProtect,
  async (req, res) => {

    try {

      const trips =
        await Trip.find({
          operatorId:
            req.operator._id,
        })
          .populate(
            "busId",
            "busNo regNo type"
          )
          .sort({
            journeyDate: 1,
            departureTime: 1,
          });


      return res.json({
        success: true,
        count: trips.length,
        trips,
      });

    } catch (error) {

      console.error(
        "Load trips error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load trips",
        error:
          error.message,
      });
    }

  }
);


// =====================================================
// CREATE TRIP
// POST /api/operator-trips
// =====================================================

router.post(
  "/",
  operatorProtect,
  async (req, res) => {

    try {

      const {
        busId,
        journeyDate,
        from,
        to,
        departureTime,
        arrivalTime,
        fare,
      } = req.body;


      if (
        !busId ||
        !journeyDate ||
        !from ||
        !to ||
        !departureTime ||
        !arrivalTime ||
        fare === undefined ||
        fare === null ||
        fare === ""
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please fill all trip details",
        });
      }


      // ---------------------------------------------
      // BUS MUST BELONG TO LOGGED-IN OPERATOR
      // ---------------------------------------------

      const bus =
        await Bus.findOne({
          _id: busId,
          operatorId:
            req.operator._id,
        });


      if (!bus) {

        return res.status(403).json({
          success: false,
          message:
            "You can only create trips for your own buses",
        });
      }


      // ---------------------------------------------
      // PAST DATE CHECK
      // ---------------------------------------------

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );


      const selectedDate =
        new Date(
          `${journeyDate}T00:00:00`
        );


      if (
        selectedDate < today
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Journey date cannot be in the past",
        });
      }


      const trip =
        await Trip.create({

          operatorId:
            req.operator._id,

          busId:
            bus._id,

          journeyDate,

          from:
            from.trim(),

          to:
            to.trim(),

          departureTime,

          arrivalTime,

          fare:
            Number(fare),

          status:
            "Active",
        });


      const populatedTrip =
        await Trip.findById(
          trip._id
        ).populate(
          "busId",
          "busNo regNo type"
        );


      return res.status(201).json({
        success: true,
        message:
          "Trip created successfully",
        trip:
          populatedTrip,
      });

    } catch (error) {

      console.error(
        "Create trip error:",
        error
      );


      if (
        error.code === 11000
      ) {

        return res.status(409).json({
          success: false,
          message:
            "This bus already has a trip at the same date and departure time",
        });
      }


      return res.status(500).json({
        success: false,
        message:
          "Failed to create trip",
        error:
          error.message,
      });
    }

  }
);


// =====================================================
// GET SINGLE TRIP
// GET /api/operator-trips/:id
// =====================================================

router.get(
  "/:id",
  operatorProtect,
  async (req, res) => {

    try {

      const trip =
        await Trip.findOne({
          _id:
            req.params.id,

          operatorId:
            req.operator._id,
        }).populate(
          "busId",
          "busNo regNo type"
        );


      if (!trip) {

        return res.status(404).json({
          success: false,
          message:
            "Trip not found",
        });
      }


      return res.json({
        success: true,
        trip,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to load trip",
        error:
          error.message,
      });
    }

  }
);


// =====================================================
// UPDATE TRIP
// PUT /api/operator-trips/:id
// =====================================================

router.put(
  "/:id",
  operatorProtect,
  async (req, res) => {

    try {

      const trip =
        await Trip.findOne({
          _id:
            req.params.id,

          operatorId:
            req.operator._id,
        });


      if (!trip) {

        return res.status(404).json({
          success: false,
          message:
            "Trip not found",
        });
      }


      // If bus changed,
      // verify ownership
      if (req.body.busId) {

        const bus =
          await Bus.findOne({
            _id:
              req.body.busId,

            operatorId:
              req.operator._id,
          });


        if (!bus) {

          return res.status(403).json({
            success: false,
            message:
              "You can only use your own bus",
          });
        }


        trip.busId =
          bus._id;
      }


      if (
        req.body.journeyDate !==
        undefined
      ) {
        trip.journeyDate =
          req.body.journeyDate;
      }


      if (
        req.body.from !==
        undefined
      ) {
        trip.from =
          String(
            req.body.from
          ).trim();
      }


      if (
        req.body.to !==
        undefined
      ) {
        trip.to =
          String(
            req.body.to
          ).trim();
      }


      if (
        req.body.departureTime !==
        undefined
      ) {
        trip.departureTime =
          req.body.departureTime;
      }


      if (
        req.body.arrivalTime !==
        undefined
      ) {
        trip.arrivalTime =
          req.body.arrivalTime;
      }


      if (
        req.body.fare !==
        undefined
      ) {
        trip.fare =
          Number(
            req.body.fare
          );
      }


      if (
        req.body.status !==
        undefined
      ) {

        const validStatuses = [
          "Active",
          "Cancelled",
          "Completed",
        ];


        if (
          !validStatuses.includes(
            req.body.status
          )
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid trip status",
          });
        }


        trip.status =
          req.body.status;
      }


      await trip.save();


      const populatedTrip =
        await Trip.findById(
          trip._id
        ).populate(
          "busId",
          "busNo regNo type"
        );


      return res.json({
        success: true,
        message:
          "Trip updated successfully",
        trip:
          populatedTrip,
      });

    } catch (error) {

      if (
        error.code === 11000
      ) {

        return res.status(409).json({
          success: false,
          message:
            "Duplicate trip schedule",
        });
      }


      return res.status(500).json({
        success: false,
        message:
          "Failed to update trip",
        error:
          error.message,
      });
    }

  }
);


// =====================================================
// DELETE TRIP
// DELETE /api/operator-trips/:id
// =====================================================

router.delete(
  "/:id",
  operatorProtect,
  async (req, res) => {

    try {

      const trip =
        await Trip.findOne({
          _id:
            req.params.id,

          operatorId:
            req.operator._id,
        });


      if (!trip) {

        return res.status(404).json({
          success: false,
          message:
            "Trip not found",
        });
      }


      await Trip.findByIdAndDelete(
        trip._id
      );


      return res.json({
        success: true,
        message:
          "Trip deleted successfully",
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete trip",
        error:
          error.message,
      });
    }

  }
);


module.exports = router;