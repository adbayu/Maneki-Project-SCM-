# Setup Google Gemini API Key

Panduan untuk men-setup Google Generative AI (Gemini) API key.

## Langkah 1: Membuat Akun Google Cloud

1. Buka https://console.cloud.google.com/
2. Login dengan akun Google Anda
3. Buat project baru atau gunakan project yang sudah ada

## Langkah 2: Aktifkan Generative Language API

1. Di Google Cloud Console, pergi ke **APIs & Services** → **Library**
2. Cari **"Generative Language API"**
3. Klik dan tekan tombol **"ENABLE"**

## Langkah 3: Buat API Key

1. Pergi ke **APIs & Services** → **Credentials**
2. Klik **"Create Credentials"** → **"API Key"**
3. Copy API key yang telah dibuat

## Langkah 4: Konfigurasi di Backend

1. Buka file `.env` di folder `backend/`
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
2. Ganti `your_api_key_here` dengan API key yang telah Anda buat
3. Simpan file

## Langkah 5: Restart Backend

```bash
cd backend
npm install  # jika belum install dependencies
npm start
```

## Troubleshooting

### Error: "API key expired"

- Google API key mungkin memiliki batasan waktu penggunaan
- Solusi: Buat API key baru di Google Cloud Console
- Update file `.env` dengan API key yang baru

### Error: "API_KEY_INVALID" atau "permission denied"

- API key mungkin tidak valid atau akses ditolak
- Pastikan Generative Language API sudah di-enable
- Coba buat API key baru

### Error: "Network error" atau "ENOTFOUND"

- Koneksi internet bermasalah atau Gemini API sedang down
- Sistem akan otomatis fallback ke rule-based analysis
- Coba lagi dalam beberapa detik

### Error: "Quota exceeded" atau "429 Too Many Requests"

- Terlalu banyak request ke Gemini API
- Tunggu beberapa menit sebelum mencoba lagi
- Tingkatkan quota di Google Cloud Console jika perlu

## Verifikasi Setup

Untuk memastikan API key sudah bekerja:

1. Di backend, buka terminal dan jalankan:

   ```bash
   node -e "const key = process.env.GEMINI_API_KEY; console.log(key ? '✅ API Key loaded' : '❌ API Key not found')"
   ```

2. Atau buat test file `test-gemini.js` di backend:

   ```javascript
   const { GoogleGenerativeAI } = require("@google/generative-ai");
   const apiKey = process.env.GEMINI_API_KEY;

   if (!apiKey) {
     console.error("❌ API Key tidak ditemukan");
     process.exit(1);
   }

   const genAI = new GoogleGenerativeAI(apiKey);
   const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

   model
     .generateContent("Halo, ini test!")
     .then(() => console.log("✅ Gemini API connected successfully"))
     .catch((err) => console.error("❌ Error:", err.message));
   ```

3. Jalankan dengan: `node test-gemini.js`

## Biaya & Quota

- Google Gemini API memiliki **free tier** dengan quota harian
- Untuk unlimited usage, perlu upgrade ke billing plan
- Check usage di Google Cloud Console → **Billing** → **Reports**

## Dokumentasi Resmi

- Google Generative AI: https://ai.google.dev/
- API Documentation: https://ai.google.dev/tutorials/node_quickstart
- Gemini 2.0 Flash: https://ai.google.dev/models/gemini2-flash
