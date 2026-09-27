const express = require("express");
const crypto = require("crypto");

const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");

const { protect } = require("../middleware/auth");

const {
  broadcastSeatUpdate,
} = require("../utils/realtimeSeats");


const router = express.Router();


// ======================================================
// HELPERS
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


function formatAmount(value) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Invalid payment amount"
    );
  }

  return amount.toFixed(2);
}


function splitName(fullName = "") {

  const parts =
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if (parts.length === 0) {
    return {
      firstName: "Passenger",
      lastName: "Passenger",
    };
  }


  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }


  return {
    firstName: parts[0],
    lastName:
      parts.slice(1).join(" "),
  };
}


function cleanText(
  value,
  fallback = ""
) {

  const text =
    String(
      value ?? fallback
    )
      .replace(
        /<[^>]*>/g,
        ""
      )
      .trim();


  return text || fallback;
}


// ======================================================
// EXPIRE BOOKING HOLD
// ======================================================

async function expireBooking(
  booking
) {

  await SeatLock.deleteMany({
    bookingId:
      booking._id,

    status:
      "held",
  });


  booking.status =
    "Expired";

  booking.holdExpiresAt =
    null;


  await booking.save();


  broadcastSeatUpdate({
    busId:
      booking.busId,

    journeyDate:
      booking.journeyDate,

    seats:
      booking.seats || [],

    action:
      "released",

    bookingId:
      booking._id,

    status:
      "Expired",
  });
}


// ======================================================
// CREATE PAYHERE PAYMENT
//
// POST
// /api/payments/create/:bookingId
// ======================================================

