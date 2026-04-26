// Helper: Ekstrak blok JSON dari teks Gemini (mengatasi markdown, komentar, dsb)
function extractJsonFromText(text) {
  // Bersihkan markdown code fence
  let cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .replace(/^[^\{]*?\{/s, "{") // hapus apapun sebelum '{'
    .replace(/\}[^\}]*?$/, "}") // hapus apapun setelah '}' terakhir
    .trim();

  // Jika sudah valid JSON, langsung parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Cari blok JSON dengan regex (ambil {...} terbesar)
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // Gagal, lempar error
  throw new Error("Respons Gemini tidak bisa di-parse sebagai JSON");
}
/**
 * AI Nutrition Analysis Service
 * Modul analisis gizi menggunakan Google Gemini AI API
 * Menggantikan sistem rule-based dengan AI generatif yang lebih cerdas dan dinamis
 *
 * Struktur respons dipertahankan agar kompatibel dengan frontend yang sudah ada.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { retryWithBackoff } = require("../utils/retryHelper");

// Standar AKG per porsi dipisahkan berdasarkan profil menu
const STANDAR_GIZI_PROFILES = {
  makanan: {
    kalori: { min: 300, max: 700, unit: "kkal", label: "Kalori" },
    protein: { min: 15, max: 40, unit: "g", label: "Protein" },
    lemak: { min: 10, max: 25, unit: "g", label: "Lemak" },
    karbohidrat: { min: 40, max: 80, unit: "g", label: "Karbohidrat" },
    serat: { min: 3, max: 10, unit: "g", label: "Serat" },
    gula: { min: 0, max: 15, unit: "g", label: "Gula" },
  },
  minuman: {
    kalori: { min: 80, max: 220, unit: "kkal", label: "Kalori" },
    protein: { min: 2, max: 12, unit: "g", label: "Protein" },
    lemak: { min: 0, max: 8, unit: "g", label: "Lemak" },
    karbohidrat: { min: 8, max: 30, unit: "g", label: "Karbohidrat" },
    serat: { min: 0, max: 5, unit: "g", label: "Serat" },
    gula: { min: 0, max: 10, unit: "g", label: "Gula" },
  },
};

// Backward compatibility untuk import lama
const STANDAR_GIZI = STANDAR_GIZI_PROFILES.makanan;

function detectNutritionProfile(namaMenu, menuContext = {}) {
  const explicitType = String(menuContext.menuType || "").toLowerCase();
  const kategori = String(menuContext.kategori || "").toLowerCase();
  const text = `${namaMenu || ""} ${menuContext.deskripsi || ""}`.toLowerCase();

  if (explicitType === "minuman") return "minuman";

  const drinkFlags = [
    "minuman",
    "drink",
    "jus",
    "susu",
    "teh",
    "kopi",
    "smoothie",
    "sirup",
    "es ",
    "wedang",
    "infused",
  ];

  if (drinkFlags.some((flag) => kategori.includes(flag))) return "minuman";
  if (drinkFlags.some((flag) => text.includes(flag))) return "minuman";

  return "makanan";
}

// ============================================================
// STEP 1: Hitung skor gizi secara matematis (deterministik)
// ============================================================

/**
 * Menghitung analisis per-nutrisi dan skor keseluruhan secara matematis.
 * @param {Object} nutrition
 * @param {Object} standarGizi
 * @returns {{ analysis, overallScore, overallStatus, nutrientIssues }}
 */
