
"use strict";

require("dotenv").config();

const mongoose = require("mongoose");

const User = require("../models/User");

const {
  Counter,
  getNextSequence
} = require("../models/Counter");

const COUNTER_NAME = "registeredUser";

const apply = process.argv.includes("--apply");

async function main() {

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not found");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({})
    .select("_id userCode createdAt")
    .sort({
      createdAt: 1,
      _id: 1
    })
    .lean();

  // Find the highest existing RBU number.

  let highest = 0;

  const assigned = new Set();

  for (const user of users) {

    if (!user.userCode) continue;

    const match = /^RBU(\d{4,})$/.exec(
      user.userCode
    );

    if (!match) {
      throw new Error(
        `Invalid userCode: ${user.userCode}`
      );
    }

    if (assigned.has(user.userCode)) {
      throw new Error(
        `Duplicate ID: ${user.userCode}`
      );
    }

    assigned.add(user.userCode);

    highest = Math.max(
      highest,
      Number(match[1])
    );
  }

  const currentCounter = await Counter.findOne({
    name: COUNTER_NAME
  }).lean();

  const startingNumber = Math.max(
    highest,
    Number(currentCounter?.value || 0)
  );

  const missing = users.filter(
    (user) => !user.userCode
  );

  console.log("Total users:", users.length);
  console.log("Users needing IDs:", missing.length);
  console.log("Starting number:", startingNumber);
  console.log("Mode:", apply ? "APPLY" : "DRY RUN");

  if (!apply) {

    missing.slice(0, 10).forEach(
      (user, index) => {

        const number =
          startingNumber + index + 1;

        const code =
          `RBU${String(number).padStart(4, "0")}`;

        console.log(
          String(user._id),
          "->",
          code
        );

      }
    );

    console.log("No database changes made");
    return;
  }

  // Create the unique index.

  await User.collection.createIndex(
    { userCode: 1 },
    {
      unique: true,
      sparse: true
    }
  );

  // Reserve previously used ID numbers.

  await Counter.findOneAndUpdate(
    { name: COUNTER_NAME },
    {
      $setOnInsert: {
        value: startingNumber
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  await Counter.updateOne(
    { name: COUNTER_NAME },
    {
      $max: {
        value: startingNumber
      }
    }
  );

  // Assign IDs to old users.

  for (const user of missing) {

    const number =
      await getNextSequence(COUNTER_NAME);

    const userCode =
      `RBU${String(number).padStart(4, "0")}`;

    const result = await User.updateOne(
      {
        _id: user._id,
        $or: [
          { userCode: { $exists: false } },
          { userCode: null },
          { userCode: "" }
        ]
      },
      {
        $set: { userCode }
      }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Failed to assign ${userCode}`
      );
    }

    console.log("Assigned:", userCode);
  }

  console.log("User ID migration completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
