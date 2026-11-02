
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Trip = require("../models/Trip");
const Bus = require("../models/Bus");

const {
  operatorProtect
} = require("../middleware/operatorAuth");

const router = express.Router();

// ==============================================
// SRI LANKA CURRENT DATE
// ==============================================

function todayInSriLanka() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const getPart = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  return (
    `${getPart("year")}-` +
    `${getPart("month")}-` +
    `${getPart("day")}`
  );
}

// ==============================================
// VALIDATE JOURNEY DATE
// ==============================================

function isValidJourneyDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
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

// ==============================================
// VALIDATE DISTANCE KM
// ==============================================

function parseDistance(value) {
  if (
    (
      typeof value !== "string" &&
      typeof value !== "number"
    ) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const distance = Number(value);

  if (
    !Number.isFinite(distance) ||
    distance < 0.1
  ) {
    return null;
  }

  return distance;
}

// ==============================================
// VALIDATE FARE
// ==============================================

function parseFare(value) {
  if (
    (
      typeof value !== "string" &&
      typeof value !== "number"
    ) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const fare = Number(value);

  if (
    !Number.isFinite(fare) ||
    fare < 0
  ) {
    return null;
  }

  return fare;
}

// ==============================================
// ERROR HANDLER
// ==============================================

function handleTripError(
  res,
  error,
  operation
) {
  console.error(
    `${operation} trip error:`,
    error
  );

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message:
        "This bus already has a trip on that date at the same departure time"
    });
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid trip details"
    });
  }

  return res.status(500).json({
    success: false,
    message:
      `Failed to ${operation.toLowerCase()} trip`
  });
}

// ==============================================
// GET OPERATOR TRIPS
// GET /api/operator-trips
// ==============================================

router.get(
  "/",
  operatorProtect,
  async (req, res) => {
    try {
      const trips = await Trip.find({
        operatorId: req.operator._id
      })
        .populate(
          "busId",
          "busNo regNo type totalSeats"
        )
        .sort({
          journeyDate: 1,
          departureTime: 1
        });

      return res.json({
        success: true,
        count: trips.length,
        trips
      });

    } catch (error) {
      return handleTripError(
        res,
        error,
        "Load"
      );
    }
  }
);

// ==============================================
// CREATE TRIP
// POST /api/operator-trips
// ==============================================

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
        distanceKm
      } = req.body || {};

      // --------------------------------------
      // REQUIRED FIELDS
      // --------------------------------------

      if (
        !busId ||
        !journeyDate ||
        typeof from !== "string" ||
        !from.trim() ||
        typeof to !== "string" ||
        !to.trim() ||
        !departureTime ||
        !arrivalTime
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please fill all trip details"
        });
      }

      // --------------------------------------
      // VALIDATE BUS ID
      // --------------------------------------

      if (!mongoose.isValidObjectId(busId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Bus ID"
        });
      }

      // --------------------------------------
      // VALIDATE JOURNEY DATE
      // --------------------------------------

      if (!isValidJourneyDate(journeyDate)) {
        return res.status(400).json({
          success: false,
          message:
            "Journey date must be a valid YYYY-MM-DD date"
        });
      }

      if (
        journeyDate < todayInSriLanka()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Journey date cannot be in the past"
        });
      }

      // --------------------------------------
      // VALIDATE FARE
      // --------------------------------------

      const cleanFare = parseFare(fare);

      if (cleanFare === null) {
        return res.status(400).json({
          success: false,
          message:
            "Enter a valid Fare (LKR)"
        });
      }

      // --------------------------------------
      // VALIDATE DISTANCE KM
      // --------------------------------------

      const distance =
        parseDistance(distanceKm);

      if (distance === null) {
        return res.status(400).json({
          success: false,
          message:
            "Enter a valid Distance (KM) of at least 0.1"
        });
      }

      // --------------------------------------
      // VERIFY BUS OWNERSHIP
      // --------------------------------------

      const bus = await Bus.findOne({
        _id: busId,
        operatorId: req.operator._id
      });

      if (!bus) {
        return res.status(403).json({
          success: false,
          message:
            "You can only create trips for your own buses"
        });
      }

      // --------------------------------------
      // CREATE TRIP WITH DISTANCE
      // --------------------------------------

      const trip = await Trip.create({
        operatorId: req.operator._id,

        busId: bus._id,

        journeyDate,

        from: from.trim(),
        to: to.trim(),

        departureTime,
        arrivalTime,

        fare: cleanFare,

        // NEW: SAVE DISTANCE KM
        distanceKm: distance,

        status: "Active"
      });

      // --------------------------------------
      // POPULATE BUS DETAILS
      // --------------------------------------

      const populatedTrip =
        await Trip.findById(
          trip._id
        ).populate(
          "busId",
          "busNo regNo type totalSeats"
        );

      return res.status(201).json({
        success: true,
        message:
          "Trip created successfully",
        trip: populatedTrip
      });

    } catch (error) {
      return handleTripError(
        res,
        error,
        "Create"
      );
    }
  }
);

// ==============================================
// GET SINGLE TRIP
// GET /api/operator-trips/:id
// ==============================================

