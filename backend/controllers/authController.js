const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Admin = require("../models/Admin");
const sendEmail = require("../utils/sendEmail");

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

// Raw token is e-mailed to the user (one-time use, expires in 24h).
// Only its SHA-256 hash is stored in the DB - same pattern as a password
// reset token, so a DB leak alone can't be used to verify arbitrary accounts.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";

const sendVerificationEmail = async (user, rawToken) => {
  const verifyLink = `${FRONTEND_URL}/verify-email.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your Raja Bus account",
    html: `
      <h2>Welcome to Raja Bus, ${user.fullName}!</h2>
      <p>Please verify your email address to activate your account.</p>
      <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:#f26522;color:#fff;text-decoration:none;border-radius:8px;">Verify My Email</a></p>
      <p>Or copy this link into your browser:</p>
      <p>${verifyLink}</p>
      <p>This link expires in 24 hours.</p>
    `,
  });
};

// REGISTER
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const rawToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      isVerified: false,
      verificationToken: hashToken(rawToken),
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h
    });

    let emailSent = true;
    try {
      await sendVerificationEmail(user, rawToken);
    } catch (emailError) {
      // Don't fail registration just because the email couldn't be sent -
      // the user can request it again later. Just let the frontend know.
      emailSent = false;
      console.error("Failed to send verification email:", emailError.message);
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? "Registration successful. Please check your email to verify your account."
        : "Registration successful, but the verification email could not be sent. Please contact support.",
      userId: user._id,
      emailSent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// VERIFY EMAIL
const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification link",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified. You can log in.",
        alreadyVerified: true,
      });
    }

    if (
      !user.verificationToken ||
      user.verificationToken !== hashToken(token) ||
      !user.verificationTokenExpires ||
      user.verificationTokenExpires < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "This verification link is invalid or has expired.",
      });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// RESEND VERIFICATION EMAIL
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Same response whether or not the account exists, so this endpoint
    // can't be used to check which emails are registered.
    const genericResponse = {
      success: true,
      message: "If that account exists and isn't verified yet, a new verification email has been sent.",
    };

    if (!user || user.isVerified) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = hashToken(rawToken);
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user, rawToken);

    res.json(genericResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
        needsVerification: true,
      });
    }

    const token = generateToken({ id: user._id, email: user.email, role: "user" });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ADMIN LOGIN — credentials are checked against the Admin collection in
// MongoDB (see backend/config/ensureAdminAccount.js). Issues a JWT with role "admin".
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
      });
    }

    const token = generateToken({ id: admin._id, email: admin.email, role: "admin" });

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: { email: admin.email },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ADMIN CHANGE PASSWORD — requires a valid admin JWT (see protect+adminOnly
// middleware on the route). Verifies the current password before updating.
const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const admin = await Admin.findOne({ email: req.user.email });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({
      success: true,
      message: "Admin password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.password);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE PROFILE (name + phone)
const updateProfile = async (req, res) => {
  try {
    const { email, fullName, phone } = req.body;

    if (!email || !fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { fullName, phone },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  adminLogin,
  changeAdminPassword,
  changePassword,
  updateProfile,
};
