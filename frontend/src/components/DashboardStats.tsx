import { useState, useEffect } from 'react';
import { BarChart3, UtensilsCrossed, Zap, TrendingUp } from 'lucide-react';
import type { MenuStats } from '../types';

const API = 'http://localhost:3002/api/menu';

interface DashboardStatsProps {
  onNavigateToList: () => void;
}

export default function DashboardStats({ onNavigateToList }: DashboardStatsProps) {
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/stats/summary`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <UtensilsCrossed className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Gagal memuat data. Pastikan backend aktif di port 3002.</p>
      </div>
    );
  }

  const nutritionCards = [
    { label: 'Rata-rata Kalori', value: stats.avg_nutrition?.avg_kalori || 0, unit: 'kkal', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Rata-rata Protein', value: stats.avg_nutrition?.avg_protein || 0, unit: 'g', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Rata-rata Lemak', value: stats.avg_nutrition?.avg_lemak || 0, unit: 'g', color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Rata-rata Karbo', value: stats.avg_nutrition?.avg_karbohidrat || 0, unit: 'g', color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <UtensilsCrossed className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Menu</p>
              <p className="text-3xl font-black text-slate-900">{stats.total_menus}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Zap className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Menu Aktif</p>
              <p className="text-3xl font-black text-slate-900">{stats.active_menus}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={onNavigateToList}>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-violet-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Kategori</p>
              <p className="text-3xl font-black text-slate-900">{stats.per_kategori?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nutrition Averages */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Rata-rata Gizi Seluruh Menu</h2>
            <p className="text-sm text-slate-500">Ringkasan komposisi gizi rata-rata dari semua menu yang terdaftar</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {nutritionCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-4 text-center`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
              <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              <p className="text-xs text-slate-400">{card.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      {stats.per_kategori && stats.per_kategori.length > 0 && (
        <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6 md:p-8 text-white">
          <h3 className="text-xl font-bold mb-6">Distribusi Menu per Kategori</h3>
          <div className="space-y-4">
            {stats.per_kategori.map((kat) => {
              const percentage = Math.round((kat.count / stats.total_menus) * 100);
              return (
                <div key={kat.kategori} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-300">{kat.kategori}</span>
                    <span className="text-emerald-400 font-bold">{kat.count} menu ({percentage}%)</span>
                  </div>
                  <div className="overflow-hidden h-2.5 rounded-full bg-slate-700">
                    <div
                      style={{ width: `${percentage}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
