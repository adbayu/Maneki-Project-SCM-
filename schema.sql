-- =====================================================
-- Modul Perencanaan Menu & Analisis Gizi (AI-Driven)
-- Database: MySQL (mengikuti konvensi dari CONTOH)
-- =====================================================

-- Tabel untuk menyimpan data menu makanan
CREATE TABLE IF NOT EXISTS menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kategori ENUM('Sarapan', 'Makan Siang', 'Makan Malam', 'Snack', 'Minuman') NOT NULL,
  deskripsi TEXT,
  gambar_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan bahan baku per menu
-- Catatan: Modul Master Bahan Baku belum ada.
-- Kolom 'bahan_baku_ref_id' disiapkan untuk relasi future dengan tabel master bahan baku.
-- Saat ini nama bahan baku disimpan sebagai teks sementara.
CREATE TABLE IF NOT EXISTS menu_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  bahan_baku_ref_id INT DEFAULT NULL,
  nama_bahan VARCHAR(255) NOT NULL,
  jumlah DECIMAL(10,2) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel untuk menyimpan data gizi per menu
CREATE TABLE IF NOT EXISTS menu_nutrition (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL UNIQUE,
  kalori DECIMAL(10,2) DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  lemak DECIMAL(10,2) DEFAULT 0,
  karbohidrat DECIMAL(10,2) DEFAULT 0,
  serat DECIMAL(10,2) DEFAULT 0,
  gula DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel untuk menyimpan log rekomendasi AI
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  jenis ENUM('Gizi', 'Bahan', 'Umum') NOT NULL DEFAULT 'Gizi',
  rekomendasi TEXT NOT NULL,
  skor_gizi DECIMAL(5,2) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- =====================================================
-- Mock Data
-- =====================================================

INSERT INTO menus (nama, kategori, deskripsi) VALUES
('Nasi Goreng Ayam Spesial', 'Makan Siang', 'Nasi goreng dengan potongan ayam suwir, telur, dan sayuran segar'),
('Sup Sayur Bening', 'Makan Siang', 'Sup sayuran segar dengan kuah bening bergizi tinggi'),
('Bubur Ayam Kampung', 'Sarapan', 'Bubur nasi lembut dengan topping ayam suwir, cakwe, dan kerupuk'),
('Soto Betawi', 'Makan Siang', 'Soto khas Betawi dengan kuah santan gurih dan daging sapi'),
('Pisang Goreng Keju', 'Snack', 'Pisang raja goreng crispy dengan taburan keju parut');

INSERT INTO menu_ingredients (menu_id, nama_bahan, jumlah, satuan) VALUES
-- Nasi Goreng Ayam
(1, 'Beras', 0.15, 'kg'),
(1, 'Daging Ayam', 0.10, 'kg'),
(1, 'Telur Ayam', 1, 'butir'),
(1, 'Bawang Merah', 0.03, 'kg'),
(1, 'Kecap Manis', 0.02, 'liter'),
-- Sup Sayur Bening
(2, 'Wortel', 0.05, 'kg'),
(2, 'Bayam', 0.05, 'kg'),
(2, 'Jagung Manis', 0.05, 'kg'),
(2, 'Bawang Putih', 0.01, 'kg'),
-- Bubur Ayam
(3, 'Beras', 0.10, 'kg'),
(3, 'Daging Ayam', 0.08, 'kg'),
(3, 'Cakwe', 0.03, 'kg'),
(3, 'Kecap Asin', 0.01, 'liter'),
-- Soto Betawi
(4, 'Daging Sapi', 0.12, 'kg'),
(4, 'Santan', 0.10, 'liter'),
(4, 'Kentang', 0.05, 'kg'),
(4, 'Tomat', 0.03, 'kg'),
-- Pisang Goreng
(5, 'Pisang Raja', 2, 'buah'),
(5, 'Tepung Terigu', 0.05, 'kg'),
(5, 'Keju Parut', 0.03, 'kg');

INSERT INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula) VALUES
(1, 450.00, 22.50, 15.00, 55.00, 2.50, 3.00),
(2, 85.00, 3.00, 1.50, 15.00, 4.50, 5.00),
(3, 320.00, 18.00, 8.00, 45.00, 1.00, 2.00),
(4, 520.00, 28.00, 25.00, 40.00, 3.00, 4.00),
(5, 280.00, 5.00, 12.00, 40.00, 2.00, 18.00);
