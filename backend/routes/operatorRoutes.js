
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Operator = require("../models/Operator");
const { operatorProtect } = require("../middleware/operatorAuth");
const OperatorBookingsTripModel = require("../models/Trip");
const OperatorBookingsBookingModel = require("../models/Booking");

const router = express.Router();

function generateOperatorToken(operator) {
  return jwt.sign(
    {
      id: operator._id,
      email: operator.email,
      role: "operator",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// ==========================================
// REGISTER OPERATOR
// POST /api/operators/register
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { companyName, ownerName, email, phone, address, password } = req.body;

    if (!companyName || !ownerName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await Operator.findOne({ email: cleanEmail });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Operator email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const operator = await Operator.create({
      companyName: companyName.trim(),
      ownerName: ownerName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      address: address?.trim() || "",
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Operator registration successful",
      operator: {
        id: operator._id,
        companyName: operator.companyName,
        ownerName: operator.ownerName,
        email: operator.email,
        phone: operator.phone,
        status: operator.status,
      },
    });
  } catch (error) {
    console.error("Operator registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Operator registration failed",
      error: error.message,
    });
  }
});

// ==========================================
// LOGIN OPERATOR
// POST /api/operators/login
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const operator = await Operator.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!operator) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const matched = await bcrypt.compare(password, operator.password);

    if (!matched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (operator.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Operator account is suspended",
      });
    }

    const token = generateOperatorToken(operator);

    return res.json({
      success: true,
      message: "Operator login successful",
      token,
      operator: {
        id: operator._id,
        companyName: operator.companyName,
        ownerName: operator.ownerName,
        email: operator.email,
        phone: operator.phone,
        address: operator.address,
        status: operator.status,
      },
    });
  } catch (error) {
    console.error("Operator login error:", error);
    return res.status(500).json({
      success: false,
      message: "Operator login failed",
      error: error.message,
    });
  }
});

