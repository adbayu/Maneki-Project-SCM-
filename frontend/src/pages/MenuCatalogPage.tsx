import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  ChefHat,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import AIAnalysisPanel from "../components/AIAnalysisPanel";
import type { Menu, PageView } from "../types";
import {
  clearEditTargetMenuId,
  getPorsiLabel,
  hasCachedAnalysis,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  resolveMenuPorsi,
  resolveMenuType,
  sanitizeMenuName,
  saveMenuMetaMap,
  setEditTargetMenuId,
  type MenuPorsi,
  type MenuType,
  type MenuMetaEntry,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";

type TabKat =
  | "all"
  | "Siswa"
  | "Balita"
  | "Ibu Hamil"
  | "porsi_besar"
  | "porsi_kecil"
  | "makanan"
  | "minuman";

const tabs: Array<{ key: TabKat; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "Siswa", label: "Siswa" },
  { key: "Balita", label: "Balita" },
  { key: "Ibu Hamil", label: "Ibu Hamil" },
  { key: "porsi_besar", label: "Porsi Besar" },
  { key: "porsi_kecil", label: "Porsi Kecil" },
  { key: "makanan", label: "Makanan" },
  { key: "minuman", label: "Minuman" },
];

interface MenuCatalogPageProps {
  onNavigate: (p: PageView) => void;
}

function resolveMenuImageUrl(gambarUrl: string | null | undefined) {
  if (!gambarUrl) return null;
  if (gambarUrl.startsWith("http://") || gambarUrl.startsWith("https://")) {
    return gambarUrl;
  }
  return `${API_ORIGIN}${gambarUrl}`;
}

function getPorsiBadgeClass(porsi: MenuPorsi) {
  return porsi === "porsi_besar"
    ? "bg-orange-100 text-orange-700"
    : "bg-sky-100 text-sky-700";
}

function getTypeBadgeClass(type: MenuType) {
  return type === "minuman"
    ? "bg-cyan-100 text-cyan-700"
    : "bg-emerald-100 text-emerald-700";
}

function getKelompokBadgeClass(kategori: Menu["kategori"]) {
  if (kategori === "Siswa") return "bg-blue-100 text-blue-700";
  if (kategori === "Balita") return "bg-pink-100 text-pink-700";
  return "bg-amber-100 text-amber-700";
}

function MiniDonut({
  protein,
  karbo,
  lemak,
  size = 40,
}: {
  protein: number;
  karbo: number;
  lemak: number;
  size?: number;
}) {
  const total = protein + karbo + lemak;

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-full border border-gray-200 bg-gray-50"
      >
        <span className="text-[8px] text-gray-300">N/A</span>
      </div>
    );
  }

  const slices = [
    { value: karbo, color: "#8b5cf6", label: "Karbo" },
    { value: protein, color: "#10b981", label: "Protein" },
    { value: lemak, color: "#f59e0b", label: "Lemak" },
  ];

  let start = 0;

  return (
    <svg viewBox="0 0 42 42" width={size} height={size}>
      <circle cx="21" cy="21" r="12" fill="white" />
      {slices.map((s) => {
        const pct = (s.value / total) * 100;
        const node = (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={s.color}
            strokeWidth="5"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={-start}
          />
        );
        start += pct;
        return node;
      })}
    </svg>
  );
}

