import { useState, useEffect } from 'react';
import { Brain, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import type { AIAnalysisResult } from '../types';

const API = 'http://localhost:3002/api/menu';

interface AIAnalysisPanelProps {
  menuId: number;
  menuNama: string;
}

export default function AIAnalysisPanel({ menuId, menuNama }: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/${menuId}/analyze`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menganalisis');
      }

      setAnalysis(data);
      setHasAnalyzed(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-analyze on mount
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusColor = (status: string) => {
    if (status === 'optimal') return 'text-emerald-600 bg-emerald-50';
    if (status === 'rendah') return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">AI sedang menganalisis gizi "{menuNama}"...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start space-x-3">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{error}</p>
            <button onClick={runAnalysis} className="text-xs font-semibold text-red-600 underline mt-1">
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis || !hasAnalyzed) return null;

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <Brain className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Gizi AI</h3>
            <p className="text-xs text-slate-400">{analysis.standar_referensi}</p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
        >
          Analisis Ulang
        </button>
      </div>

      {/* Score Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={analysis.skor_gizi >= 75 ? '#10b981' : analysis.skor_gizi >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(analysis.skor_gizi / 100) * 264} 264`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${getScoreColor(analysis.skor_gizi)}`}>{analysis.skor_gizi}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Skor Gizi</span>
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
          analysis.skor_gizi >= 75 ? 'bg-emerald-500/20 text-emerald-400' :
          analysis.skor_gizi >= 50 ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {analysis.status}
        </span>
        <p className="text-sm text-slate-400 mt-2">{analysis.pesan}</p>
      </div>

      {/* Nutrient Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {Object.entries(analysis.detail_analisis).map(([key, data]) => (
          <div key={key} className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{data.label}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getStatusColor(data.status)}`}>
                {data.status === 'optimal' ? '✓' : data.status === 'rendah' ? '▼' : '▲'}
              </span>
            </div>
            <p className="text-lg font-black text-white">{data.value}<span className="text-xs text-slate-400 ml-1">{data.unit}</span></p>
            <div className="mt-2 overflow-hidden h-1.5 rounded-full bg-white/10">
              <div
                style={{ width: `${Math.min(data.score, 100)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${getScoreBg(data.score)}`}
              ></div>
            </div>
            <p className="text-[9px] text-slate-500 mt-1">
              Standar: {data.min} - {data.max} {data.unit}
            </p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Rekomendasi AI</h4>
        {analysis.rekomendasi.map((rec, idx) => (
          <div key={idx} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 flex items-start space-x-3">
            {getSeverityIcon(rec.severity)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 leading-relaxed">{rec.pesan}</p>
              {rec.detail && (
                <p className="text-xs text-slate-500 mt-1">{rec.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
