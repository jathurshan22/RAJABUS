const express = require("express");
const Contact = require("../models/Contact");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Contact route working" });
});

router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required",
      });
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim(),
      subject: (subject || "").trim(),
      message: message.trim(),
    });

    await sendEmail({
      subject: `New Contact Message - ${subject || "Raja Bus"}`,
      html: `
        <h2>New Contact Message</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Subject:</b> ${subject || "-"}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: "Message saved and email alert sent successfully",
      contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load messages",
      error: error.message,
    });
  }
});

module.exports = router;