export default function MenuCatalogPage({ onNavigate }: MenuCatalogPageProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKat>("all");
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, setAnalysisVersion] = useState(0);
  const [menuMetaMap, setMenuMetaMap] = useState<Record<number, MenuMetaEntry>>(
    {},
  );

  useEffect(() => {
    setLoading(true);
    fetch(API)
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as Menu[]) : [];
        setMenus(list);

        const currentMeta = loadMenuMetaMap();
        const nextMeta = { ...currentMeta };
        let changed = false;

        list.forEach((menu) => {
          if (!nextMeta[menu.id]) {
            nextMeta[menu.id] = {
              type: inferMenuType(menu),
              porsi: inferMenuPorsi(menu.kalori),
              updatedAt: new Date().toISOString(),
            };
            changed = true;
          }
        });

        if (changed) {
          saveMenuMetaMap(nextMeta);
        }
        setMenuMetaMap(nextMeta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return menus.filter((menu) => {
      const cleanName = sanitizeMenuName(menu.nama).toLowerCase();
      const rawName = menu.nama.toLowerCase();
      const q = search.toLowerCase();
      const bySearch = !q || cleanName.includes(q) || rawName.includes(q);

      const porsi = resolveMenuPorsi(menu, menuMetaMap);
      const type = resolveMenuType(menu, menuMetaMap);

      let byTab = true;
      if (tab === "porsi_besar" || tab === "porsi_kecil") {
        byTab = porsi === tab;
      } else if (tab === "makanan" || tab === "minuman") {
        byTab = type === tab;
      } else if (tab !== "all") {
        byTab = menu.kategori === tab;
      }

      return bySearch && byTab;
    });
  }, [menus, search, tab, menuMetaMap]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus menu");

      setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-4 p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menu Catalog MBG</h1>
          <p className="text-sm text-gray-400">
            Katalog menu dengan status analisis AI tersimpan.
          </p>
        </div>
        <button
          onClick={() => {
            clearEditTargetMenuId();
            onNavigate("recipe-builder");
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Tambah Menu
        </button>
      </div>

      <div className="card flex gap-2 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === t.key
                ? "bg-forest-900 text-white"
                : "border border-gray-200 bg-white text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-sm text-gray-400">Memuat menu...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((menu) => {
            const protein = Number(menu.protein || 0);
            const karbo = Number(menu.karbohidrat || 0);
            const lemak = Number(menu.lemak || 0);
            const imageUrl = resolveMenuImageUrl(menu.gambar_url);
            const menuType = resolveMenuType(menu, menuMetaMap);
            const menuPorsi = resolveMenuPorsi(menu, menuMetaMap);
            const hasAnalysis = hasCachedAnalysis(menu.id);
            const displayName = sanitizeMenuName(menu.nama);

            return (
              <motion.div
                key={menu.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:shadow-md"
              >
                <div className="relative h-32 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-100 to-gray-50 text-gray-300">
                      <ChefHat className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/35 to-transparent" />

                  <div className="absolute bottom-2 left-3 flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getKelompokBadgeClass(menu.kategori)}`}
                    >
                      {menu.kategori}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPorsiBadgeClass(menuPorsi)}`}
                    >
                      {getPorsiLabel(menuPorsi)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getTypeBadgeClass(menuType)}`}
                    >
                      {menuType === "minuman" ? "Minuman" : "Makanan"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-800">
                        {displayName}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {menu.kalori ?? 0} kkal
                      </p>
                    </div>
                    <MiniDonut
                      protein={protein}
                      karbo={karbo}
                      lemak={lemak}
                      size={38}
                    />
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] font-semibold">
                    {hasAnalysis ? (
                      <span className="text-emerald-700">
                        Analisis tersimpan
                      </span>
                    ) : (
                      <span className="text-gray-500">Belum dianalisis</span>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {[
                      { label: "P", value: protein, color: "#10b981" },
                      { label: "K", value: karbo, color: "#8b5cf6" },
                      { label: "L", value: lemak, color: "#f59e0b" },
                    ].map((n) => (
                      <div key={n.label} className="flex-1">
                        <div className="mb-0.5 flex justify-between text-[8px] text-gray-400">
                          <span>{n.label}</span>
                          <span>{n.value}g</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (n.value / 50) * 100)}%`,
                              backgroundColor: n.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAnalyzingId(analyzingId === menu.id ? null : menu.id)
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-violet-100 py-2 text-xs font-semibold text-violet-700"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      {hasAnalysis ? "Lihat Analisis" : "Analisis AI"}
                    </button>

                    <button
                      onClick={() => {
                        setEditTargetMenuId(menu.id);
                        onNavigate("recipe-builder");
                      }}
                      className="rounded-xl bg-amber-50 px-3 py-2 text-amber-600"
                      title="Edit menu"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(menu)}
                      className="rounded-xl bg-red-50 px-3 py-2 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {analyzingId === menu.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AIAnalysisPanel
                        menuId={menu.id}
                        menuNama={displayName}
                        onAnalysisSaved={() => setAnalysisVersion((v) => v + 1)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-5 shadow-xl"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">
                    Konfirmasi Hapus Menu
                  </h3>
                  <p className="text-sm text-gray-500">
                    Menu{" "}
                    <span className="font-semibold text-gray-700">
                      {sanitizeMenuName(deleteTarget.nama)}
                    </span>{" "}
                    akan dihapus permanen.
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                Tindakan ini tidak bisa dibatalkan. Pastikan menu yang dipilih
                sudah benar.
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {deleting ? "Menghapus..." : "Ya, Hapus Menu"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
