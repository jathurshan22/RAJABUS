
const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");

const { protect } = require("../middleware/auth");

const {
  broadcastSeatUpdate,
} = require("../utils/realtimeSeats");

const router = express.Router();


// ======================================================
// PAYHERE HELPERS
// ======================================================

function md5(value) {
  return crypto
    .createHash("md5")
    .update(String(value), "utf8")
    .digest("hex")
    .toUpperCase();
}

function cleanEnv(value) {
  return String(value || "").trim();
}

function cleanText(value, fallback = "") {
  const result = String(value ?? fallback)
    .replace(/<[^>]*>/g, "")
    .trim();

  return result || fallback;
}

function formatAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  return amount.toFixed(2);
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "Passenger",
      lastName: "Passenger",
    };
  }

  return {
    firstName: parts[0],
    lastName:
      parts.slice(1).join(" ") || parts[0],
  };
}

function safeSignatureMatch(expected, received) {
  const receivedHex = String(received || "")
    .trim()
    .toUpperCase();

  if (!/^[0-9A-F]{32}$/.test(receivedHex)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(receivedHex, "hex");

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}


// ======================================================
// TRIP-BASED REAL-TIME UPDATE
//
// Only subscribers viewing this scheduled trip
// receive held / booked / released updates.
// ======================================================

function sendSeatUpdate(
  booking,
  action,
  status,
  expiresAt = null
) {
  if (!booking.tripId) {
    console.warn(
      "[PAYMENT SSE] Missing tripId for booking:",
      String(booking._id)
    );
    return;
  }

  broadcastSeatUpdate({
    tripId: booking.tripId,
    busId: booking.busId,
    journeyDate: booking.journeyDate,
    seats: booking.seats || [],
    action,
    bookingId: booking._id,
    status,
    expiresAt,
  });
}


// ======================================================
// EXPIRE PENDING BOOKING
//
// Only expired Pending bookings are changed.
// Paid bookings are never expired here.
// ======================================================

async function expireBooking(booking) {
  const now = new Date();

  const expired = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: "Pending",
      $or: [
        { holdExpiresAt: { $lte: now } },
        { holdExpiresAt: null },
      ],
    },
    {
      $set: {
        status: "Expired",
        holdExpiresAt: null,
      },
    },
    {
      new: true,
    }
  );

  if (!expired) {
    return false;
  }

  const result = await SeatLock.deleteMany({
    bookingId: expired._id,
    status: "held",
  });

  if (result.deletedCount > 0) {
    sendSeatUpdate(
      expired,
      "released",
      "Expired"
    );
  }

  return true;
}


// ======================================================
// VERIFY ALL ACTIVE SEAT LOCKS
//
// Valid only if:
// - same booking
// - same scheduled trip
// - same bus/date
// - all requested seat numbers exist
// - every lock is still held and not expired
// ======================================================

async function verifySeatLocks(booking) {
  const seats = Array.isArray(booking.seats)
    ? booking.seats.map(String)
    : [];

  const seatSet = new Set(seats);

  if (
    !booking.tripId ||
    seats.length === 0 ||
    seatSet.size !== seats.length
  ) {
    return {
      valid: false,
      locks: [],
    };
  }

  const locks = await SeatLock.find({
    bookingId: booking._id,
    tripId: booking.tripId,
    busId: booking.busId,
    journeyDate: booking.journeyDate,
    status: "held",
    expiresAt: {
      $gt: new Date(),
    },
  });

  const lockSeats = new Set(
    locks.map((lock) => String(lock.seat))
  );

  const valid =
    locks.length === seats.length &&
    lockSeats.size === seats.length &&
    seats.every((seat) => lockSeats.has(seat));

  return { valid, locks };
}


// ======================================================
// CREATE PAYHERE PAYMENT
//
// POST /api/payments/create/:bookingId
// ======================================================

