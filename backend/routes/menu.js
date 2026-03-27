const express = require('express');
const router = express.Router();
const db = require('../db');
const aiService = require('../services/aiNutritionService');

// ============================================================
// CRUD MENU
// ============================================================

// GET /api/menu - Get all menus with nutrition summary
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.*, 
                   n.kalori, n.protein, n.lemak, n.karbohidrat, n.serat, n.gula
            FROM menus m
            LEFT JOIN menu_nutrition n ON m.id = n.menu_id
            ORDER BY m.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/:id - Get single menu with ingredients and nutrition
router.get('/:id', async (req, res) => {
    try {
        const [menuRows] = await db.query('SELECT * FROM menus WHERE id = ?', [req.params.id]);
        if (menuRows.length === 0) {
            return res.status(404).json({ error: 'Menu tidak ditemukan' });
        }

        const [ingredients] = await db.query(
            'SELECT * FROM menu_ingredients WHERE menu_id = ? ORDER BY id',
            [req.params.id]
        );

        const [nutrition] = await db.query(
            'SELECT * FROM menu_nutrition WHERE menu_id = ?',
            [req.params.id]
        );

        res.json({
            ...menuRows[0],
            ingredients,
            nutrition: nutrition[0] || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/menu - Create new menu with ingredients and nutrition
router.post('/', async (req, res) => {
    const { nama, kategori, deskripsi, ingredients, nutrition } = req.body;

    if (!nama || !kategori) {
        return res.status(400).json({ error: 'Nama dan kategori wajib diisi' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert Menu
        const [menuResult] = await connection.query(
            'INSERT INTO menus (nama, kategori, deskripsi) VALUES (?, ?, ?)',
            [nama, kategori, deskripsi || null]
        );
        const menuId = menuResult.insertId;

        // 2. Insert Ingredients
        if (ingredients && ingredients.length > 0) {
            const ingredientValues = ingredients.map(ing => [
                menuId,
                ing.bahan_baku_ref_id || null,
                ing.nama_bahan,
                ing.jumlah,
                ing.satuan
            ]);
            await connection.query(
                'INSERT INTO menu_ingredients (menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan) VALUES ?',
                [ingredientValues]
            );
        }

        // 3. Insert Nutrition
        if (nutrition) {
            await connection.query(
                `INSERT INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    menuId,
                    nutrition.kalori || 0,
                    nutrition.protein || 0,
                    nutrition.lemak || 0,
                    nutrition.karbohidrat || 0,
                    nutrition.serat || 0,
                    nutrition.gula || 0
                ]
            );
        }

        await connection.commit();

        // Fetch the complete menu data
        const [newMenu] = await db.query('SELECT * FROM menus WHERE id = ?', [menuId]);
        const [newIngredients] = await db.query('SELECT * FROM menu_ingredients WHERE menu_id = ?', [menuId]);
        const [newNutrition] = await db.query('SELECT * FROM menu_nutrition WHERE menu_id = ?', [menuId]);

        res.status(201).json({
            message: 'Menu berhasil dibuat',
            data: {
                ...newMenu[0],
                ingredients: newIngredients,
                nutrition: newNutrition[0] || null
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/menu/:id - Update menu
router.put('/:id', async (req, res) => {
    const menuId = req.params.id;
    const { nama, kategori, deskripsi, ingredients, nutrition } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update menu base info
        await connection.query(
            'UPDATE menus SET nama = ?, kategori = ?, deskripsi = ? WHERE id = ?',
            [nama, kategori, deskripsi || null, menuId]
        );

        // 2. Replace ingredients (delete and re-insert)
        if (ingredients) {
            await connection.query('DELETE FROM menu_ingredients WHERE menu_id = ?', [menuId]);
            if (ingredients.length > 0) {
                const ingredientValues = ingredients.map(ing => [
                    menuId,
                    ing.bahan_baku_ref_id || null,
                    ing.nama_bahan,
                    ing.jumlah,
                    ing.satuan
                ]);
                await connection.query(
                    'INSERT INTO menu_ingredients (menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan) VALUES ?',
                    [ingredientValues]
                );
            }
        }

        // 3. Upsert nutrition
        if (nutrition) {
            await connection.query(
                `INSERT INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    kalori = VALUES(kalori), 
                    protein = VALUES(protein), 
                    lemak = VALUES(lemak), 
                    karbohidrat = VALUES(karbohidrat),
                    serat = VALUES(serat),
                    gula = VALUES(gula)`,
                [
                    menuId,
                    nutrition.kalori || 0,
                    nutrition.protein || 0,
                    nutrition.lemak || 0,
                    nutrition.karbohidrat || 0,
                    nutrition.serat || 0,
                    nutrition.gula || 0
                ]
            );
        }

        await connection.commit();

        // Fetch updated data
        const [updatedMenu] = await db.query('SELECT * FROM menus WHERE id = ?', [menuId]);
        const [updatedIngredients] = await db.query('SELECT * FROM menu_ingredients WHERE menu_id = ?', [menuId]);
        const [updatedNutrition] = await db.query('SELECT * FROM menu_nutrition WHERE menu_id = ?', [menuId]);

        res.json({
            message: 'Menu berhasil diperbarui',
            data: {
                ...updatedMenu[0],
                ingredients: updatedIngredients,
                nutrition: updatedNutrition[0] || null
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /api/menu/:id - Delete menu
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM menus WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Menu tidak ditemukan' });
        }
        res.json({ message: 'Menu berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// AI ANALYSIS & RECOMMENDATIONS
// ============================================================

// POST /api/menu/:id/analyze - Analyze nutrition with AI
router.post('/:id/analyze', async (req, res) => {
    try {
        const [menuRows] = await db.query('SELECT * FROM menus WHERE id = ?', [req.params.id]);
        if (menuRows.length === 0) {
            return res.status(404).json({ error: 'Menu tidak ditemukan' });
        }

        const [nutritionRows] = await db.query('SELECT * FROM menu_nutrition WHERE menu_id = ?', [req.params.id]);
        if (nutritionRows.length === 0) {
            return res.status(400).json({ error: 'Data gizi belum diisi untuk menu ini' });
        }

        const menu = menuRows[0];
        const nutrition = nutritionRows[0];

        // Run AI analysis
        const analysis = aiService.analyzeNutrition(nutrition, menu.nama);

        // Save recommendations to database
        for (const rec of analysis.rekomendasi) {
            await db.query(
                `INSERT INTO ai_recommendations (menu_id, jenis, rekomendasi, skor_gizi) VALUES (?, ?, ?, ?)`,
                [req.params.id, rec.jenis, rec.pesan, analysis.skor_gizi]
            );
        }

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/:id/recommendations - Get AI recommendation history
router.get('/:id/recommendations', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM ai_recommendations WHERE menu_id = ? ORDER BY timestamp DESC LIMIT 20',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// INTEGRATION ENDPOINTS (untuk Modul Produksi)
// ============================================================

// GET /api/menu/integration/list - Compact menu list for production module
router.get('/integration/list', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.id, m.nama, m.kategori, m.is_active,
                   n.kalori, n.protein, n.lemak, n.karbohidrat
            FROM menus m
            LEFT JOIN menu_nutrition n ON m.id = n.menu_id
            WHERE m.is_active = 1
            ORDER BY m.nama
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/:id/ingredients - Get ingredients for production calculation
router.get('/:id/ingredients', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan FROM menu_ingredients WHERE menu_id = ?',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/stats/summary - Dashboard stats
router.get('/stats/summary', async (req, res) => {
    try {
        const [totalMenus] = await db.query('SELECT COUNT(*) as total FROM menus');
        const [activeMenus] = await db.query('SELECT COUNT(*) as total FROM menus WHERE is_active = 1');
        const [avgNutrition] = await db.query(`
            SELECT 
                ROUND(AVG(kalori), 1) as avg_kalori,
                ROUND(AVG(protein), 1) as avg_protein,
                ROUND(AVG(lemak), 1) as avg_lemak,
                ROUND(AVG(karbohidrat), 1) as avg_karbohidrat
            FROM menu_nutrition
        `);
        const [kategoris] = await db.query(`
            SELECT kategori, COUNT(*) as count 
            FROM menus 
            GROUP BY kategori 
            ORDER BY count DESC
        `);

        res.json({
            total_menus: totalMenus[0].total,
            active_menus: activeMenus[0].total,
            avg_nutrition: avgNutrition[0],
            per_kategori: kategoris
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