function computeNutrientAnalysis(nutrition, standarGizi) {
  const analysis = {};
  const nutrientIssues = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const [nutrient, standard] of Object.entries(standarGizi)) {
    const value = Number(nutrition[nutrient] || 0);
    let status = "optimal";
    let score = 100;

    if (value < standard.min) {
      status = "rendah";
      score = standard.min > 0 ? Math.round((value / standard.min) * 100) : 100;

      nutrientIssues.push({
        key: nutrient,
        label: standard.label,
        status: "rendah",
        value,
        unit: standard.unit,
        standar: `min ${standard.min} ${standard.unit}`,
      });
    } else if (value > standard.max) {
      status = "berlebih";
      score =
        standard.max > 0
          ? Math.max(
              0,
              Math.round(100 - ((value - standard.max) / standard.max) * 100),
            )
          : 0;

      nutrientIssues.push({
        key: nutrient,
        label: standard.label,
        status: "berlebih",
        value,
        unit: standard.unit,
        standar: `max ${standard.max} ${standard.unit}`,
      });
    }

    analysis[nutrient] = {
      label: standard.label,
      value,
      unit: standard.unit,
      min: standard.min,
      max: standard.max,
      status,
      score: Math.max(0, Math.min(100, score)),
    };

    totalScore += Math.max(0, Math.min(100, score));
    maxScore += 100;
  }

  const overallScore = Math.round((totalScore / maxScore) * 100);
  let overallStatus = "Baik";
  if (overallScore < 50) overallStatus = "Perlu Perbaikan";
  else if (overallScore < 75) overallStatus = "Cukup";

  return { analysis, overallScore, overallStatus, nutrientIssues };
}

// ============================================================
// STEP 2: Generasi rekomendasi via Gemini AI
// ============================================================

/**
 * Membangun teks prompt untuk Gemini berdasarkan data gizi dan isu yang terdeteksi.
 */
function buildPrompt(
  namaMenu,
  nutrition,
  nutrientIssues,
  overallScore,
  overallStatus,
  standarGizi,
  nutritionProfile,
) {
  const nutritionLines = Object.entries(standarGizi)
    .map(
      ([nutrient, standard]) =>
        `  - ${standard.label.padEnd(11, " ")} : ${nutrition[nutrient] || 0} ${standard.unit} (standar: ${standard.min}–${standard.max} ${standard.unit})`,
    )
    .join("\n");

  const issuesText =
    nutrientIssues.length > 0
      ? nutrientIssues
          .map(
            (i) =>
              `  - ${i.label}: ${i.value} ${i.unit} → ${i.status} (standar: ${i.standar})`,
          )
          .join("\n")
      : "  - Semua nilai gizi berada dalam batas normal.";

  return `Kamu adalah ahli gizi profesional untuk program MBG (Makan Bergizi Gratis) Indonesia. Tugasmu adalah menganalisis komposisi gizi sebuah menu dan memberikan rekomendasi perbaikan yang spesifik, praktis, dan berbasis bahan makanan lokal Indonesia.

DATA MENU
---------
Nama Menu   : "${namaMenu}"
Profil Menu : ${nutritionProfile === "minuman" ? "Minuman" : "Makanan"}
Skor Gizi   : ${overallScore}/100 (${overallStatus})

Nilai Gizi per Porsi:
${nutritionLines}

Masalah Gizi yang Terdeteksi:
${issuesText}

INSTRUKSI OUTPUT
----------------
Balas HANYA dengan satu objek JSON valid (tanpa markdown code block, tanpa teks di luar JSON):

{
  "message": "<Evaluasi keseluruhan menu dalam 1–2 kalimat yang informatif, menyebutkan nama menu>",
  "recommendations": [
    {
      "jenis": "Gizi",
      "nutrient": "<label nutrisi bermasalah, atau null jika rekomendasi bersifat umum>",
      "severity": "<'warning' | 'danger' | 'success'>",
      "pesan": "[<Label Nutrisi>] <Rekomendasi spesifik dan actionable>",
      "detail": "<Detail nilai saat ini vs standar, atau null>"
    }
  ]
}

ATURAN PENGISIAN:
- "severity" → "warning" jika nilai rendah, "danger" jika nilai berlebih, "success" jika semua optimal.
- Jika semua nutrisi optimal, berikan tepat 1 rekomendasi dengan severity "success".
- Rekomendasi harus menyebutkan nama bahan makanan Indonesia yang konkret (misal: tempe, tahu, ikan lele, kangkung, bayam, ubi, singkong, dll).
- Setiap rekomendasi harus berkaitan dengan satu masalah gizi spesifik.
- Maksimal 6 rekomendasi.
- Gunakan bahasa Indonesia yang natural, jelas, dan mudah dipahami masyarakat umum.
- Jangan tambahkan teks, catatan, atau penjelasan di luar JSON.`;
}

