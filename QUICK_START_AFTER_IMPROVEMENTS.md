# 🚀 Quick Start Guide - After Improvements

## ⚙️ Step 1: Setup Gemini API Key (PENTING)

### Opsi A: Menggunakan API Key yang Sudah Ada (Update)

Jika API key Anda sudah expired:

1. **Buat API key baru**:
   - Buka: https://aistudio.google.com/app/apikeys
   - Klik "Create API Key"
   - Copy API key yang baru

2. **Update file `.env` di backend**:

   ```bash
   cd backend
   ```

   Edit file `.env` (atau buat jika belum ada):

   ```
   GEMINI_API_KEY=your_new_api_key_here
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=maneki_scm
   PORT=3002
   ```

3. **Verifikasi API key**:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.GEMINI_API_KEY ? '✅ API Key loaded' : '❌ API Key not found')"
   ```

---

## 📦 Step 2: Install Dependencies (jika belum)

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## ▶️ Step 3: Jalankan Aplikasi

### Terminal 1 - Backend Server

```bash
cd backend
npm start
```

Output yang diharapkan:

```
Database connected successfully
Menu Planning backend is running on http://localhost:3002
```

### Terminal 2 - Frontend Development Server

```bash
cd frontend
npm run dev
```

Output yang diharapkan:

```
  VITE v... ready in ... ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Buka browser: http://localhost:5173/

---

## 🧪 Step 4: Test Fitur-Fitur Baru

### Test 1: Menu Analysis (Gemini AI)

1. Buka **Menu List** atau **Menu Catalog**
2. Klik tombol **Analisis** (icon 🧠) pada menu apapun
3. **Expected**: Muncul rekomendasi AI dari Gemini
4. **Jika error**: Check console untuk error details - system akan auto-fallback ke rule-based

### Test 2: Upload Gambar Menu

1. Di **Menu Form**, klik edit menu yang sudah ada
2. Scroll ke section **"Gambar Menu"**
3. Upload foto (JPG, PNG, WebP, GIF - Max 5MB)
4. Klik **"Upload Gambar"**
5. Refresh page - gambar akan muncul di menu list thumbnail

### Test 3: Dashboard Statistics

1. Buka **Dashboard**
2. Lihat card **"Analisis Nutrisi"**
3. Klik salah satu metric button (Kalori, Protein, Lemak, Karbo)
4. **Expected**: Progress bar dan statistik berubah sesuai metric yang dipilih
5. Lihat **"Distribusi Menu per Kategori"** - harusnya ada chart

---

## 🐛 Troubleshooting

### Error: "API key expired"

```
❌ [Gemini AI] API key expired atau tidak valid.
   Silakan renew API key di Google Cloud Console.
```

**Solusi**:

- Buat API key baru di https://aistudio.google.com/app/apikeys
- Update file `.env`
- Restart backend

### Error: "Network error"

```
⚠️ [Gemini AI] Gagal terhubung ke Gemini API (network error).
   Menggunakan fallback rule-based.
```

**Solusi**:

- Check internet connection
- Wait a few seconds - sistem akan auto-retry 3 kali
- Fallback ke rule-based analysis akan otomatis digunakan
- Cek log backend untuk details

### Error: "Image upload failed"

```
❌ Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.
```

**Solusi**:

- Pastikan file berformat JPG, PNG, WebP, atau GIF
- File size maksimal 5MB
- Jika masih error, check permissions di folder `backend/uploads/menu-images/`

### Image tidak muncul di menu list

**Solusi**:

- Refresh page (Ctrl+F5)
- Check console untuk error messages
- Pastikan backend running dan `/uploads` static folder accessible

---

## 📊 Dashboard Features

### Nutrient Analysis Cards

- **Kalori**: Energy content (target: 500 kkal)
- **Protein**: untuk pertumbuhan (target: 25g)
- **Lemak**: essential nutrients (target: 20g)
- **Karbohidrat**: energy source (target: 70g)

### Status Indicators

- ✅ **Green**: 90-110% of target (optimal)
- ⚠️ **Yellow**: <90% of target (below target)
- ❌ **Red**: >110% of target (exceeds target)

### Category Distribution

Menunjukkan breakdown menu per kategori:

- Siswa
- Balita
- Ibu Hamil
- Porsi Besar
- Porsi Kecil

---

## 🛠️ Development Commands

### Backend

```bash
cd backend
npm start          # Start development server
npm run dev        # With nodemon (auto-restart)
npm test           # Run tests (jika ada)
```

### Frontend

```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Check code style
```

---

## 📝 Files Berubah

### Backend

- `backend/services/aiNutritionService.js` - Better error handling
- `backend/routes/menu.js` - Image upload endpoints
- `backend/server.js` - Static file serving
- `backend/middleware/upload.js` - Multer config (NEW)
- `backend/utils/retryHelper.js` - Retry logic (NEW)

### Frontend

- `frontend/src/components/DashboardStats.tsx` - Enhanced UI
- `frontend/src/components/MenuList.tsx` - Image display
- `frontend/src/components/MenuForm.tsx` - Image upload

---

## 📚 Dokumentasi

- **SETUP_API_KEY.md** - Lengkap guide untuk setup Gemini API
- **IMPROVEMENTS_SUMMARY.md** - Detail semua perubahan dan fitur baru
- **README.md** (original) - Project overview

---

## ✅ Checklist Sebelum Mulai

- [ ] API key sudah dibuat dan di-update di `.env`
- [ ] Backend dependencies installed (`npm install` di backend/)
- [ ] Frontend dependencies installed (`npm install` di frontend/)
- [ ] Database sudah ter-setup (check dengan `npm start` di backend)
- [ ] Port 3002 (backend) dan 5173 (frontend) tidak terpakai

---

## 🎉 Selesai!

Aplikasi sudah siap dengan:

- ✅ Gemini AI integration dengan error handling
- ✅ Automatic retry untuk network issues
- ✅ Image upload & display
- ✅ Enhanced dashboard dengan interaktif UI
- ✅ Fallback ke rule-based jika AI gagal

Enjoy! 🚀
