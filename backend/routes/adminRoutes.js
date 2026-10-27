
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const Contact = require("../models/Contact");
const Operator = require("../models/Operator");
const { protect, adminOnly } = require("../middleware/auth");

// =============================================
// ADMIN AUTHENTICATION
// =============================================

// All routes require a valid Admin JWT.
router.use(protect, adminOnly);

// =============================================
// OPERATOR-OWNED BUS FILTER
// =============================================

const OPERATOR_BUS_FILTER = {
    operatorId: {
        $type: "objectId"
    }
};

// =============================================
// ADMIN DASHBOARD STATISTICS
// GET /api/admin/stats
// =============================================

router.get("/stats", async (req, res) => {
    try {
        const totalUsers =
            await User.countDocuments();

        const totalBookings =
            await Booking.countDocuments();

        // Count operator-owned buses only.
        const totalBuses =
            await Bus.countDocuments(
                OPERATOR_BUS_FILTER
            );

        const revenueData = await Booking.aggregate([
            {
                $match: {
                    status: "Paid"
                }
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$totalFare"
                    }
                }
            }
        ]);

        return res.json({
            success: true,
            totalUsers,
            totalBookings,
            totalBuses,
            totalRevenue:
                revenueData[0]?.total || 0
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================
// GET USERS
// GET /api/admin/users
// =============================================

router.get("/users", async (req, res) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({
                createdAt: -1
            });

        const usersWithCounts = await Promise.all(
            users.map(async (user) => {

                const bookingCount =
                    await Booking.countDocuments({
                        userId: String(user._id)
                    });

                return {
                    ...user.toObject(),
                    bookingCount
                };
            })
        );

        return res.json({
            success: true,
            users: usersWithCounts
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================
// GET BOOKINGS
// GET /api/admin/bookings
// =============================================

router.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find()
            .sort({
                createdAt: -1
            });

        return res.json({
            success: true,
            bookings
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================
// CANCEL BOOKING
// PUT /api/admin/bookings/:id/cancel
// =============================================

router.put(
    "/bookings/:id/cancel",
    async (req, res) => {
        try {
            const booking =
                await Booking.findByIdAndUpdate(
                    req.params.id,
                    {
                        status: "Cancelled"
                    },
                    {
                        new: true
                    }
                );

            return res.json({
                success: true,
                message: "Booking cancelled",
                booking
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// =============================================
// GET OPERATOR-OWNED BUSES
// GET /api/admin/buses
// =============================================


/* =========================================
   GET OPERATOR BUSES WITH COMPANY NAME
   GET /api/admin/buses
========================================= */

router.get("/buses", async (req, res) => {
    try {

        const buses = await Bus.find({
            operatorId: {
                $type: "objectId"
            }
        })
        .populate({
            path: "operatorId",
            model: Operator,
            select: "companyName ownerName"
        })
        .sort({
            createdAt: -1
        });

        return res.json({
            success: true,
            buses
        });

    } catch (error) {

        console.error(
            "Admin buses loading error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load operator buses"
        });
    }
});


// =============================================
// ADD BUS - DISABLED
// POST /api/admin/buses
// =============================================

// Only Bus Operators are allowed to add buses.
// Admin must not create unowned dummy buses.

router.post("/buses", (req, res) => {
    return res.status(403).json({
        success: false,
        message:
            "Only Bus Operators can add buses."
    });
});

// =============================================
// UPDATE BUS - DISABLED
// PUT /api/admin/buses/:id
// =============================================

// Operators manage their own buses.
// Admin cannot overwrite operator bus details.

router.put("/buses/:id", (req, res) => {
    return res.status(403).json({
        success: false,
        message:
            "Only the owning Bus Operator can update buses."
    });
});

// =============================================
// DELETE BUS - DISABLED
// DELETE /api/admin/buses/:id
// =============================================

// Protect related Trips, Bookings and SeatLocks.

router.delete("/buses/:id", (req, res) => {
    return res.status(403).json({
        success: false,
        message:
            "Bus deletion is disabled to protect trips and bookings."
    });
});

// =============================================
// GET CONTACT MESSAGES
// GET /api/admin/messages
// =============================================

router.get("/messages", async (req, res) => {
    try {
        const messages = await Contact.find()
            .sort({
                createdAt: -1
            });

        return res.json({
            success: true,
            messages
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================
// MARK MESSAGE AS READ
// PUT /api/admin/messages/:id/read
// =============================================

router.put(
    "/messages/:id/read",
    async (req, res) => {
        try {

            const message =
                await Contact.findByIdAndUpdate(
                    req.params.id,
                    {
                        isRead: true
                    },
                    {
                        new: true
                    }
                );

            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: "Message not found"
                });
            }

            return res.json({
                success: true,
                message: "Marked as read",
                data: message
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// =============================================
// EXPORT ADMIN ROUTER
// =============================================

module.exports = router;