/**
 * Memanggil Gemini API dan mem-parse hasilnya menjadi { message, recommendations }.
 * Dengan retry logic untuk mengatasi network errors dan temporary failures.
 * @throws {Error} jika API key tidak ada, request gagal, atau JSON tidak valid.
 */
async function callGeminiAPI(
  namaMenu,
  nutrition,
  nutrientIssues,
  overallScore,
  overallStatus,
  standarGizi,
  nutritionProfile,
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di file .env");
  }

  // Validasi format API key minimal
  if (apiKey.length < 20) {
    throw new Error(
      "GEMINI_API_KEY tampak tidak valid (terlalu pendek). Periksa kembali di file .env",
    );
  }

  const prompt = buildPrompt(
    namaMenu,
    nutrition,
    nutrientIssues,
    overallScore,
    overallStatus,
    standarGizi,
    nutritionProfile,
  );

  // Hanya 1 percobaan, tanpa retry
  const result = await retryWithBackoff(
    async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 1024,
        },
      });

      try {
        const response = await model.generateContent(prompt);
        return response.response.text().trim();
      } catch (err) {
        // Re-throw dengan konteks yang lebih jelas
        const msg = err.message || "";

        // Parse error message untuk error handling yang lebih baik
        if (
          msg.includes("400") ||
          msg.includes("API_KEY_INVALID") ||
          msg.includes("API key expired")
        ) {
          const error = new Error(
            "API key expired atau tidak valid. Silakan renew API key di Google Cloud Console.",
          );
          error.code = "API_KEY_EXPIRED";
          throw error;
        }

        if (msg.includes("401") || msg.includes("PERMISSION_DENIED")) {
          const error = new Error(
            "Permission denied. Pastikan Generative Language API sudah diaktifkan.",
          );
          error.code = "PERMISSION_DENIED";
          throw error;
        }

        // Re-throw original error untuk dihandle oleh retry logic
        throw err;
      }
    },
    {
      maxRetries: 0, // hanya 1 percobaan, tanpa retry
      initialDelay: 1500,
      backoffMultiplier: 2,
      name: `Gemini API (${namaMenu})`,
    },
  );

  // Ekstrak blok JSON toleran dari respons Gemini
  const parsed = extractJsonFromText(result);

  if (!parsed.message || !Array.isArray(parsed.recommendations)) {
    throw new Error(
      "Respons Gemini tidak memiliki struktur yang diharapkan (message / recommendations)",
    );
  }

  // Normalisasi severity agar selalu valid
  const validSeverities = new Set(["success", "warning", "danger"]);
  const recommendations = parsed.recommendations.map((rec) => ({
    jenis: rec.jenis || "Gizi",
    nutrient: rec.nutrient || null,
    severity: validSeverities.has(rec.severity) ? rec.severity : "warning",
    pesan: rec.pesan || "",
    detail: rec.detail || null,
  }));

  return { message: parsed.message, recommendations };
}

// ============================================================
// STEP 3: Fallback rule-based (digunakan saat Gemini gagal)
// ============================================================

