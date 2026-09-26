const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Bus = require("../models/Bus");

dotenv.config();


// ======================================================
// MIHINTALE → 25 DISTRICT CAPITAL / MAIN CITY DISTANCES
// Road-distance values rounded for project use.
// ======================================================

const DISTANCES = {
  Ampara: 231,
  Anuradhapura: 16,
  Badulla: 204,
  Batticaloa: 188,
  Colombo: 208,
  Galle: 312,
  Gampaha: 186,
  Hambantota: 331,
  Jaffna: 186,
  Kalutara: 244,
  Kandy: 132,
  Kegalle: 146,
  Kilinochchi: 121,
  Kurunegala: 116,
  Mannar: 106,
  Matale: 106,
  Matara: 346,
  Monaragala: 224,
  Mullaitivu: 154,
  "Nuwara Eliya": 204,
  Polonnaruwa: 97,
  Puttalam: 92,
  Ratnapura: 233,
  Trincomalee: 93,
  Vavuniya: 46,
};


// ======================================================
// 4 BUSES FOR EACH DISTRICT
//
// 25 destinations × 4 buses
// = 100 buses
// ======================================================

const DAILY_BUSES = [
  {
    type: "Private",
    code: "01",
    depart: "05:30",
  },

  {
    type: "CTB",
    code: "02",
    depart: "08:00",
  },

  {
    type: "Private",
    code: "03",
    depart: "14:15",
  },

  {
    type: "CTB",
    code: "04",
    depart: "18:30",
  },
];


// ======================================================
// FARE CALCULATION
//
// IMPORTANT:
// Official Sri Lankan fares are route/fare-stage based.
// This is a realistic project/demo calculation.
//
// Approx current normal fare benchmark:
// Rs. 4.25 per road km
//
// fareMin = estimated normal fare
// fareMax = semi-luxury benchmark ≈ 1.5 × normal
// ======================================================

const NORMAL_RATE_PER_KM = 4.25;


// Round fare to nearest Rs.10
function roundFare(amount) {
  return Math.round(amount / 10) * 10;
}


function calculateFare(distanceKm) {

  // Normal-service project estimate
  let normalFare =
    roundFare(
      distanceKm *
      NORMAL_RATE_PER_KM
    );


  // Current minimum normal fare
  if (normalFare < 34) {
    normalFare = 34;
  }


  // Semi-luxury benchmark
  const semiLuxuryFare =
    roundFare(
      normalFare * 1.5
    );


  return {
    fareMin: normalFare,
    fareMax: semiLuxuryFare,
  };
}


// ======================================================
// DISTRICT CODE
// Example:
// Colombo → COL
// Nuwara Eliya → NUW
// ======================================================

function districtCode(name) {

  return name
    .replace(
      /[^A-Za-z]/g,
      ""
    )
    .slice(
      0,
      3
    )
    .toUpperCase();
}


// ======================================================
// ADD MINUTES TO HH:MM
// ======================================================

function addMinutesToTime(
  hhmm,
  minutesToAdd
) {

  const [hour, minute] =
    hhmm
      .split(":")
      .map(Number);


  let totalMinutes =
    hour * 60 +
    minute +
    minutesToAdd;


  totalMinutes =
    totalMinutes %
    (24 * 60);


  const newHour =
    Math.floor(
      totalMinutes / 60
    );


  const newMinute =
    totalMinutes % 60;


  return (
    `${String(newHour)
      .padStart(2, "0")}:` +
    `${String(newMinute)
      .padStart(2, "0")}`
  );
}


// ======================================================
// TRAVEL TIME
//
// Long-distance buses are slower than cars.
// Average operational speed ≈ 42 km/h
// + 15 mins stop allowance.
// ======================================================

function calculateTravelMinutes(
  distanceKm
) {

  const averageSpeed = 42;


  const drivingMinutes =
    (
      distanceKm /
      averageSpeed
    ) * 60;


  return Math.round(
    drivingMinutes + 15
  );
}


// ======================================================
// GENERATE DUMMY REGISTRATION NUMBER
// ======================================================

function generateRegNo(
  destinationIndex,
  busIndex
) {

  const number =
    1000 +
    destinationIndex * 10 +
    busIndex;


  return `RB-${number}`;
}


// ======================================================
// BUILD 100 BUS DOCUMENTS
// ======================================================

function buildBuses() {

  const docs = [];


  const destinations =
    Object.entries(
      DISTANCES
    );


  destinations.forEach(
    (
      [
        destination,
        distanceKm,
      ],
      destinationIndex
    ) => {

      const code =
        districtCode(
          destination
        );


      // Calculate fare once
      // per destination
      const {
        fareMin,
        fareMax,
      } =
        calculateFare(
          distanceKm
        );


      // Calculate approximate
      // travel duration
      const travelMinutes =
        calculateTravelMinutes(
          distanceKm
        );


      DAILY_BUSES.forEach(
        (
          bus,
          busIndex
        ) => {

          docs.push({

            from:
              "Mihintale",

            to:
              destination,

            type:
              bus.type,


            // Example:
            // CTB-MIH-COL-02
            busNo:
              `${bus.type}-MIH-${code}-${bus.code}`,


            // Dummy registration
            regNo:
              generateRegNo(
                destinationIndex,
                busIndex + 1
              ),


            depart:
              bus.depart,


            arrive:
              addMinutesToTime(
                bus.depart,
                travelMinutes
              ),


            distanceKm,


            // Normal-service estimated fare
            fareMin,


            // Semi-luxury benchmark
            fareMax,


            totalSeats:
              40,
          });
        }
      );
    }
  );


  return docs;
}


// ======================================================
// SEED DATABASE
// ======================================================

async function seed() {

  try {

    await connectDB();


    const docs =
      buildBuses();


    console.log(
      `Preparing ${docs.length} buses...`
    );


    // Remove existing bus data
    await Bus.deleteMany({});


    // Insert new 100 buses
    await Bus.insertMany(
      docs
    );


    console.log(
      "================================"
    );

    console.log(
      `Successfully seeded ${docs.length} buses`
    );

    console.log(
      `Destinations: ${Object.keys(DISTANCES).length}`
    );

    console.log(
      "Buses per destination: 4"
    );

    console.log(
      "From: Mihintale"
    );

    console.log(
      "================================"
    );


    await mongoose
      .connection
      .close();


    process.exit(0);

  } catch (error) {

    console.error(
      "Seeding failed:",
      error
    );


    await mongoose
      .connection
      .close()
      .catch(() => {});


    process.exit(1);
  }
}


// ======================================================
// START
// ======================================================

seed();