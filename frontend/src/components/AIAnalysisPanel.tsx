import { useState, useEffect } from "react";
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  Zap,
  RefreshCw,
  Clock,
} from "lucide-react";
import type { AIAnalysisResult } from "../types";
import { getCachedAnalysis, setCachedAnalysis } from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";

interface AIAnalysisPanelProps {
  menuId: number;
  menuNama: string;
  onAnalysisSaved?: (menuId: number) => void;
}

export default function AIAnalysisPanel({
  menuId,
  menuNama,
  onAnalysisSaved,
}: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  const runAnalysis = async (force = false) => {
    if (!force) {
      const cached = getCachedAnalysis(menuId);
      if (cached) {
        setAnalysis(cached);
        setHasAnalyzed(true);
        setIsFromCache(true);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/${menuId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menganalisis");
      setAnalysis(data);
      setHasAnalyzed(true);
      setIsFromCache(false);
      setCachedAnalysis(menuId, data as AIAnalysisResult);
      onAnalysisSaved?.(menuId);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan tidak diketahui",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setHasAnalyzed(false);
    setIsFromCache(false);
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isGemini = (analysis?.ai_engine ?? "").toLowerCase().includes("gemini");

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreStroke = (score: number) => {
    if (score >= 75) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreBarBg = (score: number) => {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const getNutrientStatusStyle = (status: string) => {
    switch (status) {
      case "optimal":
        return {
          icon: "✓",
          label: "Optimal",
          cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
        };
      case "rendah":
        return {
          icon: "↓",
          label: "Rendah",
          cls: "text-amber-400 bg-amber-500/15 border-amber-500/30",
        };
      default:
        return {
          icon: "↑",
          label: "Berlebih",
          cls: "text-red-400 bg-red-500/15 border-red-500/30",
        };
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "success")
      return (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
      );
    if (severity === "warning")
      return (
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      );
    return <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />;
  };

  const getSeverityCard = (severity: string) => {
    if (severity === "success") return "border-emerald-500/20 bg-emerald-500/5";
    if (severity === "warning") return "border-amber-500/20 bg-amber-500/5";
    return "border-red-500/20 bg-red-500/5";
  };

  const getOverallBadge = (score: number) => {
    if (score >= 75)
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (score >= 50)
      return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    return "bg-red-500/20 text-red-400 border border-red-500/30";
  };

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-10">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="h-7 w-7 text-violet-400" />
          </div>
          <Loader2 className="h-16 w-16 text-violet-500/60 animate-spin absolute inset-0" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white">
            Meminta analisis ke Google Gemini AI…
          </p>
          <p className="text-xs text-slate-500">
            Menganalisis komposisi gizi &quot;{menuNama}&quot;
          </p>
        </div>
        {/* Shimmer dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-500/50 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6 bg-slate-900">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">
              Gagal menganalisis menu
            </p>
            <p className="text-xs text-red-400/70 mt-0.5 leading-relaxed">
              {error}
            </p>
            <button
              onClick={() => runAnalysis(true)}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 underline transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis || !hasAnalyzed) return null;

  // ── Main Panel ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* ── HEADER ── */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon + Title + Badges */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/20 shrink-0">
              <Brain className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white leading-tight">
                  Analisis Gizi AI
                </h3>

                {/* AI Engine Badge */}
                {isGemini ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/25">
                    <Sparkles className="h-2.5 w-2.5" />
                    Gemini AI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/25">
                    <Zap className="h-2.5 w-2.5" />
                    Rule-Based
                  </span>
                )}
              </div>

              {/* Sub-info: timestamp + reference */}
              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Clock className="h-2.5 w-2.5 shrink-0" />
                <span>
                  {formatTime(analysis.analyzed_at)}
                  &nbsp;·&nbsp;AKG Kemenkes RI
                </span>
              </p>
            </div>
          </div>

          {/* Right: Refresh Button */}
          <button
            onClick={() => runAnalysis(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-white border border-violet-500/30 hover:border-violet-400 hover:bg-violet-500/10 px-3 py-1.5 rounded-lg transition-all shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Analisis Ulang
          </button>
        </div>
        {isFromCache && (
          <p className="mt-2 text-[10px] text-slate-500">
            Menampilkan hasil analisis tersimpan. Gunakan "Analisis Ulang" untuk
            memperbarui.
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* ── SCORE + STATUS ── */}
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-white/3 rounded-2xl p-4 border border-white/5">
          {/* Circular Score */}
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="9"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={getScoreStroke(analysis.skor_gizi)}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${(analysis.skor_gizi / 100) * 264} 264`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-black leading-none ${getScoreColor(analysis.skor_gizi)}`}
              >
                {analysis.skor_gizi}
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                /100
              </span>
            </div>
          </div>

          {/* Status Text */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getOverallBadge(analysis.skor_gizi)}`}
            >
              {analysis.status}
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {analysis.pesan}
            </p>
          </div>
        </div>

        {/* ── NUTRIENT BREAKDOWN ── */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            Detail Nutrisi per Porsi
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {Object.entries(analysis.detail_analisis).map(([key, data]) => {
              const st = getNutrientStatusStyle(data.status);
              return (
                <div
                  key={key}
                  className="space-y-2 rounded-xl border border-white/8 bg-white/5 p-3 transition-colors hover:bg-white/8"
                >
                  {/* Label + Status Badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                      {data.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${st.cls}`}
                    >
                      {st.icon} {st.label}
                    </span>
                  </div>

                  {/* Value */}
                  <p className="text-xl font-black text-white leading-none">
                    {data.value}
                    <span className="text-xs text-slate-400 font-normal ml-0.5">
                      {data.unit}
                    </span>
                  </p>

                  {/* Progress Bar */}
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(data.score, 100)}%` }}
                      className={`h-full rounded-full transition-all duration-700 ease-out ${getScoreBarBg(data.score)}`}
                    />
                  </div>

                  {/* Standard Range */}
                  <p className="text-[9px] text-slate-600 font-mono">
                    Std: {data.min}–{data.max} {data.unit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RECOMMENDATIONS ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Rekomendasi {isGemini ? "Gemini AI" : "Sistem"}
            </h4>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
              {analysis.rekomendasi.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {analysis.rekomendasi.map((rec, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-4 border flex items-start gap-3 transition-colors ${getSeverityCard(rec.severity)}`}
              >
                {getSeverityIcon(rec.severity)}

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Nutrient chip */}
                  {rec.nutrient && (
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                      {rec.nutrient}
                    </span>
                  )}
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {rec.pesan}
                  </p>
                  {rec.detail && (
                    <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                      {rec.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-4">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            {analysis.standar_referensi}
          </p>
          {!isGemini && (
            <span className="text-[10px] text-amber-500/60 shrink-0">
              Gemini AI tidak tersedia
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
