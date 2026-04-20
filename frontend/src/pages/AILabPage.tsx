import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  Zap,
  Users,
  Baby,
  Heart,
} from "lucide-react";
import type { Menu, AIAnalysisResult } from "../types";

const API = "http://localhost:3002/api/menu";

const PILLAR_COLORS: Record<string, string> = {
  kalori: "#10b981",
  protein: "#3b82f6",
  lemak: "#f59e0b",
  karbohidrat: "#8b5cf6",
  serat: "#06b6d4",
  gula: "#ec4899",
};

type TargetMBG = "siswa" | "balita" | "ibu_hamil";

const TARGET_MBG_OPTIONS: {
  key: TargetMBG;
  label: string;
  icon: typeof Users;
  sublabel: string;
}[] = [
  { key: "balita", label: "Balita", icon: Baby, sublabel: "Usia 2-5 tahun" },
  { key: "siswa", label: "Siswa", icon: Users, sublabel: "Usia 6-18 tahun" },
  {
    key: "ibu_hamil",
    label: "Ibu Hamil",
    icon: Heart,
    sublabel: "Trimester 1-3",
  },
];

// AKG minimum per target (per porsi makan)
const AKG_MINIMUM: Record<TargetMBG, Record<string, number>> = {
  balita: {
    kalori: 400,
    protein: 15,
    lemak: 12,
    karbohidrat: 55,
    serat: 3,
    gula: 0,
  },
  siswa: {
    kalori: 550,
    protein: 20,
    lemak: 15,
    karbohidrat: 70,
    serat: 5,
    gula: 0,
  },
  ibu_hamil: {
    kalori: 700,
    protein: 25,
    lemak: 20,
    karbohidrat: 80,
    serat: 6,
    gula: 0,
  },
};

const AKG_MAXIMUM: Record<TargetMBG, Record<string, number>> = {
  balita: {
    kalori: 500,
    protein: 20,
    lemak: 18,
    karbohidrat: 70,
    serat: 8,
    gula: 12,
  },
  siswa: {
    kalori: 650,
    protein: 30,
    lemak: 22,
    karbohidrat: 90,
    serat: 10,
    gula: 15,
  },
  ibu_hamil: {
    kalori: 800,
    protein: 35,
    lemak: 28,
    karbohidrat: 100,
    serat: 12,
    gula: 15,
  },
};

