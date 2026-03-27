// ============================================================
// Types for Menu Planning & Analisis Gizi Module
// ============================================================

export interface MenuIngredient {
  id?: number;
  menu_id?: number;
  bahan_baku_ref_id?: number | null;
  nama_bahan: string;
  jumlah: number;
  satuan: string;
}

export interface MenuNutrition {
  id?: number;
  menu_id?: number;
  kalori: number;
  protein: number;
  lemak: number;
  karbohidrat: number;
  serat: number;
  gula: number;
}

export type MenuKategori = 'Sarapan' | 'Makan Siang' | 'Makan Malam' | 'Snack' | 'Minuman';

export interface Menu {
  id: number;
  nama: string;
  kategori: MenuKategori;
  deskripsi: string | null;
  gambar_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  kalori?: number;
  protein?: number;
  lemak?: number;
  karbohidrat?: number;
  serat?: number;
  gula?: number;
  // Detailed
  ingredients?: MenuIngredient[];
  nutrition?: MenuNutrition | null;
}

export interface NutrientAnalysis {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  status: 'optimal' | 'rendah' | 'berlebih';
  score: number;
}

export interface AIRecommendation {
  jenis: string;
  nutrient: string | null;
  severity: 'success' | 'warning' | 'danger';
  pesan: string;
  detail: string | null;
}

export interface AIAnalysisResult {
  menu_nama: string;
  skor_gizi: number;
  status: string;
  pesan: string;
  detail_analisis: Record<string, NutrientAnalysis>;
  rekomendasi: AIRecommendation[];
  standar_referensi: string;
  analyzed_at: string;
}

export interface MenuStats {
  total_menus: number;
  active_menus: number;
  avg_nutrition: {
    avg_kalori: number;
    avg_protein: number;
    avg_lemak: number;
    avg_karbohidrat: number;
  };
  per_kategori: Array<{ kategori: string; count: number }>;
}
