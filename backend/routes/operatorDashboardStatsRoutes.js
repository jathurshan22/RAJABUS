
const express = require("express");
const mongoose = require("mongoose");

const Bus = require("../models/Bus");
const Trip = require("../models/Trip");
const Booking = require("../models/Booking");

const operatorAuth = require("../middleware/operatorAuth");

const operatorProtect =
  operatorAuth.operatorProtect || operatorAuth;

const router = express.Router();

// ==========================================
// SRI LANKA LOCAL DATE
// ==========================================

function getSriLankaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

// ==========================================
// OPERATOR DASHBOARD STATISTICS
//
// GET /api/operators/dashboard/stats
// ==========================================

router.get(
  "/dashboard/stats",
  operatorProtect,
  async (req, res) => {
    try {
      // Use operator ID supplied by verified
      // operator authentication middleware.
      const operatorId =
        req.operator?._id ||
        req.operator?.id ||
        req.operatorId;

      if (
        !operatorId ||
        !mongoose.isValidObjectId(operatorId)
      ) {
        return res.status(401).json({
          success: false,
          message: "Operator authentication required",
        });
      }

      const today = getSriLankaDate();

      // ====================================
      // TOTAL BUSES
      // TODAY'S TRIPS
      // OPERATOR TRIP IDS
      // ====================================

      const [
        totalBuses,
        todayTrips,
        tripIds,
      ] = await Promise.all([
        Bus.countDocuments({
          operatorId,
        }),

        Trip.countDocuments({
          operatorId,
          journeyDate: today,
          status: "Active",
        }),

        Trip.distinct("_id", {
          operatorId,
        }),
      ]);

      // ====================================
      // TOTAL BOOKINGS
      // PAID BOOKINGS AGGREGATION
      // ====================================

      const [
        totalBookings,
        paidStats,
      ] = await Promise.all([
        Booking.countDocuments({
          tripId: {
            $in: tripIds,
          },
        }),

        Booking.aggregate([
          {
            $match: {
              tripId: {
                $in: tripIds,
              },
              status: "Paid",
            },
          },
          {
            $group: {
              _id: null,

              confirmedPassengers: {
                $sum: {
                  $size: {
                    $ifNull: ["$seats", []],
                  },
                },
              },

              totalRevenue: {
                $sum: {
                  $ifNull: ["$totalFare", 0],
                },
              },
            },
          },
        ]),
      ]);

      const stats = paidStats[0] || {};

      // ====================================
      // RESPONSE
      // ====================================

      return res.json({
        success: true,

        stats: {
          totalBuses,
          todayTrips,
          totalBookings,

          confirmedPassengers:
            stats.confirmedPassengers || 0,

          totalRevenue:
            stats.totalRevenue || 0,
        },
      });

    } catch (error) {
      console.error(
        "Operator dashboard stats error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load operator statistics",
      });
    }
  }
);

module.exports = router;