const FALLBACK_RULES = {
  makanan: {
    Kalori: {
      rendah:
        "Kalori terlalu rendah. Tambahkan lauk pauk bergizi atau sumber kalori sehat seperti nasi merah atau ubi.",
      berlebih:
        "Kalori terlalu tinggi. Kurangi porsi nasi atau ganti bahan tinggi kalori dengan sayuran segar.",
    },
    Protein: {
      rendah:
        "Protein terlalu rendah. Tambahkan tempe, tahu, ikan, atau telur rebus sebagai sumber protein terjangkau.",
      berlebih:
        "Protein berlebih. Seimbangkan dengan memperbanyak sayuran dan mengurangi porsi lauk hewani.",
    },
    Lemak: {
      rendah:
        "Lemak terlalu rendah. Tambahkan sedikit minyak kelapa atau alpukat sebagai sumber lemak sehat.",
      berlebih:
        "Lemak terlalu tinggi. Kurangi penggunaan santan atau minyak goreng; coba metode kukus atau rebus.",
    },
    Karbohidrat: {
      rendah:
        "Karbohidrat rendah. Tambahkan nasi, jagung, singkong, atau kentang untuk mencukupi kebutuhan energi.",
      berlebih:
        "Karbohidrat berlebih. Kurangi porsi nasi dan ganti sebagian dengan sayuran hijau yang kaya serat.",
    },
    Serat: {
      rendah:
        "Serat sangat rendah. Tambahkan sayuran seperti bayam, kangkung, atau kacang panjang untuk meningkatkan serat.",
      berlebih:
        "Kandungan serat sangat tinggi dan mendukung kesehatan pencernaan. Pertahankan!",
    },
    Gula: {
      rendah: null,
      berlebih:
        "Kandungan gula terlalu tinggi. Kurangi penggunaan gula pasir dan kecap manis; manfaatkan rempah alami sebagai pengganti rasa.",
    },
  },
  minuman: {
    Kalori: {
      rendah:
        "Kalori minuman terlalu rendah. Tambahkan bahan bernutrisi seperti susu UHT, oat, atau pisang agar energi lebih cukup.",
      berlebih:
        "Kalori minuman terlalu tinggi. Kurangi pemanis dan bahan berkalori padat, lalu tingkatkan proporsi air atau es batu.",
    },
    Protein: {
      rendah:
        "Protein minuman rendah. Tambahkan susu, yoghurt plain, atau kedelai untuk meningkatkan kandungan protein.",
      berlebih:
        "Protein minuman terlalu tinggi untuk porsi ini. Seimbangkan dengan mengurangi konsentrat protein dan menambah cairan.",
    },
    Lemak: {
      rendah:
        "Lemak minuman sangat rendah. Jika diperlukan, tambahkan sedikit lemak sehat dari susu atau santan encer.",
      berlebih:
        "Lemak minuman tinggi. Kurangi santan kental atau krimer, gunakan susu rendah lemak sebagai pengganti.",
    },
    Karbohidrat: {
      rendah:
        "Karbohidrat minuman rendah. Tambahkan sumber karbohidrat alami seperti buah matang atau sedikit madu.",
      berlebih:
        "Karbohidrat minuman terlalu tinggi. Kurangi sirup/gula tambahan dan gunakan buah utuh secukupnya.",
    },
    Serat: {
      rendah:
        "Serat minuman rendah. Pertimbangkan menambah buah utuh (bukan hanya jus) seperti pisang, alpukat, atau pepaya.",
      berlebih:
        "Serat minuman tinggi. Pastikan tekstur tetap nyaman diminum dan sesuaikan dengan target penerima.",
    },
    Gula: {
      rendah: null,
      berlebih:
        "Gula minuman terlalu tinggi. Kurangi gula pasir/sirup dan prioritaskan rasa manis alami dari buah.",
    },
  },
};

