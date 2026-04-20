# Catatan Analisa & Implementasi Fitur AI

## Status Terkini

Fitur AI **sudah menggunakan Google Gemini AI API** (`gemini-1.5-flash`).

---

## Perubahan yang Dilakukan

### Sebelumnya: Rule-Based AI (Hardcoded)
- Rekomendasi diambil secara acak dari kamus `REKOMENDASI_RULES` yang sudah di-*hardcode*
- Tidak ada pemanggilan ke layanan AI eksternal
- Respons bersifat statis dan terbatas

### Sekarang: Google Gemini AI API
- Rekomendasi dihasilkan oleh model **`gemini-1.5-flash`** secara generatif
- Menggunakan package `@google/generative-ai` (v0.24.x)
- API Key dikonfigurasi melalui environment variable `GEMINI_API_KEY` di file `.env`
- Respons lebih natural, kontekstual, dan menyebutkan bahan makanan lokal Indonesia

---

## Arsitektur Implementasi Baru

```
POST /api/menu/:id/analyze
        │
        ▼
routes/menu.js
  └─ await aiService.analyzeNutrition(nutrition, menu.nama)
              │
              ▼
services/aiNutritionService.js
  ├─ [1] computeNutrientAnalysis()   ← Hitung skor matematis (deterministik)
  ├─ [2] callGeminiAPI()             ← Panggil Gemini AI untuk rekomendasi
  │       └─ buildPrompt()           ← Bangun prompt kontekstual
  └─ [3] Fallback: getRuleBasedRecommendations()   ← Jika Gemini gagal
```

---

## Detail Implementasi

### 1. Perhitungan Skor (Deterministik)
Tetap menggunakan logika matematis untuk menghitung:
- Status per nutrisi: `optimal` / `rendah` / `berlebih`
- Skor per nutrisi (0–100)
- Skor gizi keseluruhan (0–100)
- Status keseluruhan: `Baik` / `Cukup` / `Perlu Perbaikan`

Referensi standar: **AKG Kemenkes RI per porsi makan**.

### 2. Rekomendasi via Gemini AI
- Prompt dirancang khusus untuk konteks **MBG (Makan Bergizi Gratis) Indonesia**
- Gemini menghasilkan `message` (evaluasi umum) dan array `recommendations`
- Struktur respons JSON dari Gemini dinormalisasi agar kompatibel dengan frontend
- Model: `gemini-1.5-flash` dengan `temperature: 0.7`

### 3. Fallback Rule-Based
Jika Gemini API gagal (tidak ada API key, rate limit, network error, dll):
- Sistem otomatis fallback ke `getRuleBasedRecommendations()`
- Log warning ditampilkan di console: `⚠️ [Gemini AI] Gagal (...)`
- Frontend tetap mendapat respons valid tanpa error

---

## Konfigurasi yang Diperlukan

Tambahkan ke file `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Dapatkan API Key gratis di: **https://aistudio.google.com/app/apikey**

---

## Kompatibilitas Frontend

Struktur respons API **tidak berubah** — frontend (`AIAnalysisPanel.tsx`) tidak perlu dimodifikasi:

| Field             | Tipe                     | Keterangan                            |
|-------------------|--------------------------|---------------------------------------|
| `menu_nama`       | `string`                 | Nama menu yang dianalisis             |
| `skor_gizi`       | `number` (0–100)         | Skor gizi keseluruhan (matematis)     |
| `status`          | `string`                 | Baik / Cukup / Perlu Perbaikan        |
| `pesan`           | `string`                 | Evaluasi umum oleh Gemini             |
| `detail_analisis` | `Record<string, Object>` | Breakdown per nutrisi                 |
| `rekomendasi`     | `Array<Object>`          | Rekomendasi dihasilkan oleh Gemini    |
| `standar_referensi` | `string`               | Mencantumkan "Powered by Gemini AI"   |
| `analyzed_at`     | `string` (ISO 8601)      | Timestamp analisis                    |

---

## Dependencies Baru

| Package                  | Versi   | Kegunaan                  |
|--------------------------|---------|---------------------------|
| `@google/generative-ai`  | ^0.24.1 | SDK resmi Google Gemini   |
