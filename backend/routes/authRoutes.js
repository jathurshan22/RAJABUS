const express = require("express");
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  adminLogin,
  changeAdminPassword,
  changePassword,
  updateProfile,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");
const { loginLimiter, adminLoginLimiter, registerLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Auth Route Working" });
});

// REGISTER
router.post("/register", registerLimiter, register);

// EMAIL VERIFICATION
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// LOGIN
router.post("/login", loginLimiter, login);

// ADMIN LOGIN
router.post("/admin-login", adminLoginLimiter, adminLogin);

// ADMIN CHANGE PASSWORD (requires a valid admin JWT)
router.put("/admin-change-password", protect, adminOnly, changeAdminPassword);

// CHANGE PASSWORD
router.put("/change-password", changePassword);

// UPDATE PROFILE (name + phone)
router.put("/update-profile", updateProfile);

module.exports = router;
