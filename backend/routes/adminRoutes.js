const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const Contact = require("../models/Contact");
const { protect, adminOnly } = require("../middleware/auth");

// Every route below requires a valid admin JWT
router.use(protect, adminOnly);

/* ADMIN STATS */
router.get("/stats", async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalBookings = await Booking.countDocuments();
        const totalBuses = await Bus.countDocuments();

        const revenueData = await Booking.aggregate([
            { $match: { status: "Paid" } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } }
        ]);

        res.json({
            success: true,
            totalUsers,
            totalBookings,
            totalBuses,
            totalRevenue: revenueData[0]?.total || 0
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* GET USERS */
router.get("/users", async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });

        // Attach a real booking count per user (Booking.userId stores the
        // Mongo _id as a string, so we match against that).
        const usersWithCounts = await Promise.all(
            users.map(async (user) => {
                const bookingCount = await Booking.countDocuments({
                    userId: String(user._id),
                });

                return {
                    ...user.toObject(),
                    bookingCount,
                };
            })
        );

        res.json({
            success: true,
            users: usersWithCounts
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* GET BOOKINGS */
router.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            bookings
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* CANCEL BOOKING */
router.put("/bookings/:id/cancel", async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: "Cancelled" },
            { new: true }
        );

        res.json({
            success: true,
            message: "Booking cancelled",
            booking
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* GET BUSES */
router.get("/buses", async (req, res) => {
    try {
        const buses = await Bus.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            buses
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ADD BUS */
router.post("/buses", async (req, res) => {
    try {
        const bus = await Bus.create(req.body);

        res.status(201).json({
            success: true,
            message: "Bus added successfully",
            bus
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* UPDATE BUS */
router.put("/buses/:id", async (req, res) => {
    try {
        const bus = await Bus.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json({
            success: true,
            message: "Bus updated successfully",
            bus
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* DELETE BUS */
router.delete("/buses/:id", async (req, res) => {
    try {
        await Bus.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Bus deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* GET CONTACT MESSAGES */
router.get("/messages", async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* MARK MESSAGE AS READ */
router.put("/messages/:id/read", async (req, res) => {
    try {
        const message = await Contact.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found",
            });
        }

        res.json({
            success: true,
            message: "Marked as read",
            data: message,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;