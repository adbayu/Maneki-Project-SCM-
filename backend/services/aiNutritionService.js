/**
 * AI Nutrition Analysis Service
 * Modul analisis gizi berbasis rule-based AI
 * Memberikan rekomendasi spesifik berdasarkan komposisi gizi menu
 */

// Standar AKG (Angka Kecukupan Gizi) per porsi untuk makan siang
const STANDAR_GIZI = {
    kalori: { min: 300, max: 700, unit: 'kkal', label: 'Kalori' },
    protein: { min: 15, max: 40, unit: 'g', label: 'Protein' },
    lemak: { min: 10, max: 25, unit: 'g', label: 'Lemak' },
    karbohidrat: { min: 40, max: 80, unit: 'g', label: 'Karbohidrat' },
    serat: { min: 3, max: 10, unit: 'g', label: 'Serat' },
    gula: { min: 0, max: 15, unit: 'g', label: 'Gula' }
};

// Rule-based recommendation engine
const REKOMENDASI_RULES = {
    protein: {
        low: [
            "Protein terlalu rendah. Tambahkan komposisi daging ayam, sapi, atau ikan untuk meningkatkan kandungan protein.",
            "Pertimbangkan menambahkan kacang-kacangan (kedelai, kacang merah) atau tahu/tempe sebagai sumber protein nabati.",
            "Tambahkan satu butir telur rebus sebagai pelengkap untuk boost protein sekitar 6-7g."
        ],
        high: [
            "Kandungan protein cukup tinggi. Pertimbangkan untuk mengurangi porsi daging agar lebih seimbang.",
            "Protein berlebih bisa diganti sebagian dengan sayuran untuk keseimbangan gizi."
        ]
    },
    lemak: {
        low: [
            "Lemak terlalu rendah. Tambahkan sedikit minyak zaitun atau alpukat untuk lemak sehat.",
            "Pertimbangkan menambahkan kacang-kacangan sebagai sumber lemak baik (omega-3)."
        ],
        high: [
            "Kandungan lemak terlalu tinggi. Kurangi penggunaan minyak goreng atau santan.",
            "Ganti metode memasak dari goreng menjadi rebus, kukus, atau panggang untuk mengurangi lemak.",
            "Kurangi porsi santan dan ganti dengan kaldu bening untuk mengurangi lemak jenuh."
        ]
    },
    karbohidrat: {
        low: [
            "Karbohidrat rendah. Tambahkan porsi nasi, kentang, atau ubi untuk meningkatkan energi.",
            "Pertimbangkan menambahkan roti gandum atau jagung sebagai sumber karbohidrat kompleks."
        ],
        high: [
            "Karbohidrat berlebih. Kurangi porsi nasi dan ganti dengan sayuran hijau.",
            "Pertimbangkan untuk mengurangi sumber karbohidrat ganda (misal: nasi + mie + kentang)."
        ]
    },
    kalori: {
        low: [
            "Kalori terlalu rendah untuk satu porsi makan. Tambahkan lauk pauk atau sumber kalori sehat.",
            "Menu ini kurang mengenyangkan. Pertimbangkan menambahkan protein atau karbohidrat kompleks."
        ],
        high: [
            "Kalori terlalu tinggi. Kurangi porsi atau ganti bahan dengan alternatif rendah kalori.",
            "Pertimbangkan untuk membagi porsi atau mengurangi bahan tinggi kalori seperti santan dan minyak."
        ]
    },
    serat: {
        low: [
            "Serat sangat rendah. Tambahkan sayuran hijau seperti bayam, kangkung, atau brokoli.",
            "Pertimbangkan menambahkan buah-buahan segar sebagai pelengkap untuk meningkatkan serat."
        ],
        high: [
            "Kandungan serat sudah sangat baik! Menu ini mendukung kesehatan pencernaan."
        ]
    },
    gula: {
        low: [],
        high: [
            "Kandungan gula terlalu tinggi. Kurangi penggunaan gula pasir dan kecap manis.",
            "Ganti pemanis buatan dengan pemanis alami seperti madu dalam porsi terbatas."
        ]
    }
};

/**
 * Menganalisis komposisi gizi sebuah menu dan menghasilkan rekomendasi
 * @param {Object} nutrition - Data gizi menu {kalori, protein, lemak, karbohidrat, serat, gula}
 * @param {string} namaMenu - Nama menu untuk konteks rekomendasi
 * @returns {Object} Hasil analisis meliputi skor, status per nutrisi, dan rekomendasi
 */
