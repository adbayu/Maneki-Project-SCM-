const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: hitung HPP dari ingredients
function hitungHPP(ingredients) {
  let total = 0;
  for (const ing of ingredients) {
    const jumlah = Number(ing.jumlah) || 0;
    const hargaSatuan = Number(ing.harga_satuan) || 0;
    const satuan = ing.satuan || 'g';
    // Konversi ke unit dasar (kg → per kg, liter → per liter, g/ml → per 1000)
    let multiplier = 1;
    if (satuan === 'kg' || satuan === 'liter') multiplier = jumlah;
    else if (satuan === 'g' || satuan === 'ml') multiplier = jumlah / 1000;
    else multiplier = jumlah; // butir, buah, dll
    total += hargaSatuan * multiplier;
  }
  return Math.round(total);
}

// GET /api/financial/summary - Ringkasan finansial keseluruhan
router.get('/summary', async (req, res) => {
  try {
    const [menus] = await db.query(`
      SELECT m.id, m.nama, m.harga_jual,
             n.kalori, n.protein, n.lemak, n.karbohidrat
      FROM menus m
      LEFT JOIN menu_nutrition n ON m.id = n.menu_id
      WHERE m.is_active = 1
    `);

    const [allIngredients] = await db.query(`
      SELECT mi.menu_id, mi.nama_bahan, mi.jumlah, mi.satuan, mi.harga_satuan
      FROM menu_ingredients mi
      JOIN menus m ON mi.menu_id = m.id
      WHERE m.is_active = 1
    `);

    // Group ingredients by menu
    const ingByMenu = {};
    for (const ing of allIngredients) {
      if (!ingByMenu[ing.menu_id]) ingByMenu[ing.menu_id] = [];
      ingByMenu[ing.menu_id].push(ing);
    }

    let totalHPP = 0;
    let totalHargaJual = 0;
    const menuDetails = [];

    for (const menu of menus) {
      const ings = ingByMenu[menu.id] || [];
      const hpp = hitungHPP(ings);
      const hargaJual = Number(menu.harga_jual) || 0;
      const profitPct = hargaJual > 0 ? Math.round(((hargaJual - hpp) / hargaJual) * 100) : 0;
      totalHPP += hpp;
      totalHargaJual += hargaJual;
      menuDetails.push({ ...menu, hpp, profit_pct: profitPct, ingredients: ings });
    }

    const avgProfitPct =
      menus.length > 0 && totalHargaJual > 0
        ? Math.round(((totalHargaJual - totalHPP) / totalHargaJual) * 100)
        : 0;

    // Simulasi anggaran MBG (bisa dari env atau hardcoded untuk demo)
    const anggaranBulan = 75000000;
    const terpakai = 41250000;
    const stokGudangPct = 14;
    const prediksiHari = 3;

    res.json({
      avg_profit_pct: avgProfitPct,
      total_hpp_per_porsi: menus.length > 0 ? Math.round(totalHPP / menus.length) : 0,
      anggaran_bulan: anggaranBulan,
      terpakai: terpakai,
      stok_gudang_pct: stokGudangPct,
      prediksi_hari: prediksiHari,
      menu_details: menuDetails,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/financial/hpp/:group - HPP per kelompok sasaran
// group: 'kecil' (balita), 'standar' (siswa), 'besar' (ibu_hamil)
router.get('/hpp/:group', async (req, res) => {
  const { group } = req.params;

  // Define kelompok sasaran porsi
  const porsiConfig = {
    kecil: {
      label: 'Kelompok Balita',
      sublabel: 'Menu Kecil',
      multiplier: 0.7, // 70% dari porsi standar
      kalori_target: '400-500 kkal',
      ingredients: [
        { nama_bahan: 'Beras Putih',   jumlah: 70,  satuan: 'g',  harga_satuan: 14000 },
        { nama_bahan: 'Ayam Potong',   jumlah: 42,  satuan: 'g',  harga_satuan: 38000 },
        { nama_bahan: 'Tempe',         jumlah: 35,  satuan: 'g',  harga_satuan: 11000 },
        { nama_bahan: 'Wortel',        jumlah: 35,  satuan: 'g',  harga_satuan: 8000  },
        { nama_bahan: 'Pisang Ambon',  jumlah: 70,  satuan: 'g',  harga_satuan: 12000 },
      ],
    },
    standar: {
      label: 'Kelompok Siswa',
      sublabel: 'Menu Standar',
      multiplier: 1.0,
      kalori_target: '600 kkal',
      ingredients: [
        { nama_bahan: 'Beras Putih',   jumlah: 100, satuan: 'g',  harga_satuan: 14000 },
        { nama_bahan: 'Ayam Potong',   jumlah: 60,  satuan: 'g',  harga_satuan: 38000 },
        { nama_bahan: 'Tempe',         jumlah: 50,  satuan: 'g',  harga_satuan: 11000 },
        { nama_bahan: 'Wortel',        jumlah: 50,  satuan: 'g',  harga_satuan: 8000  },
        { nama_bahan: 'Pisang Ambon',  jumlah: 100, satuan: 'g',  harga_satuan: 12000 },
      ],
    },
    besar: {
      label: 'Ibu Hamil / Siswa Atas',
      sublabel: 'Menu Besar',
      multiplier: 1.4,
      kalori_target: '700-800 kkal',
      ingredients: [
        { nama_bahan: 'Beras Putih',   jumlah: 150, satuan: 'g',  harga_satuan: 14000 },
        { nama_bahan: 'Ayam Potong',   jumlah: 80,  satuan: 'g',  harga_satuan: 38000 },
        { nama_bahan: 'Telur Ayam',    jumlah: 55,  satuan: 'g',  harga_satuan: 30000 },
        { nama_bahan: 'Tempe',         jumlah: 50,  satuan: 'g',  harga_satuan: 11000 },
        { nama_bahan: 'Wortel',        jumlah: 60,  satuan: 'g',  harga_satuan: 8000  },
        { nama_bahan: 'Pisang Ambon',  jumlah: 120, satuan: 'g',  harga_satuan: 12000 },
        { nama_bahan: 'Susu UHT',      jumlah: 200, satuan: 'ml', harga_satuan: 18000 },
      ],
    },
  };

  const config = porsiConfig[group];
  if (!config) {
    return res.status(400).json({ error: 'Group tidak valid. Gunakan: kecil, standar, besar' });
  }

  const hpp = hitungHPP(config.ingredients);

  res.json({
    group,
    label: config.label,
    sublabel: config.sublabel,
    kalori_target: config.kalori_target,
    hpp_per_porsi: hpp,
    ingredients: config.ingredients.map((ing) => ({
      ...ing,
      subtotal: Math.round(hitungHPP([ing])),
    })),
    anggaran: {
      bulan: 75000000,
      terpakai: 41250000,
      stok_gudang_pct: 14,
      prediksi_hari: 3,
      bottleneck: 'Ayam Potong',
      bottleneck_sisa: '45 kg (2.5 hari)',
    },
  });
});

module.exports = router;