export default function AILabPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [targetMBG, setTargetMBG] = useState<TargetMBG>("siswa");
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPillar, setHoveredPillar] = useState<string | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const runAnalysis = async (menuId: number) => {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setApplySuccess(null);
    try {
      const res = await fetch(`${API}/${menuId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analisis gagal");
      setAnalysis(data as AIAnalysisResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMenus(list as Menu[]);
        if (list.length > 0) {
          setSelectedMenuId(list[0].id as number);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // NO auto-analyze: user must click the button

  // Apply suggestion handler
  const handleApplySuggestion = async (recIdx: number) => {
    if (!selectedMenuId || !analysis) return;
    setApplyingIdx(recIdx);
    setApplySuccess(null);

    try {
      // Get current menu detail
      const detailRes = await fetch(`${API}/${selectedMenuId}`);
      const detail = await detailRes.json();
      if (!detailRes.ok) throw new Error("Gagal mengambil data menu");

      const currentNutrition = detail.nutrition || {};
      const akgMin = AKG_MINIMUM[targetMBG];
      const akgMax = AKG_MAXIMUM[targetMBG];

      // Build improved nutrition based on recommendation
      const rec = analysis.rekomendasi[recIdx];
      const updatedNutrition = { ...currentNutrition };

      if (rec.nutrient) {
        const key = rec.nutrient.toLowerCase();
        const nutritionKey = key === "karbohidrat" ? "karbohidrat" : key;
        if (nutritionKey in akgMin) {
          const currentVal = Number(updatedNutrition[nutritionKey] || 0);
          const min = akgMin[nutritionKey];
          const max = akgMax[nutritionKey];
          const target = Math.round((min + max) / 2);

          if (rec.severity === "warning" && currentVal < min) {
            // Rendah → naikkan ke target
            (updatedNutrition as Record<string, number>)[nutritionKey] = target;
          } else if (rec.severity === "danger" && currentVal > max) {
            // Berlebih → turunkan ke target
            (updatedNutrition as Record<string, number>)[nutritionKey] = target;
          }
        }
      }

      // PUT update
      const putRes = await fetch(`${API}/${selectedMenuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: detail.nama,
          kategori: detail.kategori,
          deskripsi: detail.deskripsi,
          ingredients: detail.ingredients,
          nutrition: {
            kalori: updatedNutrition.kalori || 0,
            protein: updatedNutrition.protein || 0,
            lemak: updatedNutrition.lemak || 0,
            karbohidrat: updatedNutrition.karbohidrat || 0,
            serat: updatedNutrition.serat || 0,
            gula: updatedNutrition.gula || 0,
          },
        }),
      });

      if (!putRes.ok) throw new Error("Gagal mengupdate nutrisi");

      setApplySuccess(
        `Sugesti "${rec.nutrient || "Umum"}" berhasil diterapkan!`,
      );
      // Re-analyze after applying
      setTimeout(() => runAnalysis(selectedMenuId), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menerapkan sugesti");
    } finally {
      setApplyingIdx(null);
    }
  };

  // Derived stats from analysis
  const totalNutrients = analysis
    ? Object.keys(analysis.detail_analisis).length
    : 6;
  const optimalCount = analysis
    ? Object.values(analysis.detail_analisis).filter(
        (d) => d.status === "optimal",
      ).length
    : 0;
  const warningCount = analysis
    ? Object.values(analysis.detail_analisis).filter(
        (d) => d.status !== "optimal",
      ).length
    : 0;

  // AKG reference used in nutrient chart overlays
  const akgMin = AKG_MINIMUM[targetMBG];
  const akgMax = AKG_MAXIMUM[targetMBG];

  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-200">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">AI Nutrition Lab</h1>
          <p className="text-sm text-gray-400">
            Analisis mendalam & rekomendasi optimasi gizi menu MBG
          </p>
        </div>
      </div>

      {/* Menu selector + Target MBG + Analyze Button */}
      {!loading && (
        <div className="card p-5 space-y-4">
          {/* Row 1: Menu select */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-600 shrink-0">
              📋 Pilih Menu:
            </label>
            <select
              value={selectedMenuId || ""}
              onChange={(e) => {
                setSelectedMenuId(Number(e.target.value));
                setAnalysis(null);
                setError(null);
                setApplySuccess(null);
              }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none text-sm font-medium text-gray-700 transition-all focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} — {m.kategori}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Target MBG tabs */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              <Target className="h-3 w-3 inline mr-1" />
              Target Kelompok MBG
            </label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {TARGET_MBG_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setTargetMBG(opt.key);
                      setAnalysis(null);
                      setApplySuccess(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                      targetMBG === opt.key
                        ? "bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200"
                        : "text-gray-500 hover:text-violet-700 hover:bg-white/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{opt.label}</span>
                    <span
                      className={`text-[9px] ${targetMBG === opt.key ? "text-violet-200" : "text-gray-400"}`}
                    >
                      {opt.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Analyze Button */}
          <button
            onClick={() => selectedMenuId && runAnalysis(selectedMenuId)}
            disabled={analyzing || !selectedMenuId}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-linear-to-r from-violet-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-violet-300/40 hover:shadow-xl hover:shadow-violet-300/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                AI sedang menganalisis...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                🧠 Mulai Analisis Gizi
              </>
            )}
          </button>
        </div>
      )}

      {/* Apply Success Message */}
      <AnimatePresence>
        {applySuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {applySuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {analyzing ? (
        <div className="card p-16 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
              <Brain className="h-7 w-7 text-violet-600" />
            </div>
            <Loader2 className="h-16 w-16 text-violet-400 animate-spin absolute inset-0" />
          </div>
          <p className="text-sm text-gray-500">
            AI sedang menganalisis nutrisi "{selectedMenu?.nama}"...
          </p>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      ) : error ? (
        /* Error state */
        <div className="card p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => selectedMenuId && runAnalysis(selectedMenuId)}
            className="btn-primary px-6 py-2 text-sm"
          >
            Coba Lagi
          </button>
        </div>
      ) : analysis ? (
        <>
          {/* ── Score Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-500">
                  Overall Score
                </p>
                <TrendingUp className="h-4 w-4 text-forest-600" />
              </div>
              <p className="text-4xl font-black text-gray-800">
                {analysis.skor_gizi}
                <span className="text-lg text-gray-400 font-normal"> /100</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{analysis.status}</p>
              <p className="text-[10px] text-violet-500 mt-1 font-medium">
                Target:{" "}
                {TARGET_MBG_OPTIONS.find((t) => t.key === targetMBG)?.label}
              </p>
            </motion.div>

            {/* Optimal count */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="p-5 rounded-2xl text-white"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
              }}
            >
              <p className="text-sm font-medium opacity-80 mb-2">
                Nutrisi Optimal
              </p>
              <p className="text-4xl font-black">
                {optimalCount}
                <span className="text-lg font-normal opacity-70">
                  {" "}
                  /{totalNutrients}
                </span>
              </p>
              <p className="text-xs opacity-70 mt-1">Memenuhi target gizi</p>
            </motion.div>

            {/* Needs Attention */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="p-5 rounded-2xl text-white"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
              }}
            >
              <p className="text-sm font-medium opacity-80 mb-2">
                Perlu Perhatian
              </p>
              <p className="text-4xl font-black">
                {warningCount}
                <span className="text-lg font-normal opacity-70">
                  {" "}
                  /{totalNutrients}
                </span>
              </p>
              <p className="text-xs opacity-70 mt-1">Pilar nutrisi</p>
            </motion.div>
          </div>

          {/* ── Nutrition Pillar Bar Chart with AKG Shadow ── */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-800">
                Nutrition Pillar Analysis
              </h3>
              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                AKG {TARGET_MBG_OPTIONS.find((t) => t.key === targetMBG)?.label}
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-[10px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-violet-500" />
                <span>Nilai Aktual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-200 border border-dashed border-gray-300" />
                <span>Batas Min AKG</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-dashed border-emerald-300" />
                <span>Rentang Ideal</span>
              </div>
            </div>

            <div
              className="flex items-end gap-4 justify-center"
              style={{ height: 220 }}
            >
              {Object.entries(analysis.detail_analisis).map(([key, d]) => {
                const maxVal = Math.max(
                  d.value,
                  akgMax[key] || 100,
                  akgMin[key] || 50,
                );
                const barH = Math.max(12, (d.value / maxVal) * 160);
                const minBarH = Math.max(
                  8,
                  ((akgMin[key] || 0) / maxVal) * 160,
                );
                const maxBarH = Math.max(
                  8,
                  ((akgMax[key] || 100) / maxVal) * 160,
                );
                const color = PILLAR_COLORS[key] || "#8b5cf6";
                const isHovered = hoveredPillar === key;
                const statusColor =
                  d.status === "optimal"
                    ? "#10b981"
                    : d.status === "rendah"
                      ? "#ef4444"
                      : "#f59e0b";

                return (
                  <div
                    key={key}
                    className="flex flex-col items-center gap-2 flex-1 max-w-24 relative"
                    onMouseEnter={() => setHoveredPillar(key)}
                    onMouseLeave={() => setHoveredPillar(null)}
                  >
                    {/* Hover Tooltip */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          className="absolute -top-24 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-xl min-w-35"
                        >
                          <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                            {d.label}
                          </div>
                          <div className="text-lg font-black">
                            {d.value}{" "}
                            <span className="text-xs font-normal text-gray-400">
                              {d.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: statusColor }}
                            />
                            <span
                              className="text-[9px] font-semibold"
                              style={{ color: statusColor }}
                            >
                              {d.status === "optimal"
                                ? "Optimal"
                                : d.status === "rendah"
                                  ? "Rendah"
                                  : "Berlebih"}
                            </span>
                          </div>
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            AKG: {akgMin[key]}–{akgMax[key]} {d.unit}
                          </div>
                          {/* Tooltip arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-900" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className="relative w-full flex flex-col items-center"
                      style={{ height: 170 }}
                    >
                      {/* AKG ideal range shadow (behind) */}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-md border border-dashed"
                        style={{
                          height: maxBarH,
                          width: "85%",
                          maxWidth: 52,
                          backgroundColor: "rgba(16, 185, 129, 0.08)",
                          borderColor: "rgba(16, 185, 129, 0.25)",
                          transition: "height 0.5s",
                        }}
                      />

                      {/* AKG minimum line shadow */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                          bottom: minBarH,
                          width: "95%",
                          maxWidth: 58,
                          height: 2,
                          backgroundColor: "rgba(239, 68, 68, 0.3)",
                          borderRadius: 1,
                          transition: "bottom 0.5s",
                        }}
                      />

                      {/* Actual value bar */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: barH }}
                        transition={{
                          duration: 0.6,
                          delay: 0.1,
                          ease: "easeOut",
                        }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer"
                        style={{
                          width: "60%",
                          maxWidth: 40,
                          backgroundColor: isHovered ? color : `${color}cc`,
                          borderRadius: "6px 6px 0 0",
                          boxShadow: isHovered
                            ? `0 0 14px ${color}44, 0 4px 8px ${color}22`
                            : "none",
                          transition: "box-shadow 0.2s, background-color 0.2s",
                          zIndex: 10,
                        }}
                      />
                    </div>

                    {/* Label + status dot */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-gray-500 text-center leading-tight font-medium">
                        {d.label}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AI Insights + Optimization ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="card p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-violet-100 rounded-lg">
                  <Brain className="h-4 w-4 text-violet-700" />
                </div>
                <h4 className="font-bold text-gray-800">AI Insights</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {analysis.pesan}
              </p>
              <div className="space-y-2">
                {analysis.rekomendasi.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {rec.severity === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {rec.pesan}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3">
                {analysis.standar_referensi}
              </p>
            </motion.div>

            {/* Optimization Suggestions with Apply */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #fefce8, #fff7ed)",
                border: "1px solid #fde68a",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">⚡</span>
                <h4 className="font-bold text-gray-800">
                  Optimization Suggestions
                </h4>
              </div>
              <div className="space-y-3">
                {analysis.rekomendasi
                  .filter((r) => r.severity !== "success")
                  .slice(0, 3)
                  .map((rec, i) => {
                    const originalIdx = analysis.rekomendasi.indexOf(rec);
                    return (
                      <div
                        key={i}
                        className="bg-white/70 rounded-xl p-3 border border-amber-100"
                      >
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                          {rec.nutrient
                            ? `Optimalkan ${rec.nutrient}`
                            : "Perbaikan Umum"}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          {rec.detail || rec.pesan}
                        </p>
                        <button
                          onClick={() => handleApplySuggestion(originalIdx)}
                          disabled={applyingIdx !== null}
                          className="flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          {applyingIdx === originalIdx ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Menerapkan...
                            </>
                          ) : (
                            <>
                              <Zap className="h-3 w-3" />
                              Apply Suggestion →
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}

                {analysis.rekomendasi.filter((r) => r.severity !== "success")
                  .length === 0 && (
                  <div className="bg-white/70 rounded-xl p-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">
                      Semua nutrisi optimal! 🎉
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : menus.length === 0 && !loading ? (
        /* Empty state */
        <div className="card p-16 text-center">
          <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-600 mb-2">
            Belum Ada Menu
          </h3>
          <p className="text-sm text-gray-400">
            Buat menu di Recipe Builder untuk memulai analisis AI.
          </p>
        </div>
      ) : !loading && !analysis ? (
        /* Initial state - no analysis yet */
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-10 w-10 text-violet-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">
            Siap Menganalisis
          </h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Pilih menu dan kelompok target MBG di atas, lalu klik{" "}
            <strong>"Mulai Analisis Gizi"</strong> untuk mendapatkan insight
            dari AI.
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