router.get(
  "/:id",
  operatorProtect,
  async (req, res) => {

    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Trip ID"
      });
    }

    try {
      const trip = await Trip.findOne({
        _id: req.params.id,
        operatorId: req.operator._id
      }).populate(
        "busId",
        "busNo regNo type totalSeats"
      );

      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "Trip not found"
        });
      }

      return res.json({
        success: true,
        trip
      });

    } catch (error) {
      return handleTripError(
        res,
        error,
        "Load"
      );
    }
  }
);

// ==============================================
// UPDATE TRIP
// PUT /api/operator-trips/:id
// ==============================================

router.put(
  "/:id",
  operatorProtect,
  async (req, res) => {

    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Trip ID"
      });
    }

    try {
      const trip = await Trip.findOne({
        _id: req.params.id,
        operatorId: req.operator._id
      });

      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "Trip not found"
        });
      }

      const changes = req.body || {};

      // --------------------------------------
      // UPDATE BUS - VERIFY OWNERSHIP
      // --------------------------------------

      if (
        changes.busId !== undefined
      ) {
        if (
          !mongoose.isValidObjectId(
            changes.busId
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid Bus ID"
          });
        }

        const bus = await Bus.findOne({
          _id: changes.busId,
          operatorId: req.operator._id
        });

        if (!bus) {
          return res.status(403).json({
            success: false,
            message:
              "You can only use your own bus"
          });
        }

        trip.busId = bus._id;
      }

      // --------------------------------------
      // UPDATE JOURNEY DATE
      // --------------------------------------

      if (
        changes.journeyDate !== undefined
      ) {
        if (
          !isValidJourneyDate(
            changes.journeyDate
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Journey date must be a valid YYYY-MM-DD date"
          });
        }

        if (
          changes.journeyDate <
          todayInSriLanka()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Journey date cannot be in the past"
          });
        }

        trip.journeyDate =
          changes.journeyDate;
      }

      // --------------------------------------
      // UPDATE FROM
      // --------------------------------------

      if (
        changes.from !== undefined
      ) {
        if (
          typeof changes.from !== "string" ||
          !changes.from.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Valid From location required"
          });
        }

        trip.from = changes.from.trim();
      }

      // --------------------------------------
      // UPDATE TO
      // --------------------------------------

      if (
        changes.to !== undefined
      ) {
        if (
          typeof changes.to !== "string" ||
          !changes.to.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Valid To location required"
          });
        }

        trip.to = changes.to.trim();
      }

      // --------------------------------------
      // UPDATE DEPARTURE TIME
      // --------------------------------------

      if (
        changes.departureTime !== undefined
      ) {
        if (!changes.departureTime) {
          return res.status(400).json({
            success: false,
            message:
              "Departure time required"
          });
        }

        trip.departureTime =
          changes.departureTime;
      }

      // --------------------------------------
      // UPDATE ARRIVAL TIME
      // --------------------------------------

      if (
        changes.arrivalTime !== undefined
      ) {
        if (!changes.arrivalTime) {
          return res.status(400).json({
            success: false,
            message:
              "Arrival time required"
          });
        }

        trip.arrivalTime =
          changes.arrivalTime;
      }

      // --------------------------------------
      // UPDATE FARE
      // --------------------------------------

      if (
        changes.fare !== undefined
      ) {
        const cleanFare =
          parseFare(changes.fare);

        if (cleanFare === null) {
          return res.status(400).json({
            success: false,
            message:
              "Enter a valid Fare (LKR)"
          });
        }

        trip.fare = cleanFare;
      }

      // --------------------------------------
      // UPDATE DISTANCE KM
      // --------------------------------------

      if (
        changes.distanceKm !== undefined
      ) {
        const distance =
          parseDistance(
            changes.distanceKm
          );

        if (distance === null) {
          return res.status(400).json({
            success: false,
            message:
              "Enter a valid Distance (KM) of at least 0.1"
          });
        }

        // NEW: UPDATE DISTANCE KM
        trip.distanceKm = distance;
      }

      // --------------------------------------
      // UPDATE STATUS
      // --------------------------------------

      if (
        changes.status !== undefined
      ) {
        const validStatuses = [
          "Active",
          "Cancelled",
          "Completed"
        ];

        if (
          !validStatuses.includes(
            changes.status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid trip status"
          });
        }

        trip.status =
          changes.status;
      }

      // --------------------------------------
      // SAVE UPDATED TRIP
      // --------------------------------------

      await trip.save();

      const populatedTrip =
        await Trip.findById(
          trip._id
        ).populate(
          "busId",
          "busNo regNo type totalSeats"
        );

      return res.json({
        success: true,
        message:
          "Trip updated successfully",
        trip: populatedTrip
      });

    } catch (error) {
      return handleTripError(
        res,
        error,
        "Update"
      );
    }
  }
);

// ==============================================
// DELETE TRIP
// DELETE /api/operator-trips/:id
// ==============================================

router.delete(
  "/:id",
  operatorProtect,
  async (req, res) => {

    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Trip ID"
      });
    }

    try {
      const trip = await Trip.findOne({
        _id: req.params.id,
        operatorId: req.operator._id
      });

      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "Trip not found"
        });
      }

      await Trip.findByIdAndDelete(
        trip._id
      );

      return res.json({
        success: true,
        message:
          "Trip deleted successfully"
      });

    } catch (error) {
      return handleTripError(
        res,
        error,
        "Delete"
      );
    }
  }
);

// ==============================================
// EXPORT ROUTER
// ==============================================

module.exports = router;
