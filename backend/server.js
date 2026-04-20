const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const menuRoutes = require("./routes/menu");
const authRoutes = require("./routes/auth");
const financialRoutes = require("./routes/financial");

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/financial", financialRoutes);

// Basic healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "OK", module: "Menu Planning & Analisis Gizi" });
});

// Setup DB connection listener
const db = require("./db");
db.getConnection()
  .then((conn) => {
    console.log("Database connected successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err.message);
  });

app.listen(PORT, () => {
  console.log(`Menu Planning backend is running on http://localhost:${PORT}`);
});