router.post(
  "/create/:bookingId",
  protect,
  async (req, res) => {

    try {

      // ==================================================
      // PAYHERE ENV
      // ==================================================

      const merchantId =
        cleanEnv(
          process.env
            .PAYHERE_MERCHANT_ID
        );


      const merchantSecret =
        cleanEnv(
          process.env
            .PAYHERE_MERCHANT_SECRET
        );


      const notifyUrl =
        cleanEnv(
          process.env
            .PAYHERE_NOTIFY_URL
        );


      const sandbox =
        cleanEnv(
          process.env
            .PAYHERE_SANDBOX
        ).toLowerCase() !==
        "false";


      if (
        !merchantId ||
        !merchantSecret ||
        !notifyUrl
      ) {

        console.error(
          "PayHere configuration missing"
        );


        return res
          .status(500)
          .json({
            success: false,
            message:
              "PayHere configuration is incomplete",
          });
      }


      if (
        !/^https:\/\//i.test(
          notifyUrl
        )
      ) {

        console.error(
          "PAYHERE_NOTIFY_URL must be HTTPS:",
          notifyUrl
        );


        return res
          .status(500)
          .json({
            success: false,
            message:
              "PayHere notify URL is invalid",
          });
      }


      // ==================================================
      // FIND BOOKING
      // ==================================================

      const booking =
        await Booking.findById(
          req.params.bookingId
        );


      if (!booking) {

        return res
          .status(404)
          .json({
            success: false,
            message:
              "Booking not found",
          });
      }


      // ==================================================
      // OWNER CHECK
      // ==================================================

      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              "You can only pay for your own booking",
          });
      }


      // ==================================================
      // STATUS CHECK
      // ==================================================

      if (
        booking.status ===
        "Paid"
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              "This booking is already paid",
          });
      }


      if (
        booking.status ===
          "Cancelled" ||
        booking.status ===
          "Expired"
      ) {

        return res
          .status(400)
          .json({
            success: false,

            expired:
              booking.status ===
              "Expired",

            message:
              booking.status ===
              "Expired"
                ? "This seat hold has expired."
                : "This booking has been cancelled.",
          });
      }


      // ==================================================
      // HOLD EXPIRY CHECK
      // ==================================================

      if (
        !booking.holdExpiresAt ||
        new Date(
          booking.holdExpiresAt
        ).getTime() <=
          Date.now()
      ) {

        await expireBooking(
          booking
        );


        return res
          .status(410)
          .json({
            success: false,
            expired: true,

            message:
              "Your 15-minute seat hold has expired.",
          });
      }


      // ==================================================
      // VERIFY SEATS
      // ==================================================

      const seats =
        Array.isArray(
          booking.seats
        )
          ? booking.seats
          : [];


      if (
        seats.length === 0
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              "No seats found for this booking",
          });
      }


      const locks =
        await SeatLock.find({
          bookingId:
            booking._id,

          status:
            "held",
        });


      if (
        locks.length !==
        seats.length
      ) {

        return res
          .status(409)
          .json({
            success: false,
            message:
              "Seat hold is no longer valid.",
          });
      }


      // ==================================================
      // ORDER DETAILS
      // ==================================================

      const orderId =
        cleanText(
          booking.ticketId ||
          booking._id
        );


      const amount =
        formatAmount(
          booking.totalFare
        );


      const currency =
        "LKR";


      // ==================================================
      // PAYHERE HASH
      //
      // HASH =
      //
      // MD5(
      // merchant_id +
      // order_id +
      // amount +
      // currency +
      // MD5(merchant_secret)
      // )
      //
      // All MD5 values uppercase.
      // ==================================================

      const hashedSecret =
        md5(
          merchantSecret
        );


      const hashInput =
        merchantId +
        orderId +
        amount +
        currency +
        hashedSecret;


      const hash =
        md5(
          hashInput
        );


      // ==================================================
      // PASSENGER DETAILS
      // ==================================================

      const {
        firstName,
        lastName,
      } =
        splitName(
          booking.passengerName
        );


      const email =
        cleanText(
          booking.email
        );


      const phone =
        cleanText(
          booking.mobileNo
        );


      const address =
        cleanText(
          booking.boardingPoint,
          "Mihintale"
        );


      const city =
        cleanText(
          booking.from ||
          booking.boardingPoint,
          "Mihintale"
        );


      // ==================================================
      // CUSTOMER VALIDATION
      // ==================================================

      const validEmail =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        );


      if (!validEmail) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              "Passenger email address is invalid",
          });
      }


      if (
        !phone ||
        phone.length < 9
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              "Passenger phone number is invalid",
          });
      }


      // ==================================================
      // PAYMENT OBJECT
      //
      // return_url and cancel_url are added as
      // undefined in payment.js because JSON removes
      // undefined properties.
      // ==================================================

      const payment = {

        sandbox,

        merchant_id:
          merchantId,

        notify_url:
          notifyUrl,

        order_id:
          orderId,

        items:
          `Raja Bus Ticket ${orderId}`,

        amount,

        currency,

        hash,

        first_name:
          cleanText(
            firstName,
            "Passenger"
          ),

        last_name:
          cleanText(
            lastName,
            "Passenger"
          ),

        email,

        phone,

        address,

        city,

        country:
          "Sri Lanka",

        custom_1:
          String(
            booking._id
          ),

        custom_2:
          "",
      };


      // ==================================================
      // SAFE DEBUG
      //
      // DO NOT PRINT MERCHANT SECRET.
      // DO NOT PRINT FULL HASH.
      // ==================================================

      console.log(
        "\n================================"
      );

      console.log(
        "PAYHERE PAYMENT DEBUG"
      );

      console.log(
        "================================"
      );

      console.log(
        "Sandbox:",
        sandbox
      );

      console.log(
        "Merchant ID:",
        merchantId
      );

      console.log(
        "Merchant Secret loaded:",
        Boolean(
          merchantSecret
        )
      );

      console.log(
        "Merchant Secret length:",
        merchantSecret.length
      );

      console.log(
        "Order ID:",
        orderId
      );

      console.log(
        "Amount:",
        amount
      );

      console.log(
        "Currency:",
        currency
      );

      console.log(
        "Hash generated:",
        Boolean(hash)
      );

      console.log(
        "Hash length:",
        hash.length
      );

      console.log(
        "Notify URL:",
        notifyUrl
      );

      console.log(
        "Email:",
        email
      );

      console.log(
        "Phone:",
        phone
      );

      console.log(
        "================================\n"
      );


      // ==================================================
      // RESPONSE
      // ==================================================

      return res.json({
        success: true,

        message:
          "PayHere payment created",

        payment,
      });


    } catch (error) {

      console.error(
        "Create PayHere payment error:",
        error
      );


      return res
        .status(500)
        .json({
          success: false,

          message:
            "Could not create payment",

          error:
            error.message,
        });
    }
  }
);


