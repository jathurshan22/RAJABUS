const express = require("express");

const {
  register,
  login,
  adminLogin,
  changeAdminPassword,
  changePassword,
  updateProfile,
} = require("../controllers/authController");

const {
  protect,
  adminOnly,
} = require("../middleware/auth");

const {
  loginLimiter,
  adminLoginLimiter,
  registerLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();


// ======================================================
// TEST
// GET /api/auth/test
// ======================================================

router.get("/test", (req, res) => {
  res.json({
    message: "Auth Route Working",
  });
});


// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

router.post(
  "/register",
  registerLimiter,
  register
);


// ======================================================
// USER LOGIN
// POST /api/auth/login
// ======================================================

router.post(
  "/login",
  loginLimiter,
  login
);


// ======================================================
// ADMIN LOGIN
// POST /api/auth/admin-login
// ======================================================

router.post(
  "/admin-login",
  adminLoginLimiter,
  adminLogin
);


// ======================================================
// ADMIN CHANGE PASSWORD
// PUT /api/auth/admin-change-password
// ======================================================

router.put(
  "/admin-change-password",
  protect,
  adminOnly,
  changeAdminPassword
);


// ======================================================
// USER CHANGE PASSWORD
// PUT /api/auth/change-password
// ======================================================

router.put(
  "/change-password",
  changePassword
);


// ======================================================
// UPDATE PROFILE
// PUT /api/auth/update-profile
// ======================================================

router.put(
  "/update-profile",
  updateProfile
);


module.exports = router;