const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

// Runs once at server startup. If no Admin document exists yet, creates
// one from the ADMIN_EMAIL / ADMIN_PASSWORD values in .env - this is only
// a one-time bootstrap so existing setups keep working. After this, the
// password lives in MongoDB and .env's ADMIN_PASSWORD is no longer read.
const ensureAdminAccount = async () => {
  const existing = await Admin.findOne();

  if (existing) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "No Admin account found and ADMIN_EMAIL/ADMIN_PASSWORD are not set in .env - admin login will not work until one is created."
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await Admin.create({ email: email.toLowerCase().trim(), password: hashedPassword });

  console.log(`Admin account created for ${email} (from .env, first run only)`);
};

module.exports = ensureAdminAccount;
