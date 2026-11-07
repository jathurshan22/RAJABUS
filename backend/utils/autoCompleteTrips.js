
"use strict";

// ==========================================
// RAJABUS - AUTOMATIC TRIP COMPLETION
// 1 HOUR BEFORE DEPARTURE
// SRI LANKA TIME
// ==========================================

const Trip = require("../models/Trip");

const TIME_ZONE = "Asia/Colombo";

const ONE_HOUR = 60 * 60 * 1000;


// ==========================================
// GET 1-HOUR CUTOFF IN SRI LANKA TIME
// ==========================================

function getClosingCutoff(now = new Date()) {

  const cutoff = new Date(
    now.getTime() + ONE_HOUR
  );

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }
  ).formatToParts(cutoff);

  const part = (type) =>
    parts.find(
      (item) => item.type === type
    )?.value;

  return {
    journeyDate:
      `${part("year")}-${part("month")}-${part("day")}`,

    departureTime:
      `${part("hour")}:${part("minute")}`
  };
}


// ==========================================
// AUTOMATICALLY COMPLETE EXPIRED TRIPS
// ==========================================

async function completeTripsPastCutoff() {

  const {
    journeyDate,
    departureTime
  } = getClosingCutoff();

  // Example:
  // Current time: 05:45
  // Cutoff:       06:45
  //
  // Trips departing at or before
  // 06:45 become Completed.

  const result = await Trip.updateMany(
    {
      status: "Active",

      $or: [
        {
          journeyDate: {
            $lt: journeyDate
          }
        },

        {
          journeyDate,

          departureTime: {
            $lte: departureTime
          }
        }
      ]
    },

    {
      $set: {
        status: "Completed"
      }
    }
  );

  return result;
}


// ==========================================
// AUTO COMPLETION SCHEDULER
// ==========================================

let started = false;

function startAutoCompleteTrips() {

  if (started) return;

  started = true;

  async function checkTrips() {

    try {

      const result =
        await completeTripsPastCutoff();

      if (result.modifiedCount > 0) {

        console.log(
          `Auto-completed ${result.modifiedCount} trip(s)`
        );

      }

    } catch (error) {

      console.error(
        "Automatic trip completion error:",
        error
      );

    } finally {

      // Run shortly after each minute begins.

      const delay =
        60000 - (Date.now() % 60000) + 30;

      setTimeout(
        checkTrips,
        delay
      );

    }

  }

  // Check immediately when server starts.

  void checkTrips();
}


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  getClosingCutoff,
  completeTripsPastCutoff,
  startAutoCompleteTrips
};
