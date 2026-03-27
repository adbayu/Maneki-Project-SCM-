import { useState, useEffect } from 'react';
import { UtensilsCrossed, Search, Trash2, Pencil, Brain, Eye, ChevronDown } from 'lucide-react';
import type { Menu } from '../types';
import AIAnalysisPanel from './AIAnalysisPanel';

const API = 'http://localhost:3002/api/menu';

interface MenuListProps {
  onEdit: (menuId: number) => void;
  onCreateNew: () => void;
}

export default function MenuList({ onEdit, onCreateNew }: MenuListProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [expandedMenuId, setExpandedMenuId] = useState<number | null>(null);
  const [analyzingMenuId, setAnalyzingMenuId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchMenus = () => {
    setLoading(true);
    fetch(API)
      .then(res => res.json())
      .then(data => setMenus(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMenus(prev => prev.filter(m => m.id !== id));
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMenus = menus.filter(m => {
    const matchesSearch = m.nama.toLowerCase().includes(search.toLowerCase()) ||
      (m.deskripsi && m.deskripsi.toLowerCase().includes(search.toLowerCase()));
    const matchesKategori = !filterKategori || m.kategori === filterKategori;
    return matchesSearch && matchesKategori;
  });

  const kategoris = [...new Set(menus.map(m => m.kategori))];

  const getKategoriColor = (kategori: string) => {
    const colors: Record<string, string> = {
      'Sarapan': 'bg-amber-100 text-amber-700',
      'Makan Siang': 'bg-emerald-100 text-emerald-700',
      'Makan Malam': 'bg-indigo-100 text-indigo-700',
      'Snack': 'bg-pink-100 text-pink-700',
      'Minuman': 'bg-cyan-100 text-cyan-700'
    };
    return colors[kategori] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
          <div className="relative">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full md:w-48 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm appearance-none pr-10"
            >
              <option value="">Semua Kategori</option>
              {kategoris.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      {filteredMenus.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <UtensilsCrossed className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Belum Ada Menu</h3>
          <p className="text-sm text-slate-500 mb-6">Mulai dengan membuat menu pertama Anda.</p>
          <button
            onClick={onCreateNew}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-all shadow-md"
          >
            Buat Menu Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMenus.map((menu) => (
            <div key={menu.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Left: Menu Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-800 truncate">{menu.nama}</h3>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${getKategoriColor(menu.kategori)}`}>
                        {menu.kategori}
                      </span>
                    </div>
                    {menu.deskripsi && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-3">{menu.deskripsi}</p>
                    )}

                    {/* Nutrition Quick View */}
                    <div className="flex flex-wrap gap-2">
                      {menu.kalori != null && (
                        <span className="text-xs font-medium bg-orange-50 text-orange-600 px-2.5 py-1 rounded-lg">
                          🔥 {menu.kalori} kkal
                        </span>
                      )}
                      {menu.protein != null && (
                        <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">
                          💪 {menu.protein}g protein
                        </span>
                      )}
                      {menu.lemak != null && (
                        <span className="text-xs font-medium bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg">
                          🫒 {menu.lemak}g lemak
                        </span>
                      )}
                      {menu.karbohidrat != null && (
                        <span className="text-xs font-medium bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg">
                          🌾 {menu.karbohidrat}g karbo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedMenuId(expandedMenuId === menu.id ? null : menu.id)}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Detail</span>
                    </button>
                    <button
                      onClick={() => setAnalyzingMenuId(analyzingMenuId === menu.id ? null : menu.id)}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-semibold rounded-lg transition-colors"
                      title="Analisis AI"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      <span>AI</span>
                    </button>
                    <button
                      onClick={() => onEdit(menu.id)}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                      title="Edit Menu"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    {deleteConfirm === menu.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(menu.id)}
                          className="px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(menu.id)}
                        className="flex items-center space-x-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                        title="Hapus Menu"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Detail View */}
              {expandedMenuId === menu.id && (
                <MenuDetailExpanded menuId={menu.id} />
              )}

              {/* AI Analysis Panel */}
              {analyzingMenuId === menu.id && (
                <div className="border-t border-slate-100">
                  <AIAnalysisPanel menuId={menu.id} menuNama={menu.nama} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sub-component: Expanded menu detail
function MenuDetailExpanded({ menuId }: { menuId: number }) {
  const [detail, setDetail] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/${menuId}`)
      .then(res => res.json())
      .then(data => setDetail(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [menuId]);

  if (loading) {
    return (
      <div className="border-t border-slate-100 p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3 py-1">
            <div className="h-3 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="border-t border-slate-100 p-6 bg-slate-50/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ingredients */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Bahan Baku</h4>
          {detail.ingredients && detail.ingredients.length > 0 ? (
            <div className="space-y-2">
              {detail.ingredients.map((ing, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white rounded-lg p-3 border border-slate-100">
                  <span className="text-sm font-medium text-slate-700">{ing.nama_bahan}</span>
                  <span className="text-sm font-bold text-slate-900">{ing.jumlah} {ing.satuan}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Belum ada bahan baku</p>
          )}
        </div>

        {/* Nutrition */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Data Gizi</h4>
          {detail.nutrition ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Kalori', value: detail.nutrition.kalori, unit: 'kkal', color: 'text-orange-600' },
                { label: 'Protein', value: detail.nutrition.protein, unit: 'g', color: 'text-blue-600' },
                { label: 'Lemak', value: detail.nutrition.lemak, unit: 'g', color: 'text-rose-600' },
                { label: 'Karbohidrat', value: detail.nutrition.karbohidrat, unit: 'g', color: 'text-amber-600' },
                { label: 'Serat', value: detail.nutrition.serat, unit: 'g', color: 'text-green-600' },
                { label: 'Gula', value: detail.nutrition.gula, unit: 'g', color: 'text-pink-600' },
              ].map(n => (
                <div key={n.label} className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-500">{n.label}</p>
                  <p className={`text-lg font-black ${n.color}`}>{n.value}</p>
                  <p className="text-[10px] text-slate-400">{n.unit}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Belum ada data gizi</p>
          )}
        </div>
      </div>
    </div>
  );
}
