// One-time migration script.
// Existing buses created before the `totalSeats` field was added to the
// Bus schema don't have that field stored in MongoDB at all, so the
// schema's `default: 40` never kicked in for them (defaults only apply
// when a NEW document is created). This script backfills totalSeats:40
// for any bus that's missing it.
//
// Run once from the backend folder:
//   node scripts/backfillBusFields.js

const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Bus = require("../models/Bus");

dotenv.config();

async function run() {
  await connectDB();

  const result = await Bus.updateMany(
    { totalSeats: { $exists: false } },
    { $set: { totalSeats: 40 } }
  );

  console.log(
    `Backfilled totalSeats on ${result.modifiedCount} bus(es) that were missing it.`
  );

  console.log(
    "Note: 'date' was left untouched - each bus needs its own date set " +
    "manually via the Edit button in the admin panel, since there's no " +
    "single correct date to backfill for every bus."
  );

  process.exit(0);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
