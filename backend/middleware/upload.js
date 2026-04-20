const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Buat direktori uploads jika belum ada
const uploadsDir = path.join(__dirname, "../uploads/menu-images");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Konfigurasi storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Format: menu-{timestamp}-{random}.ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "menu-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter file - hanya accept image
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.",
      ),
      false,
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

module.exports = upload;