// ==========================================
// SECURE OPERATOR PROFILE
// GET /api/operators/profile
// ==========================================
router.get("/profile", operatorProtect, async (req, res) => {
  try {
    const operator = req.operator;

    if (!operator || !operator._id) {
      return res.status(401).json({
        success: false,
        message: "Operator authentication required",
      });
    }

    // Explicitly allowlist fields: never send password/hash.
    return res.status(200).json({
      success: true,
      operator: {
        _id: operator._id,
        companyName: operator.companyName || "",
        ownerName: operator.ownerName || "",
        email: operator.email || "",
        phone: operator.phone || "",
        address: operator.address || "",
        status: operator.status || "",
        createdAt: operator.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Operator profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load operator profile",
    });
  }
});


/* ==========================================
   RAJABUS - SECURE EDIT OPERATOR PROFILE

   PUT /api/operators/profile

   Allowed:
   - companyName
   - ownerName
   - phone
   - address

   Protected:
   - email
   - password
   - status
   - operator ID
   ========================================== */

router.put(
  "/profile",
  operatorProtect,
  async (req, res) => {

    try {

      // ======================================
      // AUTHENTICATED OPERATOR
      // ======================================

      const operatorId = req.operator?._id;

      if (!operatorId) {
        return res.status(401).json({
          success: false,
          message: "Operator authentication required",
        });
      }

      // ======================================
      // VALIDATE REQUEST BODY
      // ======================================

      const payload = req.body;

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid profile data is required",
        });
      }

      // ======================================
      // ALLOWED FIELDS ONLY
      // ======================================

      const fieldLimits = {
        companyName: 120,
        ownerName: 120,
        phone: 20,
        address: 500,
      };

      const keys = Object.keys(payload);

      // Reject unknown or protected fields.

      if (
        keys.length === 0 ||
        keys.some(
          (key) =>
            !Object.prototype.hasOwnProperty.call(
              fieldLimits,
              key
            )
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only companyName, ownerName, phone and address can be updated",
        });
      }

      // ======================================
      // VALIDATE FIELD VALUES
      // ======================================

      const updates = {};

      for (const key of keys) {

        if (typeof payload[key] !== "string") {
          return res.status(400).json({
            success: false,
            message: `${key} must be text`,
          });
        }

        const value = payload[key].trim();

        // Address may be empty.
        // Other editable fields are required.

        if (
          value.length > fieldLimits[key] ||
          (key !== "address" && !value)
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${key} value`,
          });
        }

        updates[key] = value;
      }

      // ======================================
      // FIND LOGGED-IN OPERATOR
      // ======================================

      const operator =
        await Operator.findById(operatorId);

      if (!operator) {
        return res.status(404).json({
          success: false,
          message: "Operator account not found",
        });
      }

      // Suspended accounts cannot edit.

      if (operator.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: "Operator account is not active",
        });
      }

      // ======================================
      // APPLY ALLOWED UPDATES
      // ======================================

      for (const key of keys) {
        operator[key] = updates[key];
      }

      // Save with Mongoose validation.

      await operator.save();

      // ======================================
      // SECURE RESPONSE
      // ======================================

      // Never return password or password hash.

      return res.status(200).json({
        success: true,

        message:
          "Operator profile updated successfully",

        operator: {
          _id: operator._id,

          companyName: operator.companyName,
          ownerName: operator.ownerName,

          email: operator.email,
          phone: operator.phone,
          address: operator.address,

          status: operator.status,
          createdAt: operator.createdAt,
        },
      });

    } catch (error) {

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid profile details",
        });
      }

      console.error(
        "Operator profile update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update operator profile",
      });
    }
  }
);


/* ==========================================
   RAJABUS - SECURE CHANGE PASSWORD

   POST /api/operators/change-password

   Authentication: Operator JWT
   ========================================== */

router.post(
  "/change-password",
  operatorProtect,
  async (req, res) => {

    try {

      // ======================================
      // AUTHENTICATED OPERATOR
      // ======================================

      const operatorId = req.operator?._id;

      if (!operatorId) {
        return res.status(401).json({
          success: false,
          message: "Operator authentication required",
        });
      }

      // ======================================
      // VALIDATE REQUEST BODY
      // ======================================

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current and new passwords are required",
        });
      }

      // Accept only the two expected fields.
      // Prevent changes to other account fields.

      const keys = Object.keys(body);

      if (
        keys.length !== 2 ||
        !keys.includes("currentPassword") ||
        !keys.includes("newPassword")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only currentPassword and newPassword are accepted",
        });
      }

      const {
        currentPassword,
        newPassword,
      } = body;

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword.trim() ||
        !newPassword.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid current and new passwords are required",
        });
      }

      // ======================================
      // NEW PASSWORD VALIDATION
      // ======================================

      if (
        [...newPassword].length < 8 ||
        Buffer.byteLength(newPassword, "utf8") > 72
      ) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 8 characters and at most 72 UTF-8 bytes",
        });
      }

      // ======================================
      // LOAD OPERATOR FROM MONGODB
      // ======================================

      const operator =
        await Operator.findById(operatorId);

      if (!operator) {
        return res.status(401).json({
          success: false,
          message: "Operator account not found",
        });
      }

      // ======================================
      // CHECK ACCOUNT STATUS
      // ======================================

      if (operator.status !== "Active") {
        return res.status(403).json({
          success: false,
          message:
            "Operator account is not active",
        });
      }

      // ======================================
      // VERIFY CURRENT PASSWORD
      // ======================================

      const currentMatches =
        await bcrypt.compare(
          currentPassword,
          operator.password
        );

      if (!currentMatches) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // ======================================
      // PREVENT REUSING CURRENT PASSWORD
      // ======================================

      const newMatchesOld =
        await bcrypt.compare(
          newPassword,
          operator.password
        );

      if (newMatchesOld) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be different from current password",
        });
      }

      // ======================================
      // HASH AND SAVE NEW PASSWORD
      // ======================================

      const hashedPassword =
        await bcrypt.hash(newPassword, 12);

      operator.password = hashedPassword;

      await operator.save();

      // ======================================
      // SUCCESS RESPONSE
      // ======================================

      // Never return the password or its hash.

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });

    } catch (error) {

      console.error(
        "Operator password update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to change password",
      });

    }
  }
);


// ==========================================
// OPERATOR BOOKINGS (READ ONLY)
// GET /api/operators/bookings
// ==========================================
router.get("/bookings", operatorProtect, async (req, res) => {
  try {
    const operatorId = req.operator?._id;

    if (!operatorId) {
      return res.status(401).json({
        success: false,
        message: "Operator authentication required",
      });
    }

    const status = String(req.query.status || "All").trim();
    const allowedStatuses = ["All", "Pending", "Paid", "Cancelled", "Expired"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status filter",
      });
    }

    const requestedPage = Number(req.query.page || 1);
    const requestedLimit = Number(req.query.limit || 20);

    const page = Number.isInteger(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;

    const limit = Number.isInteger(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 100))
      : 20;

    const skip = (page - 1) * limit;

    // Filter by trips belonging to this authenticated operator.
    const tripIds = await OperatorBookingsTripModel.distinct("_id", {
      operatorId,
    });

    const operatorBookingFilter = { tripId: { $in: tripIds } };
    const bookingFilter = { ...operatorBookingFilter };

    if (status !== "All") {
      bookingFilter.status = status;
    }

    const [total, bookings, statistics] = await Promise.all([
      OperatorBookingsBookingModel.countDocuments(bookingFilter),

      OperatorBookingsBookingModel.find(bookingFilter)
        .select(
          "ticketId tripId busId busNo " +
          "from to departTime arriveTime " +
          "journeyDate passengerName " +
          "mobileNo email seats " +
          "boardingPoint droppingPoint " +
          "totalFare status paidAt createdAt"
        )
        .populate({
          path: "tripId",
          select: "from to journeyDate departureTime arrivalTime",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      OperatorBookingsBookingModel.aggregate([
        { $match: operatorBookingFilter },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            paidBookings: {
              $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] },
            },
            pendingBookings: {
              $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
            },
            expiredBookings: {
              $sum: { $cond: [{ $eq: ["$status", "Expired"] }, 1, 0] },
            },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Paid"] },
                  { $ifNull: ["$totalFare", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = statistics[0] || {};

    return res.status(200).json({
      success: true,
      message: "Operator bookings loaded successfully",
      stats: {
        totalBookings: stats.totalBookings || 0,
        paidBookings: stats.paidBookings || 0,
        pendingBookings: stats.pendingBookings || 0,
        cancelledBookings: stats.cancelledBookings || 0,
        expiredBookings: stats.expiredBookings || 0,
        totalRevenue: stats.totalRevenue || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      bookings,
    });
  } catch (error) {
    console.error("Operator bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load operator bookings",
    });
  }
});

module.exports = router;