function getRuleBasedRecommendations(
  namaMenu,
  nutrientIssues,
  overallScore,
  overallStatus,
  nutritionProfile,
) {
  const recommendations = [];
  const rulesByProfile =
    FALLBACK_RULES[nutritionProfile] || FALLBACK_RULES.makanan;

  for (const issue of nutrientIssues) {
    const rule = rulesByProfile[issue.label];
    if (!rule) continue;

    const pesan = rule[issue.status];
    if (!pesan) continue;

    recommendations.push({
      jenis: "Gizi",
      nutrient: issue.label,
      severity: issue.status === "rendah" ? "warning" : "danger",
      pesan: `[${issue.label}] ${pesan}`,
      detail: `Saat ini: ${issue.value} ${issue.unit} | Standar: ${issue.standar}`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      jenis: "Umum",
      nutrient: null,
      severity: "success",
      pesan: `Menu "${namaMenu}" sudah memenuhi standar gizi yang direkomendasikan. Pertahankan komposisi ini!`,
      detail: null,
    });
  }

  const message =
    overallScore >= 75
      ? `${nutritionProfile === "minuman" ? "Minuman" : "Menu"} "${namaMenu}" memiliki komposisi gizi yang baik dan seimbang.`
      : overallScore >= 50
        ? `${nutritionProfile === "minuman" ? "Minuman" : "Menu"} "${namaMenu}" memiliki komposisi gizi yang cukup, namun masih bisa ditingkatkan.`
        : `${nutritionProfile === "minuman" ? "Minuman" : "Menu"} "${namaMenu}" memerlukan perbaikan signifikan pada komposisi gizinya.`;

  return { message, recommendations };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Menganalisis komposisi gizi sebuah menu menggunakan Google Gemini AI.
 * Jika Gemini tidak tersedia atau gagal, akan fallback ke rule-based.
 *
 * @param {Object} nutrition - Data gizi { kalori, protein, lemak, karbohidrat, serat, gula }
 * @param {string} namaMenu  - Nama menu untuk konteks analisis
 * @param {Object} menuContext - Metadata opsional { kategori, deskripsi, menuType }
 * @returns {Promise<Object>} Hasil analisis lengkap
 */
async function analyzeNutrition(nutrition, namaMenu, menuContext = {}) {
  const nutritionProfile = detectNutritionProfile(namaMenu, menuContext);
  const standarGizi = STANDAR_GIZI_PROFILES[nutritionProfile];

  const { analysis, overallScore, overallStatus, nutrientIssues } =
    computeNutrientAnalysis(nutrition, standarGizi);

  let overallMessage = "";
  let recommendations = [];
  let poweredBy = "Google Gemini AI";
  let aiEngine = "gemini-2.5-flash-lite";

  try {
    const aiResult = await callGeminiAPI(
      namaMenu,
      nutrition,
      nutrientIssues,
      overallScore,
      overallStatus,
      standarGizi,
      nutritionProfile,
    );
    overallMessage = aiResult.message;
    recommendations = aiResult.recommendations;
    console.log(
      `✅ [Gemini AI] Analisis selesai untuk menu: "${namaMenu}" | Skor: ${overallScore}/100`,
    );
    aiEngine = "gemini-2.5-flash-lite";
  } catch (err) {
    // Klasifikasi error untuk log yang lebih informatif
    const msg = err.message || "";
    if (msg.includes("GEMINI_API_KEY belum dikonfigurasi")) {
      console.warn(
        "⚠️  [Gemini AI] API key belum diisi di .env. Menggunakan fallback rule-based.",
      );
    } else if (
      msg.includes("429") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("rate limit")
    ) {
      console.warn(
        "⚠️  [Gemini AI] Kuota API habis (429 Too Many Requests). Menggunakan fallback rule-based.",
      );
    } else if (
      msg.includes("403") ||
      msg.toLowerCase().includes("permission") ||
      msg.toLowerCase().includes("api key not valid")
    ) {
      console.warn(
        "⚠️  [Gemini AI] API key tidak valid atau tidak punya akses (403). Periksa GEMINI_API_KEY di .env.",
      );
    } else if (msg.includes("404")) {
      console.warn(
        `⚠️  [Gemini AI] Model tidak ditemukan (404). Periksa nama model di konfigurasi.`,
      );
    } else if (
      msg.toLowerCase().includes("fetch") ||
      msg.toLowerCase().includes("network") ||
      msg.toLowerCase().includes("enotfound")
    ) {
      console.warn(
        "⚠️  [Gemini AI] Gagal terhubung ke Gemini API (network error). Menggunakan fallback rule-based.",
      );
    } else if (
      msg.toLowerCase().includes("json") ||
      msg.toLowerCase().includes("parse")
    ) {
      console.warn(
        `⚠️  [Gemini AI] Respons tidak bisa di-parse sebagai JSON. Menggunakan fallback rule-based.`,
      );
    } else {
      console.warn(
        `⚠️  [Gemini AI] Gagal: ${msg}. Menggunakan fallback rule-based.`,
      );
    }

    const fallback = getRuleBasedRecommendations(
      namaMenu,
      nutrientIssues,
      overallScore,
      overallStatus,
      nutritionProfile,
    );
    overallMessage = fallback.message;
    recommendations = fallback.recommendations;
    poweredBy = "Rule-Based Fallback";
    aiEngine = "rule-based-fallback";
  }

  return {
    menu_nama: namaMenu,
    skor_gizi: overallScore,
    status: overallStatus,
    pesan: overallMessage,
    detail_analisis: analysis,
    rekomendasi: recommendations,
    standar_referensi: `AKG per porsi ${nutritionProfile} (Kemenkes RI) — Powered by ${poweredBy}`,
    nutrition_profile: nutritionProfile,
    ai_engine: aiEngine,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Menghasilkan ringkasan gizi singkat.
 * @param {Object} nutrition
 * @returns {Object}
 */
function getNutritionSummary(nutrition) {
  const profile = detectNutritionProfile("", {});
  return {
    kalori: Number(nutrition.kalori || 0),
    protein: Number(nutrition.protein || 0),
    lemak: Number(nutrition.lemak || 0),
    karbohidrat: Number(nutrition.karbohidrat || 0),
    serat: Number(nutrition.serat || 0),
    gula: Number(nutrition.gula || 0),
    nutrition_profile: profile,
    is_balanced: isBalanced(nutrition, profile),
  };
}

/**
 * Memeriksa apakah seluruh nilai gizi menu berada dalam standar.
 * @param {Object} nutrition
 * @param {string} nutritionProfile
 * @returns {boolean}
 */
function isBalanced(nutrition, nutritionProfile = "makanan") {
  const standarGizi =
    STANDAR_GIZI_PROFILES[nutritionProfile] || STANDAR_GIZI_PROFILES.makanan;
  for (const [nutrient, standard] of Object.entries(standarGizi)) {
    const value = Number(nutrition[nutrient] || 0);
    if (value < standard.min || value > standard.max) return false;
  }
  return true;
}

/**
 * Generate menu suggestion dari bahan yang tersedia menggunakan Gemini AI.
 * @param {Array} ingredients - Array bahan tersedia [{nama, jumlah, satuan}]
 * @param {string} kelompok - 'porsi_kecil' | 'porsi_besar' (kompatibel dengan nilai lama: balita/siswa/ibu_hamil)
 * @param {string} kategori - 'Sarapan' | 'Makan Siang' | 'Makan Malam' | 'Snack'
 * @returns {Promise<Object>} Menu suggestion dengan estimasi gizi
 */
async function generateMenuFromIngredients(
  ingredients,
  kelompok = "porsi_kecil",
  kategori = "Siswa",
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const canUseGemini = apiKey && apiKey !== "your_gemini_api_key_here";

  const TARGET_GIZI = {
    balita: {
      kalori: "400-500",
      protein: "15-20",
      lemak: "12-18",
      karbo: "55-70",
    },
    siswa: {
      kalori: "550-650",
      protein: "20-30",
      lemak: "15-22",
      karbo: "70-90",
    },
    ibu_hamil: {
      kalori: "700-800",
      protein: "25-35",
      lemak: "20-28",
      karbo: "80-100",
    },
    porsi_kecil: {
      kalori: "400-520",
      protein: "16-22",
      lemak: "12-18",
      karbo: "55-72",
    },
    porsi_besar: {
      kalori: "700-850",
      protein: "28-36",
      lemak: "20-28",
      karbo: "85-105",
    },
  };
  const target = TARGET_GIZI[kelompok] || TARGET_GIZI.siswa;

  const ingList = ingredients
    .map((i) => `- ${i.nama} (${i.jumlah} ${i.satuan})`)
    .join("\n");

  const prompt = `Kamu adalah ahli gizi program MBG (Makan Bergizi Gratis) Indonesia. Berdasarkan bahan yang tersedia, buat satu rekomendasi menu makanan sehat.

BAHAN TERSEDIA:
${ingList}

TARGET GIZI untuk ${kelompok}:
- Kalori: ${target.kalori} kkal
- Protein: ${target.protein} g
- Lemak: ${target.lemak} g
- Karbohidrat: ${target.karbo} g

Kategori: ${kategori}

Buat respons dalam format JSON (tanpa markdown):
{
  "nama_menu": "nama menu yang menarik",
  "deskripsi": "deskripsi singkat cara memasak dan rasa",
  "metode_masak": "rebus/goreng/kukus/panggang",
  "estimasi_gizi": {
    "kalori": number,
    "protein": number,
    "lemak": number,
    "karbohidrat": number,
    "serat": number,
    "gula": number
  },
  "bahan_digunakan": [
    { "nama": "nama bahan", "jumlah": number, "satuan": "satuan", "catatan": "opsional" }
  ],
  "bahan_kurang": [
    { "nama": "nama bahan", "jumlah_butuh": number, "satuan": "satuan", "alasan": "kenapa dibutuhkan" }
  ],
  "tips_gizi": "satu kalimat tip gizi untuk kelompok sasaran",
  "sesuai_target": true/false
}

Rules:
- Jika ada bahan yang HAMPIR cukup atau dibutuhkan, masukkan ke "bahan_kurang"
- Estimasi gizi berdasarkan jumlah bahan yang tersedia dan metode masak
- Nama menu dalam bahasa Indonesia yang menarik
- bahan_kurang kosong jika semua bahan mencukupi`;

  if (canUseGemini) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = extractJsonFromText(text);
    return {
      ...parsed,
      kelompok,
      kategori,
      generated_at: new Date().toISOString(),
    };
  }

  const bahanUtama = ingredients.slice(0, 5).map((i) => ({
    nama: i.nama,
    jumlah: Number(i.jumlah || 0),
    satuan: i.satuan || "g",
  }));
  const fallbackByKelompok = {
    balita: { kalori: 470, protein: 19, lemak: 15, karbo: 62 },
    siswa: { kalori: 610, protein: 26, lemak: 18, karbo: 82 },
    ibu_hamil: { kalori: 760, protein: 32, lemak: 24, karbo: 95 },
    porsi_kecil: { kalori: 430, protein: 18, lemak: 14, karbo: 60 },
    porsi_besar: { kalori: 810, protein: 34, lemak: 24, karbo: 98 },
  };

  const fallbackTarget =
    fallbackByKelompok[kelompok] || fallbackByKelompok.siswa;

  return {
    nama_menu: `Menu MBG ${kategori} Berbasis Stok`,
    deskripsi:
      "Menu rekomendasi sementara dari dummy stock. Aktifkan GEMINI_API_KEY untuk hasil generatif penuh.",
    metode_masak: "rebus-kukus",
    estimasi_gizi: {
      kalori: fallbackTarget.kalori,
      protein: fallbackTarget.protein,
      lemak: fallbackTarget.lemak,
      karbohidrat: fallbackTarget.karbo,
      serat: 6,
      gula: 5,
    },
    bahan_digunakan: bahanUtama,
    bahan_kurang: [],
    tips_gizi:
      "Tambahkan sayur hijau dan buah untuk melengkapi komposisi isi piringku.",
    sesuai_target: true,
    kelompok,
    kategori,
    generated_at: new Date().toISOString(),
    source: "dummy-fallback",
  };
}

// Penentu kategori porsi otomatis berdasarkan nilai gizi
function getKategoriPorsi(nutrition) {
  const kalori = Number(nutrition.kalori || 0);
  if (kalori >= 800) return "Porsi Besar";
  if (kalori > 0 && kalori <= 450) return "Porsi Kecil";
  return null;
}

module.exports = {
  analyzeNutrition,
  getNutritionSummary,
  isBalanced,
  generateMenuFromIngredients,
  STANDAR_GIZI,
};