function analyzeNutrition(nutrition, namaMenu) {
    const analysis = {};
    const recommendations = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const [nutrient, standard] of Object.entries(STANDAR_GIZI)) {
        const value = Number(nutrition[nutrient] || 0);
        let status = 'optimal';
        let score = 100;

        if (value < standard.min) {
            status = 'rendah';
            score = Math.round((value / standard.min) * 100);
            // Get random recommendation from the low category
            const rules = REKOMENDASI_RULES[nutrient]?.low || [];
            if (rules.length > 0) {
                const randomRule = rules[Math.floor(Math.random() * rules.length)];
                recommendations.push({
                    jenis: 'Gizi',
                    nutrient: standard.label,
                    severity: 'warning',
                    pesan: `[${standard.label}] ${randomRule}`,
                    detail: `Saat ini: ${value}${standard.unit}, standar minimum: ${standard.min}${standard.unit}`
                });
            }
        } else if (value > standard.max) {
            status = 'berlebih';
            score = Math.max(0, Math.round(100 - ((value - standard.max) / standard.max) * 100));
            const rules = REKOMENDASI_RULES[nutrient]?.high || [];
            if (rules.length > 0) {
                const randomRule = rules[Math.floor(Math.random() * rules.length)];
                recommendations.push({
                    jenis: 'Gizi',
                    nutrient: standard.label,
                    severity: 'danger',
                    pesan: `[${standard.label}] ${randomRule}`,
                    detail: `Saat ini: ${value}${standard.unit}, standar maksimum: ${standard.max}${standard.unit}`
                });
            }
        }

        analysis[nutrient] = {
            label: standard.label,
            value,
            unit: standard.unit,
            min: standard.min,
            max: standard.max,
            status,
            score: Math.max(0, Math.min(100, score))
        };

        totalScore += Math.max(0, Math.min(100, score));
        maxScore += 100;
    }

    const overallScore = Math.round((totalScore / maxScore) * 100);
    
    let overallStatus = 'Baik';
    let overallMessage = `Menu "${namaMenu}" memiliki komposisi gizi yang baik dan seimbang.`;

    if (overallScore < 50) {
        overallStatus = 'Perlu Perbaikan';
        overallMessage = `Menu "${namaMenu}" memerlukan perbaikan signifikan pada komposisi gizi.`;
    } else if (overallScore < 75) {
        overallStatus = 'Cukup';
        overallMessage = `Menu "${namaMenu}" memiliki komposisi gizi yang cukup, namun bisa ditingkatkan.`;
    }

    // Add general recommendation if score is good
    if (recommendations.length === 0) {
        recommendations.push({
            jenis: 'Umum',
            nutrient: null,
            severity: 'success',
            pesan: `Menu "${namaMenu}" sudah memenuhi standar gizi yang direkomendasikan. Pertahankan komposisi ini!`,
            detail: null
        });
    }

    return {
        menu_nama: namaMenu,
        skor_gizi: overallScore,
        status: overallStatus,
        pesan: overallMessage,
        detail_analisis: analysis,
        rekomendasi: recommendations,
        standar_referensi: 'AKG per porsi makan (Kemenkes RI)',
        analyzed_at: new Date().toISOString()
    };
}

/**
 * Menghasilkan ringkasan gizi yang bisa di-query oleh modul produksi
 * @param {Object} nutrition - Data gizi menu
 * @returns {Object} Ringkasan singkat gizi
 */
function getNutritionSummary(nutrition) {
    return {
        kalori: Number(nutrition.kalori || 0),
        protein: Number(nutrition.protein || 0),
        lemak: Number(nutrition.lemak || 0),
        karbohidrat: Number(nutrition.karbohidrat || 0),
        serat: Number(nutrition.serat || 0),
        gula: Number(nutrition.gula || 0),
        is_balanced: isBalanced(nutrition)
    };
}

/**
 * Cek apakah menu seimbang berdasarkan standar
 */
function isBalanced(nutrition) {
    for (const [nutrient, standard] of Object.entries(STANDAR_GIZI)) {
        const value = Number(nutrition[nutrient] || 0);
        if (value < standard.min || value > standard.max) {
            return false;
        }
    }
    return true;
}

module.exports = {
    analyzeNutrition,
    getNutritionSummary,
    isBalanced,
    STANDAR_GIZI
};