router.post(
  "/create/:bookingId",
  protect,
  async (req, res) => {
    try {
      const merchantId = cleanEnv(
        process.env.PAYHERE_MERCHANT_ID
      );

      const merchantSecret = cleanEnv(
        process.env.PAYHERE_MERCHANT_SECRET
      );

      const notifyUrl = cleanEnv(
        process.env.PAYHERE_NOTIFY_URL
      );

      const sandbox =
        cleanEnv(process.env.PAYHERE_SANDBOX)
          .toLowerCase() !== "false";

      // ------------------------------------------------
      // PAYHERE CONFIGURATION
      // ------------------------------------------------

      if (
        !merchantId ||
        !merchantSecret ||
        !notifyUrl
      ) {
        return res.status(500).json({
          success: false,
          message:
            "PayHere configuration is incomplete",
        });
      }

      if (!/^https:\/\//i.test(notifyUrl)) {
        return res.status(500).json({
          success: false,
          message:
            "PayHere notify URL must use HTTPS",
        });
      }

      // ------------------------------------------------
      // BOOKING ID CHECK
      // ------------------------------------------------

      if (
        !mongoose.isValidObjectId(
          req.params.bookingId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      // ------------------------------------------------
      // FIND BOOKING
      // ------------------------------------------------

      const booking = await Booking.findById(
        req.params.bookingId
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      // ------------------------------------------------
      // USER OWNERSHIP
      // ------------------------------------------------

      if (
        String(booking.userId) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only pay for your own booking",
        });
      }

      // ------------------------------------------------
      // TRIP ID REQUIRED
      // ------------------------------------------------

      if (!booking.tripId) {
        return res.status(409).json({
          success: false,
          message:
            "Scheduled trip information is missing",
        });
      }

      // ------------------------------------------------
      // BOOKING STATUS
      // ------------------------------------------------

      if (booking.status === "Paid") {
        return res.status(409).json({
          success: false,
          message: "This booking is already paid",
        });
      }

      if (booking.status !== "Pending") {
        return res.status(409).json({
          success: false,
          expired: booking.status === "Expired",
          message:
            "This booking is no longer available for payment",
        });
      }

      // ------------------------------------------------
      // 15-MINUTE EXPIRY
      // ------------------------------------------------

      if (
        !booking.holdExpiresAt ||
        new Date(booking.holdExpiresAt).getTime() <=
          Date.now()
      ) {
        await expireBooking(booking);

        return res.status(410).json({
          success: false,
          expired: true,
          message:
            "Your 15-minute seat hold has expired",
        });
      }

      // ------------------------------------------------
      // VERIFY TRIP SEATS
      // ------------------------------------------------

      const {
        valid: validLocks,
      } = await verifySeatLocks(booking);

      if (!validLocks) {
        return res.status(409).json({
          success: false,
          message:
            "Your seat hold is no longer valid",
        });
      }

      // ------------------------------------------------
      // PAYMENT VALUES
      // ------------------------------------------------

      const orderId = cleanText(
        booking.ticketId || booking._id
      );

      const amount = formatAmount(
        booking.totalFare
      );

      const currency = "LKR";

      // ------------------------------------------------
      // PAYHERE CHECKOUT HASH
      //
      // MD5(
      //   merchant_id +
      //   order_id +
      //   amount +
      //   currency +
      //   MD5(merchant_secret)
      // )
      // ------------------------------------------------

      const hash = md5(
        merchantId +
          orderId +
          amount +
          currency +
          md5(merchantSecret)
      );

      // ------------------------------------------------
      // PASSENGER DETAILS
      // ------------------------------------------------

      const {
        firstName,
        lastName,
      } = splitName(booking.passengerName);

      const email = cleanText(booking.email);
      const phone = cleanText(booking.mobileNo);

      const address = cleanText(
        booking.boardingPoint,
        "Sri Lanka"
      );

      const city = cleanText(
        booking.from,
        "Sri Lanka"
      );

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Passenger email address is invalid",
        });
      }

      if (phone.length < 9) {
        return res.status(400).json({
          success: false,
          message:
            "Passenger phone number is invalid",
        });
      }

      // ------------------------------------------------
      // PAYHERE PAYMENT OBJECT
      // ------------------------------------------------

      const payment = {
        sandbox,

        merchant_id: merchantId,
        notify_url: notifyUrl,

        order_id: orderId,
        items: `Raja Bus Ticket ${orderId}`,

        amount,
        currency,
        hash,

        first_name: cleanText(
          firstName,
          "Passenger"
        ),

        last_name: cleanText(
          lastName,
          "Passenger"
        ),

        email,
        phone,
        address,
        city,
        country: "Sri Lanka",

        custom_1: String(booking._id),
        custom_2: String(booking.tripId),
      };

      console.log(
        "[PayHere] Checkout prepared:",
        orderId
      );

      return res.json({
        success: true,
        message: "PayHere payment created",
        payment,
      });

    } catch (error) {
      console.error(
        "Create PayHere payment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not create payment",
      });
    }
  }
);


// ======================================================
// VERIFIED PAYHERE NOTIFICATION
//
// POST /api/payments/payhere/notify
//
// IMPORTANT:
// Only verified server-side PayHere notification
// can confirm an online payment.
// ======================================================

