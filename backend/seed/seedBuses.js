const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Bus = require("../models/Bus");

dotenv.config();

const DISTANCES = {
  Ampara: 215,
  Anuradhapura: 13,
  Badulla: 195,
  Batticaloa: 175,
  Colombo: 197,
  Galle: 270,
  Gampaha: 175,
  Hambantota: 230,
  Jaffna: 171,
  Kalutara: 219,
  Kandy: 242,
  Kegalle: 91,
  Kilinochchi: 182,
  Kurunegala: 95,
  Mannar: 130,
  Matale: 110,
  Matara: 290,
  Monaragala: 175,
  Mullaitivu: 160,
  "Nuwara Eliya": 200,
  Polonnaruwa: 70,
  Puttalam: 140,
  Ratnapura: 230,
  Trincomalee: 105,
  Vavuniya: 60,
};

const DAILY_BUSES = [
  { type: "Private", regNo: "PVT-JY-4040", code: "01", depart: "05:30" },
  { type: "CTB", regNo: "CTB-WO-7400", code: "02", depart: "08:00" },
  { type: "Private", regNo: "PVT-EB-7122", code: "03", depart: "14:15" },
  { type: "CTB", regNo: "CTB-UI-0184", code: "04", depart: "18:30" },
];

const AVG_SPEED_KMH = 40;

function districtCode(name) {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function addMinutesToTime(hhmm, minutesToAdd) {
  const [h, m] = hhmm.split(":").map(Number);

  let total = h * 60 + m + minutesToAdd;
  total = total % (24 * 60);

  const newH = Math.floor(total / 60);
  const newM = total % 60;

  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function buildBuses() {
  const docs = [];

  Object.entries(DISTANCES).forEach(([to, distanceKm]) => {
    const travelMinutes = Math.round((distanceKm / AVG_SPEED_KMH) * 60);
    const fareMin = Math.round((distanceKm * 3.5) / 10) * 10;
    const fareMax = Math.round((distanceKm * 4.2) / 10) * 10;
    const code = districtCode(to);

    DAILY_BUSES.forEach((bus) => {
      docs.push({
        from: "Mihintale",
        to,
        type: bus.type,
        busNo: `${bus.type}-MIH-${code}-${bus.code}`,
        regNo: bus.regNo,
        depart: bus.depart,
        arrive: addMinutesToTime(bus.depart, travelMinutes),
        distanceKm,
        fareMin,
        fareMax,
        totalSeats: 40,
        availableSeats: 40
      });
    });
  });

  return docs;
}

async function seed() {
  await connectDB();

  const docs = buildBuses();

  await Bus.deleteMany({});
  await Bus.insertMany(docs);

  console.log(
    `Seeded ${docs.length} buses across ${Object.keys(DISTANCES).length} destinations.`
  );

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});