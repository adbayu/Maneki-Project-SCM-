const express = require("express");
const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME || "admin";
  const validPass = process.env.ADMIN_PASSWORD || "admin123";

  if (username === validUser && password === validPass) {
    return res.json({
      success: true,
      user: { username, role: "admin", nama: "Admin" },
      token: Buffer.from(`${username}:${Date.now()}`).toString("base64"),
    });
  }
  return res.status(401).json({ error: "Username atau password salah" });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logout berhasil" });
});

module.exports = router;
