# Maneki-Project-SCM-
Modul Perencanaan Menu & Analisis Gizi adalah komponen inti dari platform Supply Chain Management (SCM) MBG. Modul ini dirancang untuk membantu Manajer Produksi dalam menyusun menu makanan harian yang tidak hanya efisien secara logistik, tetapi juga optimal secara nutrisi menggunakan teknologi AI.

Modul ini beroperasi dalam arsitektur Multi-frontend & Microservices, memastikan skalabilitas tinggi dan integrasi mulus dengan modul Manajemen Produksi & Multi Dapur.

✨ Fitur Utama
🥗 Kelola Data Menu Dinamis: CRUD data menu lengkap dengan deskripsi, kategori, dan detail foto.

🌾 Manajemen Bahan Baku Per Menu: Input komposisi bahan baku (nama & takaran) yang terhubung dengan perencanaan produksi.

📊 Analisis Gizi Otomatis: Perhitungan otomatis Kalori, Protein, Lemak, dan Karbohidrat berdasarkan komposisi bahan.

🤖 AI Recommendation Engine: Rekomendasi cerdas dari AI untuk penyesuaian menu (misal: saran penambahan protein atau pengurangan lemak) agar memenuhi standar gizi.

🔗 Seamless Integration: Data menu yang telah divalidasi gizinya siap dikonsumsi oleh modul Daily Cooking Planning.

🛠️ Tech Stack
Backend: Node.js & Express JS (JavaScript)

Frontend: React / Next.js (TypeScript - TSX)

Database: SQL (Structured Query Language)

AI Integration: LLM (Large Language Model) API via Service Layer

Architecture: Microservices Pattern

🚀 Alur Integrasi (System Flow)
Input: Manajer Produksi memasukkan detail menu dan daftar bahan baku.

Process: Backend mengirimkan data ke AI Service untuk dianalisis profil gizinya.

Insight: AI memberikan feedback rekomendasi perbaikan komposisi jika diperlukan.

Output: Menu yang sudah "Final" akan muncul secara otomatis sebagai opsi di modul Manajemen Produksi untuk jadwal masak harian.

🛠 Instalasi
Clone repositori:

Bash
git clone https://github.com/username/scm-mbg-nutrition-module.git
Setup Backend:

Bash
cd backend && npm install
Setup Frontend:

Bash
cd frontend && npm install
Konfigurasi Environment:
Buat file .env dan masukkan kredensial database SQL serta API Key untuk AI Service.
