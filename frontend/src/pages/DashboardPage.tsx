import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ChefHat,
  Gauge,
  GlassWater,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { Menu, MenuStats, PageView } from "../types";
import {
  getPorsiLabel,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  sanitizeMenuName,
  saveMenuMetaMap,
  setEditTargetMenuId,
  type MenuMetaEntry,
  type MenuPorsi,
  type MenuType,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const WEEKLY_PLAN_STORAGE_KEY = "mbg_weekly_plan_v1";

type Kelompok =
  | "siswa"
  | "balita"
  | "ibu_hamil"
  | "porsi_besar"
  | "porsi_kecil";
const STANDAR: Record<
  Kelompok,
  {
    label: string;
    kalori: number;
    protein: number;
    karbo: number;
    lemak: number;
  }
> = {
  siswa: { label: "Siswa", kalori: 600, protein: 25, karbo: 80, lemak: 18 },
  balita: { label: "Balita", kalori: 450, protein: 20, karbo: 65, lemak: 15 },
  ibu_hamil: {
    label: "Ibu Hamil",
    kalori: 750,
    protein: 30,
    karbo: 90,
    lemak: 22,
  },
  porsi_besar: {
    label: "Porsi Besar",
    kalori: 820,
    protein: 34,
    karbo: 100,
    lemak: 24,
  },
  porsi_kecil: {
    label: "Porsi Kecil",
    kalori: 420,
    protein: 16,
    karbo: 58,
    lemak: 14,
  },
};

interface DayPlan {
  makananIds: number[];
  minumanIds: number[];
}

type WeeklyPlan = Record<string, DayPlan>;
type MenuTypeMap = Record<number, MenuType>;
type MenuMetaMap = Record<number, MenuMetaEntry>;

interface WeekDay {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
}

function createEmptyDayPlan(): DayPlan {
  return { makananIds: [], minumanIds: [] };
}

function normalizeDayPlan(raw: unknown): DayPlan {
  if (Array.isArray(raw)) {
    // Backward compatibility: versi lama menyimpan array tunggal
    return {
      makananIds: raw.filter((id) => typeof id === "number"),
      minumanIds: [],
    };
  }

  if (!raw || typeof raw !== "object") {
    return createEmptyDayPlan();
  }

  const day = raw as Partial<DayPlan>;
  return {
    makananIds: Array.isArray(day.makananIds)
      ? day.makananIds.filter((id) => typeof id === "number")
      : [],
    minumanIds: Array.isArray(day.minumanIds)
      ? day.minumanIds.filter((id) => typeof id === "number")
      : [],
  };
}

function toTypeKey(type: MenuType): keyof DayPlan {
  return type === "minuman" ? "minumanIds" : "makananIds";
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekDays(now = new Date()): WeekDay[] {
  const dayLabels = [
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
    "Minggu",
  ];

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const jsDay = today.getDay();
  const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return dayLabels.map((label, idx) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + idx);

    return {
      dateKey: toDateKey(current),
      dayLabel: label,
      dateLabel: current.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      isToday: toDateKey(current) === toDateKey(today),
    };
  });
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

function progressColor(v: number, t: number) {
  const r = t > 0 ? v / t : 0;
  if (r >= 0.9 && r <= 1.1) return "#10b981";
  if (r >= 0.75) return "#f59e0b";
  return "#ef4444";
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

interface DashboardPageProps {
  onNavigate: (p: PageView) => void;
}

interface SummaryWidget {
  title: string;
  value: string | number;
  subtitle: string;
  gradient: string;
  iconBg: string;
  icon: typeof UtensilsCrossed;
  watermarkColor: string;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kelompok, setKelompok] = useState<Kelompok>("siswa");
  const [search, setSearch] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [plateMenuIds, setPlateMenuIds] = useState<number[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>({});
  const [menuMetaMap, setMenuMetaMap] = useState<MenuMetaMap>({});
  const [menuTypeFilter, setMenuTypeFilter] = useState<"all" | MenuType>("all");
  const [draggingMenuId, setDraggingMenuId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(API).then((r) => r.json()),
      fetch(`${API}/stats/summary`).then((r) => r.json()),
    ])
      .then(([m, s]: [unknown, unknown]) => {
        const list = Array.isArray(m) ? (m as Menu[]) : [];
        setMenus(list);
        setStats(s as MenuStats);

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

        if (list.length > 0) {
          setSelectedMenuId(list[0].id);
          setPlateMenuIds([list[0].id]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const normalized: WeeklyPlan = {};
        Object.entries(parsed).forEach(([dateKey, day]) => {
          normalized[dateKey] = normalizeDayPlan(day);
        });
        setWeeklyPlan(normalized);
      }
    } catch (error) {
      console.error("Gagal memuat jadwal mingguan:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(WEEKLY_PLAN_STORAGE_KEY, JSON.stringify(weeklyPlan));
  }, [weeklyPlan]);

  const weekDays = useMemo(() => getCurrentWeekDays(new Date()), []);
  const menuLookup = useMemo(
    () => new Map(menus.map((menu) => [menu.id, menu])),
    [menus],
  );

  const resolvedMenuTypes = useMemo(() => {
    const result: MenuTypeMap = {};
    menus.forEach((menu) => {
      result[menu.id] = menuMetaMap[menu.id]?.type || inferMenuType(menu);
    });
    return result;
  }, [menus, menuMetaMap]);

  const resolvedMenuPorsi = useMemo(() => {
    const result: Record<number, MenuPorsi> = {};
    menus.forEach((menu) => {
      result[menu.id] =
        menuMetaMap[menu.id]?.porsi || inferMenuPorsi(menu.kalori);
    });
    return result;
  }, [menus, menuMetaMap]);

  const totalScheduledCount = useMemo(
    () =>
      Object.values(weeklyPlan).reduce((acc, day) => {
        const normalized = normalizeDayPlan(day);
        return (
          acc + normalized.makananIds.length + normalized.minumanIds.length
        );
      }, 0),
    [weeklyPlan],
  );

  const piringkuMenus = useMemo(
    () => menus.filter((m) => plateMenuIds.includes(m.id)),
    [menus, plateMenuIds],
  );

  const plateNutrition = useMemo(
    () =>
      piringkuMenus.reduce(
        (acc, m) => {
          acc.kalori += Number(m.kalori || 0);
          acc.protein += Number(m.protein || 0);
          acc.lemak += Number(m.lemak || 0);
          acc.karbo += Number(m.karbohidrat || 0);
          return acc;
        },
        { kalori: 0, protein: 0, lemak: 0, karbo: 0 },
      ),
    [piringkuMenus],
  );

  const std = STANDAR[kelompok];
  const rows = [
    {
      label: "Kalori",
      val: plateNutrition.kalori,
      target: std.kalori,
      unit: "kkal",
    },
    {
      label: "Protein",
      val: plateNutrition.protein,
      target: std.protein,
      unit: "g",
    },
    {
      label: "Karbo",
      val: plateNutrition.karbo,
      target: std.karbo,
      unit: "g",
    },
    {
      label: "Lemak",
      val: plateNutrition.lemak,
      target: std.lemak,
      unit: "g",
    },
  ];

  const macroTotal =
    plateNutrition.protein + plateNutrition.karbo + plateNutrition.lemak;

  const slices = [
    {
      key: "karbo",
      label: "Karbohidrat",
      value: plateNutrition.karbo,
      color: "#8b5cf6",
    },
    {
      key: "protein",
      label: "Protein",
      value: plateNutrition.protein,
      color: "#10b981",
    },
    {
      key: "lemak",
      label: "Lemak",
      value: plateNutrition.lemak,
      color: "#f59e0b",
    },
  ];

  const addMenu = (id: number) =>
    setPlateMenuIds((prev) =>
      prev.includes(id) ? prev : [...prev, id].slice(-3),
    );

  const removeMenu = (id: number) =>
    setPlateMenuIds((prev) => prev.filter((x) => x !== id));

  const setMenuType = (menuId: number, type: MenuType) => {
    setMenuMetaMap((prev) => {
      const next = { ...prev };
      const fallbackPorsi = inferMenuPorsi(menuLookup.get(menuId)?.kalori);
      next[menuId] = {
        type,
        porsi: prev[menuId]?.porsi || fallbackPorsi,
        updatedAt: new Date().toISOString(),
      };
      saveMenuMetaMap(next);
      return next;
    });
  };

  const assignMenuToDay = (
    dateKey: string,
    menuId: number,
    explicitType?: MenuType,
  ) => {
    const type = explicitType || resolvedMenuTypes[menuId] || "makanan";
    const typeKey = toTypeKey(type);

    setWeeklyPlan((prev) => {
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const current = dayPlan[typeKey];
      if (current.includes(menuId)) return prev;

      return {
        ...prev,
        [dateKey]: {
          ...dayPlan,
          [typeKey]: [...current, menuId].slice(-4),
        },
      };
    });
  };

  const removeMenuFromDay = (
    dateKey: string,
    type: MenuType,
    menuId: number,
  ) => {
    const typeKey = toTypeKey(type);

    setWeeklyPlan((prev) => {
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const updated = dayPlan[typeKey].filter((id) => id !== menuId);
      return {
        ...prev,
        [dateKey]: {
          ...dayPlan,
          [typeKey]: updated,
        },
      };
    });
  };

  const clearDayPlan = (dateKey: string) => {
    setWeeklyPlan((prev) => ({
      ...prev,
      [dateKey]: createEmptyDayPlan(),
    }));
  };

  const getMenusByDay = (dateKey: string, type: MenuType) => {
    const dayPlan = normalizeDayPlan(weeklyPlan[dateKey]);
    const ids = dayPlan[toTypeKey(type)];
    return ids
      .map((id) => menuLookup.get(id))
      .filter((menu): menu is Menu => Boolean(menu));
  };

  const filtered = menus.filter((m) => {
    const cleanName = sanitizeMenuName(m.nama);
    const bySearch =
      !search ||
      cleanName.toLowerCase().includes(search.toLowerCase()) ||
      m.nama.toLowerCase().includes(search.toLowerCase());
    const type = resolvedMenuTypes[m.id] || "makanan";
    const byType = menuTypeFilter === "all" || type === menuTypeFilter;
    return bySearch && byType;
  });

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const summaryWidgets: SummaryWidget[] = useMemo(() => {
    if (!stats) return [];

    const totalMenus = Number(stats.total_menus || 0);
    const activeMenus = Number(stats.active_menus || 0);
    const activeRatio =
      totalMenus > 0 ? Math.round((activeMenus / totalMenus) * 100) : 0;

    return [
      {
        title: "Total Menu",
        value: totalMenus,
        subtitle: "Seluruh menu tercatat",
        gradient: "from-emerald-500 to-teal-600",
        iconBg: "bg-emerald-400/20",
        icon: UtensilsCrossed,
        watermarkColor: "text-white/10",
      },
      {
        title: "Menu Aktif",
        value: activeMenus,
        subtitle: "Siap produksi hari ini",
        gradient: "from-blue-500 to-indigo-600",
        iconBg: "bg-blue-400/20",
        icon: Activity,
        watermarkColor: "text-white/10",
      },
      {
        title: "Rasio Aktif",
        value: `${activeRatio}%`,
        subtitle: "Menu aktif vs total",
        gradient: "from-violet-500 to-purple-600",
        iconBg: "bg-violet-400/20",
        icon: TrendingUp,
        watermarkColor: "text-white/10",
      },
      {
        title: "Kategori MBG",
        value: "5",
        subtitle: "Siswa, Balita, Ibu Hamil, dll",
        gradient: "from-amber-500 to-orange-600",
        iconBg: "bg-amber-400/20",
        icon: Users,
        watermarkColor: "text-white/10",
      },
    ];
  }, [stats]);

  const clearDragGhost = () => {
    if (dragGhostRef.current && dragGhostRef.current.parentNode) {
      dragGhostRef.current.parentNode.removeChild(dragGhostRef.current);
    }
    dragGhostRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearDragGhost();
    };
  }, []);

  const handleCardDragStart = (
    e: DragEvent<HTMLDivElement>,
    menuId: number,
    menuType: MenuType,
  ) => {
    setDraggingMenuId(menuId);
    e.dataTransfer.setData("menu-id", String(menuId));
    e.dataTransfer.setData("menu-type", menuType);
    e.dataTransfer.effectAllowed = "copy";

    const source = e.currentTarget;
    const rect = source.getBoundingClientRect();
    const ghost = source.cloneNode(true) as HTMLDivElement;
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = `${rect.width}px`;
    ghost.style.maxWidth = `${rect.width}px`;
    ghost.style.opacity = "0.9";
    ghost.style.transform = "rotate(-2deg) scale(0.98)";
    ghost.style.borderRadius = "14px";
    ghost.style.boxShadow = "0 24px 38px rgba(15, 23, 42, 0.32)";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";

    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, 26, 26);
  };

  const handleCardDragEnd = () => {
    setDraggingMenuId(null);
    setDragOverTarget(null);
    clearDragGhost();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-6 p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard MBG</h1>
          <p className="text-sm text-gray-400">{today}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryWidgets.map((widget, idx) => {
          const Icon = widget.icon;
          return (
            <motion.div
              key={widget.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`relative cursor-default overflow-hidden rounded-2xl bg-linear-to-br ${widget.gradient} p-5 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl`}
            >
              <Icon
                className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${widget.watermarkColor}`}
              />
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" />

              <div className="relative z-10">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    {widget.title}
                  </p>
                  <div className={`${widget.iconBg} rounded-xl p-2`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="mb-1 text-3xl font-black">{widget.value}</p>
                <p className="text-xs font-medium text-white/60">
                  {widget.subtitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-6"
        >
          <h2 className="mb-2 text-base font-bold text-gray-800">
            Monitor Piringku vs AKG 2019
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            Pilih menu dengan dropdown atau seret keseluruhan kartu menu ke area
            piringku.
          </p>

          <div className="mb-3 flex gap-1 rounded-xl bg-forest-50 p-1">
            {(Object.keys(STANDAR) as Kelompok[]).map((k) => (
              <button
                key={k}
                onClick={() => setKelompok(k)}
                className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-all ${
                  kelompok === k
                    ? "bg-forest-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white/60"
                }`}
              >
                {STANDAR[k].label}
              </button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              value={selectedMenuId || ""}
              onChange={(e) => setSelectedMenuId(Number(e.target.value))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {sanitizeMenuName(m.nama) || m.nama}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedMenuId && addMenu(selectedMenuId)}
              className="rounded-xl bg-forest-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-800"
            >
              Tambah ke Piringku
            </button>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("menu-id"));
              if (id) addMenu(id);
            }}
            className="mb-4 flex min-h-12 flex-wrap gap-2 rounded-xl border border-dashed border-forest-300 bg-linear-to-r from-forest-50 to-white p-3"
          >
            {piringkuMenus.map((m) => {
              const thumbUrl = resolveMenuImageUrl(m.gambar_url);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={sanitizeMenuName(m.nama) || m.nama}
                      className="h-6 w-6 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-400">
                      <ChefHat className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="font-medium text-gray-700">
                    {sanitizeMenuName(m.nama) || m.nama}
                  </span>
                  <button
                    onClick={() => removeMenu(m.id)}
                    className="font-bold text-red-400 hover:text-red-600"
                  >
                    x
                  </button>
                </div>
              );
            })}
            {piringkuMenus.length === 0 && (
              <span className="text-xs text-gray-400">
                Belum ada menu, pilih atau drag dari daftar bawah
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              {rows.map((r) => {
                const pct = Math.min(100, Math.round((r.val / r.target) * 100));
                return (
                  <div key={r.label} className="mb-2.5">
                    <div className="mb-1 flex justify-between text-[11px] text-gray-600">
                      <span className="font-medium">{r.label}</span>
                      <span className="font-semibold">
                        {Math.round(r.val)}/{r.target} {r.unit}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: progressColor(r.val, r.target),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 42 42" className="h-24 w-24">
                {(() => {
                  let start = 0;
                  return slices.map((s) => {
                    const pct =
                      macroTotal > 0 ? (s.value / macroTotal) * 100 : 0;
                    const node = (
                      <circle
                        key={s.key}
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke={s.color}
                        strokeWidth="7"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={-start}
                      />
                    );
                    start += pct;
                    return node;
                  });
                })()}
              </svg>
              <div>
                {slices.map((s) => {
                  const pct =
                    macroTotal > 0
                      ? Math.round((s.value / macroTotal) * 100)
                      : 0;
                  return (
                    <div key={s.key} className="mb-1 flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-[11px] font-medium text-gray-600">
                        {s.label}: {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-violet-100 p-2">
              <Gauge className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">
                Rata-rata Nutrisi
              </h2>
              <p className="text-xs text-gray-400">
                Dari seluruh menu yang tersedia
              </p>
            </div>
          </div>

          {stats && (
            <div className="space-y-4">
              {[
                {
                  label: "Kalori",
                  value: Number(stats.avg_nutrition?.avg_kalori || 0),
                  target: 550,
                  unit: "kkal",
                  color: "#ef4444",
                },
                {
                  label: "Protein",
                  value: Number(stats.avg_nutrition?.avg_protein || 0),
                  target: 25,
                  unit: "g",
                  color: "#10b981",
                },
                {
                  label: "Lemak",
                  value: Number(stats.avg_nutrition?.avg_lemak || 0),
                  target: 18,
                  unit: "g",
                  color: "#f59e0b",
                },
                {
                  label: "Karbohidrat",
                  value: Number(stats.avg_nutrition?.avg_karbohidrat || 0),
                  target: 75,
                  unit: "g",
                  color: "#8b5cf6",
                },
              ].map((row) => {
                const pct = Math.max(
                  0,
                  Math.min(100, Math.round((row.value / row.target) * 100)),
                );
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-700">
                        {row.label}
                      </span>
                      <span className="font-medium text-gray-500">
                        {Math.round(row.value)}
                        <span className="ml-1 text-xs text-gray-400">
                          {row.unit}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Distribusi Kategori
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.per_kategori?.map((k) => (
                    <div
                      key={k.kategori}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5"
                    >
                      <span className="text-xs font-bold text-gray-700">
                        {k.kategori}
                      </span>
                      <span className="rounded-full bg-forest-100 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">
                        {k.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="card p-5">
        <div className="mb-4 rounded-xl border border-forest-200/70 bg-linear-to-r from-forest-50 to-white p-3">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700/80">
                Widget Mingguan
              </p>
              <h3 className="text-base font-bold text-gray-800">
                Susun Jadwal Menu Senin - Minggu
              </h3>
              <p className="text-[11px] text-gray-500">
                Seret keseluruhan kartu menu ke slot Makanan atau Minuman pada
                hari yang diinginkan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-forest-700 shadow-sm">
                {totalScheduledCount} menu terjadwal
              </span>
              <button className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-700 hover:bg-forest-50">
                <RefreshCw className="h-3.5 w-3.5" /> Minggu Ini
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {weekDays.map((day) => {
              const dayPlan = normalizeDayPlan(weeklyPlan[day.dateKey]);
              const totalDayItems =
                dayPlan.makananIds.length + dayPlan.minumanIds.length;
              const isFilled = totalDayItems > 0;

              return (
                <div
                  key={day.dateKey}
                  className={`min-h-30 rounded-xl border p-2.5 transition-all ${
                    day.isToday
                      ? "border-forest-500 bg-white shadow-sm"
                      : isFilled
                        ? "border-forest-200 bg-forest-50/30"
                        : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p
                        className={`text-[11px] font-bold ${
                          day.isToday ? "text-forest-800" : "text-gray-700"
                        }`}
                      >
                        {day.dayLabel}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {day.dateLabel}
                      </p>
                    </div>

                    {day.isToday && (
                      <span className="rounded-full bg-forest-100 px-1.5 py-0.5 text-[9px] font-bold text-forest-700">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        type: "makanan" as MenuType,
                        label: "Makanan",
                        icon: UtensilsCrossed,
                        emptyLabel: "Drop menu makanan",
                        sectionClass: "border-emerald-200 bg-emerald-50/40",
                      },
                      {
                        type: "minuman" as MenuType,
                        label: "Minuman",
                        icon: GlassWater,
                        emptyLabel: "Drop menu minuman",
                        sectionClass: "border-sky-200 bg-sky-50/40",
                      },
                    ].map((slot) => {
                      const slotMenus = getMenusByDay(day.dateKey, slot.type);
                      const dropTargetKey = `${day.dateKey}:${slot.type}`;
                      const isDropTarget = dragOverTarget === dropTargetKey;
                      const SlotIcon = slot.icon;

                      return (
                        <div
                          key={slot.type}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverTarget(dropTargetKey);
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === dropTargetKey) {
                              setDragOverTarget(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const menuId = Number(
                              e.dataTransfer.getData("menu-id"),
                            );
                            if (menuId) {
                              assignMenuToDay(day.dateKey, menuId, slot.type);
                              setMenuType(menuId, slot.type);
                            }
                            setDragOverTarget(null);
                          }}
                          className={`rounded-lg border px-2 py-2 transition-all ${slot.sectionClass} ${
                            isDropTarget ? "ring-2 ring-forest-300" : ""
                          }`}
                        >
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <SlotIcon className="h-3 w-3 text-gray-500" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                              {slot.label}
                            </p>
                          </div>

                          {slotMenus.length === 0 ? (
                            <p className="text-[10px] text-gray-400">
                              {slot.emptyLabel}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {slotMenus.map((menu) => {
                                const thumbUrl = resolveMenuImageUrl(
                                  menu.gambar_url,
                                );
                                const displayName =
                                  sanitizeMenuName(menu.nama) || menu.nama;

                                return (
                                  <div
                                    key={`${day.dateKey}-${slot.type}-${menu.id}`}
                                    className="rounded-md border border-gray-200 bg-white p-1.5 shadow-sm"
                                  >
                                    <div className="mb-1 flex items-center gap-1.5">
                                      {thumbUrl ? (
                                        <img
                                          src={thumbUrl}
                                          alt={displayName}
                                          className="h-6 w-6 rounded object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-400">
                                          <ChefHat className="h-3.5 w-3.5" />
                                        </span>
                                      )}
                                      <p className="truncate text-[10px] font-semibold text-gray-700">
                                        {displayName}
                                      </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-1">
                                      <button
                                        onClick={() => {
                                          setEditTargetMenuId(menu.id);
                                          onNavigate("recipe-builder");
                                        }}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200"
                                        title="Edit menu"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        onClick={() =>
                                          removeMenuFromDay(
                                            day.dateKey,
                                            slot.type,
                                            menu.id,
                                          )
                                        }
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200"
                                        title="Hapus dari jadwal"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isFilled && (
                    <button
                      onClick={() => clearDayPlan(day.dateKey)}
                      className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
                    >
                      Hapus Semua Menu Hari Ini
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-forest-500" /> Hari aktif
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Hari terisi
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-300" /> Hari kosong
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu untuk drag ke piringku atau jadwal minggu"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
            {[
              { key: "all" as const, label: "Semua" },
              { key: "makanan" as const, label: "Makanan" },
              { key: "minuman" as const, label: "Minuman" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMenuTypeFilter(tab.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                  menuTypeFilter === tab.key
                    ? "bg-forest-900 text-white"
                    : "text-gray-600 hover:bg-white/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Memuat menu...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => {
              const protein = Number(m.protein || 0);
              const karbo = Number(m.karbohidrat || 0);
              const lemak = Number(m.lemak || 0);
              const isOnPlate = plateMenuIds.includes(m.id);
              const imageUrl = resolveMenuImageUrl(m.gambar_url);
              const menuType = resolvedMenuTypes[m.id] || "makanan";
              const menuPorsi =
                resolvedMenuPorsi[m.id] || inferMenuPorsi(m.kalori);
              const displayName = sanitizeMenuName(m.nama) || m.nama;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -3 }}
                  draggable
                  onDragStartCapture={(e) =>
                    handleCardDragStart(e, m.id, menuType)
                  }
                  onDragEnd={handleCardDragEnd}
                  className={`touch-pan-y cursor-grab overflow-hidden rounded-xl border bg-white transition-all active:cursor-grabbing ${
                    isOnPlate
                      ? "border-forest-400 shadow-md shadow-forest-100"
                      : "border-gray-200 hover:shadow-md"
                  } ${draggingMenuId === m.id ? "-rotate-1 scale-[0.99] ring-2 ring-forest-300 opacity-75 shadow-xl" : ""}`}
                  style={{ touchAction: "pan-y" }}
                >
                  <div className="relative h-28 overflow-hidden">
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
                    {isOnPlate && (
                      <span className="absolute right-2 top-2 rounded-full bg-forest-600 px-2 py-0.5 text-[9px] font-bold text-white">
                        Di Piringku
                      </span>
                    )}
                    <div className="absolute bottom-2 left-3 flex gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPorsiBadgeClass(menuPorsi)}`}
                      >
                        {getPorsiLabel(menuPorsi)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          menuType === "minuman"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {menuType === "minuman" ? "Minuman" : "Makanan"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-800">
                          {displayName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          Kategori {m.kategori} · {m.kalori ?? 0} kkal
                        </p>
                      </div>

                      <MiniDonut
                        protein={protein}
                        karbo={karbo}
                        lemak={lemak}
                        size={34}
                      />
                    </div>

                    <div className="mt-2 flex gap-1">
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

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-gray-400">
                        Seret card ini ke slot mingguan.
                      </p>

                      <div className="flex rounded-lg border border-gray-200 p-0.5">
                        {(["makanan", "minuman"] as MenuType[]).map((type) => (
                          <button
                            key={`${m.id}-${type}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuType(m.id, type);
                            }}
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              menuType === type
                                ? "bg-forest-100 text-forest-700"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {type === "minuman" ? "Minuman" : "Makanan"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-right">
          <button
            onClick={() => onNavigate("menu-catalog")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900"
          >
            Lihat Semua <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