// ======================================================
// PAYHERE NOTIFICATION
//
// POST
// /api/payments/payhere/notify
//
// PayHere sends:
// application/x-www-form-urlencoded
// ======================================================

router.post(
  "/payhere/notify",

  express.urlencoded({
    extended: false,
  }),

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
        method,
        status_message,
      } =
        req.body;


      console.log(
        "\n================================"
      );

      console.log(
        "PAYHERE NOTIFICATION"
      );

      console.log(
        "================================"
      );

      console.log(
        "Order:",
        order_id
      );

      console.log(
        "Payment ID:",
        payment_id
      );

      console.log(
        "Status:",
        status_code
      );

      console.log(
        "Method:",
        method
      );

      console.log(
        "================================\n"
      );


      // ==================================================
      // REQUIRED VALUES
      // ==================================================

      if (
        !merchant_id ||
        !order_id ||
        !payhere_amount ||
        !payhere_currency ||
        status_code ===
          undefined ||
        !md5sig
      ) {

        console.warn(
          "Invalid PayHere notification"
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // ENV
      // ==================================================

      const merchantSecret =
        cleanEnv(
          process.env
            .PAYHERE_MERCHANT_SECRET
        );


      const expectedMerchantId =
        cleanEnv(
          process.env
            .PAYHERE_MERCHANT_ID
        );


      if (
        !merchantSecret ||
        !expectedMerchantId
      ) {

        console.error(
          "PayHere environment variables missing"
        );


        return res
          .sendStatus(500);
      }


      // ==================================================
      // MERCHANT ID CHECK
      // ==================================================

      if (
        cleanText(
          merchant_id
        ) !==
        expectedMerchantId
      ) {

        console.warn(
          "PayHere merchant ID mismatch"
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // VERIFY NOTIFICATION SIGNATURE
      // ==================================================

      const hashedSecret =
        md5(
          merchantSecret
        );


      const localMd5Sig =
        md5(
          String(
            merchant_id
          ) +
          String(
            order_id
          ) +
          String(
            payhere_amount
          ) +
          String(
            payhere_currency
          ) +
          String(
            status_code
          ) +
          hashedSecret
        );


      const receivedMd5Sig =
        String(
          md5sig
        )
          .trim()
          .toUpperCase();


      if (
        localMd5Sig !==
        receivedMd5Sig
      ) {

        console.warn(
          "Invalid PayHere MD5 signature"
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // FIND BOOKING
      // ==================================================

      let booking =
        null;


      if (custom_1) {

        booking =
          await Booking
            .findById(
              custom_1
            )
            .catch(
              () => null
            );
      }


      if (!booking) {

        booking =
          await Booking.findOne({
            ticketId:
              String(
                order_id
              ),
          });
      }


      if (!booking) {

        console.warn(
          "Booking not found:",
          order_id
        );


        return res
          .sendStatus(404);
      }


      // ==================================================
      // ORDER ID VERIFY
      // ==================================================

      const expectedOrderId =
        cleanText(
          booking.ticketId ||
          booking._id
        );


      if (
        expectedOrderId !==
        String(
          order_id
        ).trim()
      ) {

        console.warn(
          "PayHere order ID mismatch"
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // CURRENCY VERIFY
      // ==================================================

      if (
        String(
          payhere_currency
        )
          .trim()
          .toUpperCase() !==
        "LKR"
      ) {

        console.warn(
          "PayHere currency mismatch"
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // AMOUNT VERIFY
      // ==================================================

      const expectedAmount =
        Number(
          booking.totalFare
        );


      const receivedAmount =
        Number(
          payhere_amount
        );


      if (
        !Number.isFinite(
          expectedAmount
        ) ||
        !Number.isFinite(
          receivedAmount
        ) ||
        Math.abs(
          expectedAmount -
          receivedAmount
        ) > 0.01
      ) {

        console.warn(
          "PayHere amount mismatch:",
          {
            expectedAmount,
            receivedAmount,
          }
        );


        return res
          .sendStatus(400);
      }


      // ==================================================
      // STATUS = 2
      //
      // PAYMENT SUCCESS
      // ==================================================

      if (
        String(
          status_code
        ) === "2"
      ) {

        // -----------------------------------------------
        // ALREADY PAID
        // -----------------------------------------------

        if (
          booking.status ===
          "Paid"
        ) {

          console.log(
            "Duplicate successful notification:",
            order_id
          );


          return res
            .sendStatus(200);
        }


        // -----------------------------------------------
        // ONLY PENDING BOOKING
        // -----------------------------------------------

        if (
          booking.status !==
          "Pending"
        ) {

          console.error(
            "Successful PayHere payment received for non-pending booking:",
            {
              bookingId:
                booking._id,

              status:
                booking.status,

              orderId:
                order_id,
            }
          );


          return res
            .sendStatus(200);
        }


        // -----------------------------------------------
        // VERIFY SEATS STILL HELD
        // -----------------------------------------------

        const seats =
          Array.isArray(
            booking.seats
          )
            ? booking.seats
            : [];


        const locks =
          await SeatLock.find({
            bookingId:
              booking._id,

            status:
              "held",
          });


        if (
          locks.length !==
          seats.length
        ) {

          console.error(
            "PAYMENT SUCCESS BUT SEAT HOLD MISSING",
            {
              bookingId:
                booking._id,

              expectedSeats:
                seats.length,

              heldSeats:
                locks.length,
            }
          );


          /*
            Production system:
            refund/manual-review logic
            should be added here.

            For this project we do NOT mark
            booking Paid without seat locks.
          */

          return res
            .sendStatus(200);
        }


        // ==================================================
        // HELD -> BOOKED
        // ==================================================

        await SeatLock.updateMany(
          {
            bookingId:
              booking._id,

            status:
              "held",
          },

          {
            $set: {
              status:
                "booked",

              expiresAt:
                null,
            },
          }
        );


        // ==================================================
        // BOOKING -> PAID
        // ==================================================

        booking.status =
          "Paid";

        booking.holdExpiresAt =
          null;

        booking.paidAt =
          new Date();


        await booking.save();


        // ==================================================
        // REAL-TIME
        //
        // ORANGE -> RED
        // ==================================================

        broadcastSeatUpdate({
          busId:
            booking.busId,

          journeyDate:
            booking.journeyDate,

          seats,

          action:
            "booked",

          bookingId:
            booking._id,

          status:
            "Paid",
        });


        console.log(
          "PayHere payment SUCCESS:",
          order_id
        );


        return res
          .sendStatus(200);
      }


      // ==================================================
      // OTHER STATUS CODES
      //
      // 0  = pending
      // -1 = cancelled
      // -2 = failed
      // -3 = chargeback
      // ==================================================

      console.log(
        "PayHere payment not successful:",
        {
          order_id,
          status_code,
          status_message,
        }
      );


      /*
        Booking stays Pending.
        User can retry payment until
        15-minute seat hold expires.
      */

      return res
        .sendStatus(200);


    } catch (error) {

      console.error(
        "PayHere notification error:",
        error
      );


      return res
        .sendStatus(500);
    }
  }
);


// ======================================================
// PAYMENT STATUS
//
// GET
// /api/payments/status/:bookingId
// ======================================================

router.get(
  "/status/:bookingId",
  protect,
  async (req, res) => {

    try {

      const booking =
        await Booking.findById(
          req.params.bookingId
        );


      if (!booking) {

        return res
          .status(404)
          .json({
            success: false,
            message:
              "Booking not found",
          });
      }


      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              "You can only view your own payment",
          });
      }


      // If pending booking expired
      // while user is on payment page

      if (
        booking.status ===
          "Pending" &&
        booking.holdExpiresAt &&
        new Date(
          booking.holdExpiresAt
        ).getTime() <=
          Date.now()
      ) {

        await expireBooking(
          booking
        );
      }


      return res.json({
        success: true,

        bookingId:
          booking._id,

        status:
          booking.status,

        paid:
          booking.status ===
          "Paid",

        expired:
          booking.status ===
          "Expired",

        holdExpiresAt:
          booking.holdExpiresAt,
      });


    } catch (error) {

      console.error(
        "Payment status error:",
        error
      );


      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to check payment status",

          error:
            error.message,
        });
    }
  }
);


module.exports = router;