router.post(
  "/payhere/notify",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const {
        merchant_id,
        order_id,
        payment_id,
        payhere_amount,
        payhere_currency,
        status_code,
        md5sig,
        custom_1,
        custom_2,
        status_message,
      } = req.body || {};

      // ------------------------------------------------
      // REQUIRED VALUES
      // ------------------------------------------------

      if (
        !merchant_id ||
        !order_id ||
        !payhere_amount ||
        !payhere_currency ||
        status_code === undefined ||
        !md5sig
      ) {
        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // PAYHERE CONFIGURATION
      // ------------------------------------------------

      const merchantId = cleanEnv(
        process.env.PAYHERE_MERCHANT_ID
      );

      const merchantSecret = cleanEnv(
        process.env.PAYHERE_MERCHANT_SECRET
      );

      if (!merchantId || !merchantSecret) {
        console.error(
          "[PayHere] Missing merchant configuration"
        );

        return res.sendStatus(500);
      }

      // ------------------------------------------------
      // VERIFY MERCHANT ID
      // ------------------------------------------------

      if (
        String(merchant_id).trim() !== merchantId
      ) {
        console.warn(
          "[PayHere] Merchant ID mismatch"
        );

        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // VERIFY MD5 SIGNATURE
      //
      // MD5(
      // merchant_id +
      // order_id +
      // payhere_amount +
      // payhere_currency +
      // status_code +
      // MD5(merchant_secret)
      // )
      // ------------------------------------------------

      const expectedSignature = md5(
        String(merchant_id) +
          String(order_id) +
          String(payhere_amount) +
          String(payhere_currency) +
          String(status_code) +
          md5(merchantSecret)
      );

      if (
        !safeSignatureMatch(
          expectedSignature,
          md5sig
        )
      ) {
        console.warn(
          "[PayHere] Invalid notification signature"
        );

        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // FIND BOOKING
      // ------------------------------------------------

      let booking = null;

      if (
        custom_1 &&
        mongoose.isValidObjectId(custom_1)
      ) {
        booking = await Booking.findById(
          custom_1
        );
      }

      if (!booking) {
        booking = await Booking.findOne({
          ticketId: String(order_id),
        });
      }

      if (!booking) {
        console.error(
          "[PayHere] Booking not found:",
          order_id
        );

        return res.sendStatus(404);
      }

      // ------------------------------------------------
      // VERIFY ORDER ID
      // ------------------------------------------------

      const expectedOrderId = cleanText(
        booking.ticketId || booking._id
      );

      if (
        String(order_id).trim() !== expectedOrderId
      ) {
        console.warn(
          "[PayHere] Order ID mismatch"
        );

        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // VERIFY CURRENCY
      // ------------------------------------------------

      if (
        String(payhere_currency)
          .trim()
          .toUpperCase() !== "LKR"
      ) {
        console.warn(
          "[PayHere] Currency mismatch"
        );

        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // VERIFY AMOUNT
      // ------------------------------------------------

      let expectedAmount;

      try {
        expectedAmount = formatAmount(
          booking.totalFare
        );
      } catch (error) {
        return res.sendStatus(400);
      }

      const receivedAmount = Number(
        payhere_amount
      );

      if (
        !Number.isFinite(receivedAmount) ||
        receivedAmount <= 0 ||
        receivedAmount.toFixed(2) !==
          expectedAmount
      ) {
        console.warn(
          "[PayHere] Payment amount mismatch"
        );

        return res.sendStatus(400);
      }

      // ------------------------------------------------
      // VERIFY TRIP REFERENCE
      // ------------------------------------------------

      if (
        custom_2 &&
        booking.tripId &&
        String(custom_2) !==
          String(booking.tripId)
      ) {
        console.warn(
          "[PayHere] Trip ID mismatch"
        );

        return res.sendStatus(400);
      }

      console.log(
        "[PayHere] Verified notification:",
        {
          orderId: expectedOrderId,
          paymentId: payment_id || null,
          statusCode: String(status_code),
        }
      );

      // ==================================================
      // PAYMENT SUCCESS = STATUS CODE 2
      // ==================================================

      if (String(status_code) === "2") {

        // ----------------------------------------------
        // ALREADY PAID
        // Idempotent duplicate notification
        // ----------------------------------------------

        if (booking.status === "Paid") {
          return res.sendStatus(200);
        }

        // ----------------------------------------------
        // ONLY PENDING BOOKINGS
        // ----------------------------------------------

        if (booking.status !== "Pending") {
          console.error(
            "[PayHere] SUCCESSFUL PAYMENT REQUIRES REVIEW:",
            expectedOrderId,
            "Booking status:",
            booking.status
          );

          return res.sendStatus(200);
        }

        // ----------------------------------------------
        // CHECK HOLD EXPIRY BEFORE CONFIRMING
        // ----------------------------------------------

        if (
          !booking.holdExpiresAt ||
          new Date(
            booking.holdExpiresAt
          ).getTime() <= Date.now()
        ) {
          await expireBooking(booking);

          console.error(
            "[PayHere] PAYMENT RECEIVED AFTER HOLD EXPIRY. Manual review/refund required:",
            expectedOrderId
          );

          return res.sendStatus(200);
        }

        // ----------------------------------------------
        // VERIFY TRIP AND ACTIVE SEAT LOCKS
        // ----------------------------------------------

        const {
          valid,
          locks,
        } = await verifySeatLocks(booking);

        if (!valid) {
          console.error(
            "[PayHere] PAYMENT RECEIVED BUT SEAT HOLD INVALID. Manual review/refund required:",
            expectedOrderId
          );

          return res.sendStatus(200);
        }

        // ----------------------------------------------
        // HELD -> BOOKED
        //
        // Check modified count to avoid confirming
        // when a seat lock disappeared.
        // ----------------------------------------------

        const now = new Date();

        const lockResult =
          await SeatLock.updateMany(
            {
              _id: {
                $in: locks.map(
                  (lock) => lock._id
                ),
              },
              bookingId: booking._id,
              tripId: booking.tripId,
              status: "held",
              expiresAt: {
                $gt: now,
              },
            },
            {
              $set: {
                status: "booked",
                expiresAt: null,
              },
            }
          );

        if (
          lockResult.modifiedCount !==
          booking.seats.length
        ) {
          console.error(
            "[PayHere] CRITICAL: Seat confirmation incomplete. Manual reconciliation required:",
            expectedOrderId
          );

          return res.sendStatus(500);
        }

        // ----------------------------------------------
        // PENDING -> PAID
        //
        // Conditional update protects against
        // duplicate successful notifications.
        // ----------------------------------------------

        const paidBooking =
          await Booking.findOneAndUpdate(
            {
              _id: booking._id,
              status: "Pending",
              holdExpiresAt: {
                $gt: now,
              },
            },
            {
              $set: {
                status: "Paid",
                holdExpiresAt: null,
                paidAt: new Date(),
              },
            },
            {
              new: true,
            }
          );

        if (!paidBooking) {
          const latest =
            await Booking.findById(
              booking._id
            );

          if (latest?.status === "Paid") {
            return res.sendStatus(200);
          }

          console.error(
            "[PayHere] CRITICAL: Payment verified but booking status transition failed. Manual reconciliation required:",
            expectedOrderId
          );

          return res.sendStatus(500);
        }

        // ----------------------------------------------
        // REAL-TIME
        // ORANGE -> RED
        // ONLY THIS SCHEDULED TRIP
        // ----------------------------------------------

        sendSeatUpdate(
          paidBooking,
          "booked",
          "Paid"
        );

        console.log(
          "[PayHere] Booking PAID:",
          expectedOrderId,
          "Trip:",
          String(paidBooking.tripId)
        );

        return res.sendStatus(200);
      }

      // ==================================================
      // OTHER PAYMENT STATUS CODES
      //
      // 0  = Pending
      // -1 = Cancelled
      // -2 = Failed
      // -3 = Chargeback
      //
      // No automatic seat confirmation.
      // ==================================================

      console.log(
        "[PayHere] Non-success status:",
        {
          orderId: expectedOrderId,
          statusCode: String(status_code),
          message: status_message || "",
        }
      );

      if (String(status_code) === "-3") {
        console.warn(
          "[PayHere] CHARGEBACK: Manual financial review required:",
          expectedOrderId
        );
      }

      return res.sendStatus(200);

    } catch (error) {
      console.error(
        "[PayHere] Notification error:",
        error
      );

      return res.sendStatus(500);
    }
  }
);


// ======================================================
// PAYMENT STATUS
//
// GET /api/payments/status/:bookingId
// ======================================================

router.get(
  "/status/:bookingId",
  protect,
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.bookingId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      let booking = await Booking.findById(
        req.params.bookingId
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      // ----------------------------------------------
      // USER OWNERSHIP
      // ----------------------------------------------

      if (
        String(booking.userId) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only view your own payment",
        });
      }

      // ----------------------------------------------
      // EXPIRE OLD PENDING HOLD
      // ----------------------------------------------

      if (
        booking.status === "Pending" &&
        (
          !booking.holdExpiresAt ||
          new Date(
            booking.holdExpiresAt
          ).getTime() <= Date.now()
        )
      ) {
        await expireBooking(booking);

        booking = await Booking.findById(
          booking._id
        );
      }

      // ----------------------------------------------
      // RESPONSE
      // ----------------------------------------------

      return res.json({
        success: true,

        bookingId: booking._id,
        tripId: booking.tripId || null,

        status: booking.status,

        paid: booking.status === "Paid",

        expired:
          booking.status === "Expired",

        holdExpiresAt:
          booking.holdExpiresAt,
      });

    } catch (error) {
      console.error(
        "[PayHere] Payment status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to check payment status",
      });
    }
  }
);


module.exports = router;
