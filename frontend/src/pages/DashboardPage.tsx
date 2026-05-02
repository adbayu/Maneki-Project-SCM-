import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  Gauge,
  GlassWater,
  Search,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  CalorieIcon,
  CarboIcon,
  FatIcon,
  ProteinIcon,
} from "../components/icons/NutrientIcons";
import pregnantImage from "../assets/images/MBG-Posyandu-akuratnews.id_.jpeg";
import studentsImage from "../assets/images/Sekolah_Dasar.jpeg";
import type { ManualMacronutrient, Menu, MenuStats, PageView } from "../types";
import {
  getPorsiLabel,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  sanitizeMenuName,
  saveMenuMetaMap,
  type MenuMetaEntry,
  type MenuPorsi,
  type MenuType,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const HOLIDAY_API = "https://libur.deno.dev/api";
const WEEKLY_PLAN_STORAGE_KEY = "mbg_weekly_plan_v1";
const WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY = "mbg_weekly_plan_by_location_v1";
const SAVED_WEEKLY_LOCATION_STORAGE_KEY = "mbg_saved_weekly_location_v1";

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
type WeeklyPlanByLocation = Record<string, WeeklyPlan>;
type SavedScheduleMap = Record<string, string>;
type HolidayMap = Record<string, string>;
type MenuTypeMap = Record<number, MenuType>;
type MenuMetaMap = Record<number, MenuMetaEntry>;

interface WeekDay {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
}

const MANUAL_NUTRIENT_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#06b6d4",
  "#f43f5e",
];

function normalizeNutrientName(name: string) {
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function toShortLabel(name: string) {
  const compact = name.trim();
  if (!compact) return "Nt";
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }
  return compact.slice(0, 2).toUpperCase();
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
  const dayLabels = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

function getAkgStatus(percent: number) {
  // New green-based semantic scale per design spec
  if (percent < 70) {
    return {
      label: "Sangat Kurang",
      badgeClass: "border border-emerald-50 bg-emerald-50 text-emerald-700/50",
      textClass: "text-emerald-600/60",
      ringColor: "#dff6e8",
      barColor: "#dff6e8",
      hint: "Jauh di bawah target harian.",
    };
  }

  if (percent < 90) {
    return {
      label: "Cukup",
      badgeClass: "border border-emerald-100 bg-emerald-100 text-emerald-700",
      textClass: "text-emerald-700",
      ringColor: "#bbf7d0",
      barColor: "#86efac",
      hint: "Cukup mendekati target.",
    };
  }

  if (percent <= 110) {
    return {
      label: "Optimal",
      badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-800",
      textClass: "text-emerald-800",
      ringColor: "#34d399",
      barColor: "#10b981",
      hint: "Dalam kisaran optimal.",
    };
  }

  if (percent <= 120) {
    return {
      label: "Mulai Berlebih",
      badgeClass: "border border-emerald-700 bg-emerald-200 text-emerald-900",
      textClass: "text-emerald-900",
      ringColor: "#14532d",
      barColor: "#166534",
      hint: "Mulai melebihi rekomendasi.",
    };
  }

  return {
    label: "Terlalu Berlebih",
    badgeClass: "border border-emerald-900 bg-emerald-800 text-white",
    textClass: "text-emerald-950",
    ringColor: "#064e3b",
    barColor: "#064e3b",
    hint: "Signifikan melebihi target.",
  };
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
  insight: string;
  gradient: string;
  iconBg: string;
  icon: typeof UtensilsCrossed;
  watermarkColor: string;
}

const DISTRIBUTION_LOCATIONS = [
  {
    id: "sdn-01-sukamaju",
    type: "sekolah",
    recipients: [{ label: "Siswa", target: "320 siswa" }],
    image: studentsImage,
    name: "SD Negeri 01 Sukamaju",
    target: "320 siswa",
    schedule: "Sesi pagi",
    note: "Prioritas menu aktif dan porsi siswa dengan variasi lauk cukup.",
  },
  {
    id: "smpn-03-sukamaju",
    type: "sekolah",
    recipients: [{ label: "Siswa", target: "410 siswa" }],
    image: studentsImage,
    name: "SMP Negeri 03 Sukamaju",
    target: "410 siswa",
    schedule: "Sesi siang",
    note: "Cek rotasi protein agar menu tidak terasa berulang.",
  },
  {
    id: "posyandu-melati-balita",
    type: "posyandu",
    recipients: [
      { label: "Balita", target: "85 balita" },
      { label: "Ibu Hamil", target: "47 ibu hamil" },
    ],
    image: pregnantImage,
    name: "Posyandu Melati",
    target: "132 penerima",
    schedule: "Sesi timbang & edukasi",
    note: "Balita memakai porsi kecil bertekstur lembut; ibu hamil diprioritaskan protein, folat, dan sayur hijau.",
  },
  {
    id: "posyandu-mawar",
    type: "posyandu",
    recipients: [
      { label: "Balita", target: "58 balita" },
      { label: "Ibu Hamil", target: "62 ibu hamil" },
    ],
    image: pregnantImage,
    name: "Posyandu Mawar",
    target: "120 penerima",
    schedule: "Sesi PMT & konseling",
    note: "Balita dijaga tekstur dan energi; ibu hamil difokuskan pada protein, zat besi, dan energi cukup.",
  },
];

function getLocationRecipientLabel(
  location: (typeof DISTRIBUTION_LOCATIONS)[number],
) {
  return location.recipients.map((recipient) => recipient.label).join(" & ");
}

function getLocationTargetLabel(
  location: (typeof DISTRIBUTION_LOCATIONS)[number],
) {
  return location.recipients.map((recipient) => recipient.target).join(" + ");
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kelompok, setKelompok] = useState<Kelompok>("siswa");
  const [search, setSearch] = useState("");
  const [plateMenuSearch, setPlateMenuSearch] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [plateMenuIds, setPlateMenuIds] = useState<number[]>([]);
  const [activeLocationId, setActiveLocationId] = useState(
    DISTRIBUTION_LOCATIONS[0].id,
  );
  const [weeklyPlanByLocation, setWeeklyPlanByLocation] =
    useState<WeeklyPlanByLocation>({});
  const [savedScheduleMap, setSavedScheduleMap] = useState<SavedScheduleMap>(
    {},
  );
  const [menuMetaMap, setMenuMetaMap] = useState<MenuMetaMap>({});
  const [menuTypeFilter, setMenuTypeFilter] = useState<"all" | MenuType>("all");
  const [draggingMenuId, setDraggingMenuId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [plateManualMacrosMap, setPlateManualMacrosMap] = useState<
    Record<number, ManualMacronutrient[]>
  >({});
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showSaveScheduleConfirm, setShowSaveScheduleConfirm] = useState(false);
  const [showPlateMenuModal, setShowPlateMenuModal] = useState(false);
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});

  const openDistributionModal = () => {
    setShowDistributionModal(true);
  };

  const activeLocation =
    DISTRIBUTION_LOCATIONS.find(
      (location) => location.id === activeLocationId,
    ) || DISTRIBUTION_LOCATIONS[0];
  const weeklyPlan = weeklyPlanByLocation[activeLocationId] || {};
  const activeLocationRecipients = getLocationRecipientLabel(activeLocation);
  const activeLocationTargets = getLocationTargetLabel(activeLocation);

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
    let active = true;

    fetch(HOLIDAY_API)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!active || !Array.isArray(data)) return;

        const next: HolidayMap = {};
        data.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const holiday = item as { date?: unknown; name?: unknown };
          if (typeof holiday.date !== "string") return;
          next[holiday.date] =
            typeof holiday.name === "string" ? holiday.name : "Hari Libur";
        });
        setHolidayMap(next);
      })
      .catch((error) => {
        console.error("Gagal memuat tanggal merah:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const savedByLocation = localStorage.getItem(
        WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      );
      const savedStatus = localStorage.getItem(
        SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      );

      if (savedStatus) {
        const parsedStatus = JSON.parse(savedStatus);
        if (parsedStatus && typeof parsedStatus === "object") {
          setSavedScheduleMap(parsedStatus as SavedScheduleMap);
        }
      }

      if (savedByLocation) {
        const parsed = JSON.parse(savedByLocation) as Record<
          string,
          Record<string, unknown>
        >;
        if (parsed && typeof parsed === "object") {
          const normalizedByLocation: WeeklyPlanByLocation = {};
          Object.entries(parsed).forEach(([locationId, plan]) => {
            normalizedByLocation[locationId] = {};
            Object.entries(plan || {}).forEach(([dateKey, day]) => {
              normalizedByLocation[locationId][dateKey] = normalizeDayPlan(day);
            });
          });
          setWeeklyPlanByLocation(normalizedByLocation);
          return;
        }
      }

      const saved = localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const normalized: WeeklyPlan = {};
        Object.entries(parsed).forEach(([dateKey, day]) => {
          normalized[dateKey] = normalizeDayPlan(day);
        });
        setWeeklyPlanByLocation({
          [DISTRIBUTION_LOCATIONS[0].id]: normalized,
        });
      }
    } catch (error) {
      console.error("Gagal memuat jadwal mingguan:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      JSON.stringify(weeklyPlanByLocation),
    );
  }, [weeklyPlanByLocation]);

  useEffect(() => {
    localStorage.setItem(
      SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      JSON.stringify(savedScheduleMap),
    );
  }, [savedScheduleMap]);

  const weekDays = useMemo(() => getCurrentWeekDays(new Date()), []);
  const weekPeriod =
    weekDays.length > 0
      ? `${weekDays[0].dateLabel} - ${weekDays[weekDays.length - 1].dateLabel}`
      : "";
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

  const activeLocationSaved = Boolean(savedScheduleMap[activeLocationId]);

  const piringkuMenus = useMemo(
    () => menus.filter((m) => plateMenuIds.includes(m.id)),
    [menus, plateMenuIds],
  );

  useEffect(() => {
    const missingIds = plateMenuIds.filter((id) => !plateManualMacrosMap[id]);
    if (missingIds.length === 0) return;

    let active = true;

    Promise.all(
      missingIds.map((menuId) =>
        fetch(`${API}/${menuId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({
            menuId,
            manual: Array.isArray(data?.manual_macronutrients)
              ? (data.manual_macronutrients as ManualMacronutrient[])
              : [],
          }))
          .catch(() => ({ menuId, manual: [] as ManualMacronutrient[] })),
      ),
    ).then((results) => {
      if (!active) return;

      setPlateManualMacrosMap((prev) => {
        const next = { ...prev };
        results.forEach((item) => {
          next[item.menuId] = item.manual;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [plateManualMacrosMap, plateMenuIds]);

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

  const plateAkgPercent = Math.max(
    0,
    Math.round((plateNutrition.kalori / STANDAR[kelompok].kalori) * 100),
  );
  const plateAkgStatus = getAkgStatus(plateAkgPercent);

  const microStatus = useMemo(() => {
    const dynamicMap: Record<
      string,
      {
        key: string;
        abbr: string;
        label: string;
        unit: string;
        color: string;
        value: number;
        statusLabel: string;
        statusClass: string;
      }
    > = {};

    let paletteIndex = 0;

    piringkuMenus.forEach((menu) => {
      const manualList =
        plateManualMacrosMap[menu.id] || menu.manual_macronutrients || [];

      manualList.forEach((macro) => {
        const normalized = normalizeNutrientName(macro.nama || "");
        if (!normalized) return;

        const numericValue = Number(macro.nilai || 0);
        if (!Number.isFinite(numericValue)) return;

        if (!dynamicMap[normalized]) {
          const color =
            MANUAL_NUTRIENT_COLORS[
              paletteIndex % MANUAL_NUTRIENT_COLORS.length
            ];
          paletteIndex += 1;

          dynamicMap[normalized] = {
            key: `manual-${normalized.replace(/\s+/g, "-")}`,
            abbr: toShortLabel(macro.nama || "Nutrien"),
            label: macro.nama || "Nutrien Tambahan",
            unit: macro.satuan || "g",
            color,
            value: 0,
            statusLabel: "Baik",
            statusClass: "text-emerald-600",
          };
        }

        dynamicMap[normalized].value += numericValue;
      });
    });

    const dynamicFields = Object.values(dynamicMap);
    const maxValue = dynamicFields.reduce(
      (max, item) => Math.max(max, item.value),
      0,
    );

    return dynamicFields.map((item) => {
      if (item.value <= 0 || maxValue <= 0) {
        return {
          ...item,
          statusLabel: "Kurang",
          statusClass: "text-emerald-400",
        };
      }

      const ratio = item.value / maxValue;
      if (ratio >= 0.8) {
        return {
          ...item,
          statusLabel: "Baik",
          statusClass: "text-emerald-600",
        };
      }

      if (ratio >= 0.5) {
        return {
          ...item,
          statusLabel: "Cukup",
          statusClass: "text-emerald-600",
        };
      }

      return {
        ...item,
        statusLabel: "Kurang",
        statusClass: "text-emerald-400",
      };
    });
  }, [piringkuMenus, plateManualMacrosMap]);

  const plateNote =
    plateAkgStatus.label === "Optimal"
      ? "Komposisi sudah optimal, pertahankan keseimbangan dan variasikan sumber sayur serta buah."
      : plateAkgStatus.label === "Cukup"
        ? "Komposisi sudah mendekati target. Tambahkan lauk atau sumber energi sesuai kebutuhan penerima."
        : plateAkgStatus.label === "Sangat Kurang"
          ? "Komposisi masih terlalu rendah. Tambahkan lauk, sayur, dan sumber energi agar piring lebih seimbang."
          : plateAkgStatus.label === "Mulai Berlebih"
            ? "Komposisi mulai melewati target. Kurangi porsi sumber energi atau lemak sebelum distribusi."
            : "Komposisi terlalu tinggi untuk target ini. Sesuaikan porsi agar tetap aman dan mudah diterapkan.";

  const plateTip =
    "Padukan protein hewani, sayur hijau, dan buah warna-warni untuk menyeimbangkan piring dengan cara yang mudah dipahami.";

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

    setWeeklyPlanByLocation((prevByLocation) => {
      const prev = prevByLocation[activeLocationId] || {};
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const current = dayPlan[typeKey];
      if (current.includes(menuId)) return prevByLocation;

      const nextPlan = {
        ...prev,
        [dateKey]: {
          ...dayPlan,
          [typeKey]: [...current, menuId].slice(-4),
        },
      };

      return {
        ...prevByLocation,
        [activeLocationId]: nextPlan,
      };
    });
  };

  const removeMenuFromDay = (
    dateKey: string,
    type: MenuType,
    menuId: number,
  ) => {
    const typeKey = toTypeKey(type);

    setWeeklyPlanByLocation((prevByLocation) => {
      const prev = prevByLocation[activeLocationId] || {};
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const updated = dayPlan[typeKey].filter((id) => id !== menuId);
      const nextPlan = {
        ...prev,
        [dateKey]: {
          ...dayPlan,
          [typeKey]: updated,
        },
      };

      return {
        ...prevByLocation,
        [activeLocationId]: nextPlan,
      };
    });
  };

  const clearDayPlan = (dateKey: string) => {
    setWeeklyPlanByLocation((prevByLocation) => ({
      ...prevByLocation,
      [activeLocationId]: {
        ...(prevByLocation[activeLocationId] || {}),
        [dateKey]: createEmptyDayPlan(),
      },
    }));
  };

  const getMenusByDay = (dateKey: string, type: MenuType) => {
    const dayPlan = normalizeDayPlan(weeklyPlan[dateKey]);
    const ids = dayPlan[toTypeKey(type)];
    return ids
      .map((id) => menuLookup.get(id))
      .filter((menu): menu is Menu => Boolean(menu));
  };

  const selectDistributionLocation = (locationId: string) => {
    setActiveLocationId(locationId);
    setShowDistributionModal(false);
  };

  const confirmSaveWeeklySchedule = () => {
    setSavedScheduleMap((prev) => ({
      ...prev,
      [activeLocationId]: new Date().toISOString(),
    }));
    setShowSaveScheduleConfirm(false);
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

  const plateMenuOptions = useMemo(() => {
    const q = plateMenuSearch.trim().toLowerCase();
    if (!q) return menus;
    return menus.filter((menu) => {
      const cleanName = sanitizeMenuName(menu.nama).toLowerCase();
      return (
        cleanName.includes(q) ||
        menu.nama.toLowerCase().includes(q) ||
        menu.kategori.toLowerCase().includes(q)
      );
    });
  }, [menus, plateMenuSearch]);

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayDateNumber = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
  });
  const todayMonthYear = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const summaryWidgets: SummaryWidget[] = useMemo(() => {
    if (!stats) return [];

    const totalMenus = Number(stats.total_menus || 0);
    const locationCount = DISTRIBUTION_LOCATIONS.length;
    const savedLocationCount = Object.keys(savedScheduleMap).length;

    return [
      {
        title: "Total Menu",
        value: totalMenus,
        subtitle: "Seluruh menu tercatat",
        insight:
          totalMenus > 0
            ? "Basis variasi menu tersedia."
            : "Tambahkan menu pertama.",
        gradient: "from-forest-950 via-forest-900 to-forest-700",
        iconBg: "bg-white/10",
        icon: UtensilsCrossed,
        watermarkColor: "text-white/8",
      },
      {
        title: "Lokasi Distribusi",
        value: locationCount,
        subtitle: activeLocation.name,
        insight: `${activeLocationRecipients} - ${activeLocationTargets}`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Users,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Jadwal Tersimpan",
        value: `${savedLocationCount}/${locationCount}`,
        subtitle: "Lokasi sudah dijadwalkan",
        insight: activeLocationSaved
          ? "Lokasi aktif sudah tersimpan."
          : "Lokasi aktif belum disimpan.",
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: CheckCircle2,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Kategori MBG",
        value: "5",
        subtitle: "Siswa, Balita, Ibu Hamil",
        insight: "Segmentasi porsi tetap terjaga.",
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Users,
        watermarkColor: "text-forest-100",
      },
    ];
  }, [
    activeLocation.name,
    activeLocationRecipients,
    activeLocationSaved,
    activeLocationTargets,
    savedScheduleMap,
    stats,
  ]);

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
    e.dataTransfer.setDragImage(
      ghost,
      Math.max(18, e.clientX - rect.left),
      Math.max(18, e.clientY - rect.top),
    );
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
      className="page-shell space-y-6"
    >
      <div className="page-header">
        <div>
          <span className="soft-badge">Operations Overview</span>
          <h1 className="page-title mt-4">Dashboard MBG</h1>
          <p className="page-subtitle">
            Pantau menu, evaluasi nutrisi, dan susun jadwal mingguan dalam satu
            workspace yang lebih lega dan fokus.
          </p>
        </div>
        <div className="card min-w-[220px] rounded-[30px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Tanggal Hari Ini
              </p>
              <p className="mt-2 text-5xl font-black leading-none text-forest-900">
                {todayDateNumber}
              </p>
              <p className="mt-2 text-sm font-semibold text-ink-700">
                {todayMonthYear}
              </p>
              <p className="mt-1 text-xs text-ink-400">{today}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-forest-50 text-forest-800">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryWidgets.map((widget, idx) => {
          const Icon = widget.icon;
          const isPrimary = idx === 0;
          return (
            <motion.div
              key={widget.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`relative cursor-default overflow-hidden rounded-[30px] border p-6 transition-all hover:-translate-y-1 ${
                isPrimary
                  ? `bg-linear-to-br ${widget.gradient} border-white/10 text-white shadow-[0_24px_54px_rgba(23,59,35,0.22)]`
                  : `bg-linear-to-br ${widget.gradient} border-ink-100 text-ink-700 shadow-[0_16px_36px_rgba(36,49,39,0.07)]`
              }`}
            >
              <Icon
                className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${widget.watermarkColor}`}
              />
              <div
                className={`absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full ${
                  isPrimary ? "bg-white/5" : "bg-forest-50"
                }`}
              />

              <div className="relative z-10">
                <div className="mb-3 flex items-center justify-between">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isPrimary ? "text-white/70" : "text-ink-400"
                    }`}
                  >
                    {widget.title}
                  </p>
                  <div className={`${widget.iconBg} rounded-xl p-2`}>
                    <Icon
                      className={`h-4 w-4 ${isPrimary ? "text-white" : "text-forest-800"}`}
                    />
                  </div>
                </div>
                <p className="mb-1 text-3xl font-black leading-tight">
                  {widget.value}
                </p>
                <p
                  className={`text-sm font-medium leading-5 ${
                    isPrimary ? "text-white/60" : "text-ink-400"
                  }`}
                >
                  {widget.subtitle}
                </p>
                <p
                  className={`mt-3 border-t pt-3 text-xs font-semibold leading-5 ${
                    isPrimary
                      ? "border-white/10 text-white/72"
                      : "border-forest-100 text-forest-800"
                  }`}
                >
                  {widget.insight}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card rounded-4xl border border-ink-100/60 bg-white/90 p-5 shadow-sm"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Personal Plate Monitor
              </p>
              <h2 className="mt-2 text-lg font-bold text-ink-700">
                Monitor Piringku vs AKG 2019
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-400">
                Pilih menu atau seret kartu dari daftar bawah ke area piringku.
              </p>
            </div>
            <div className="rounded-[20px] border border-forest-100 bg-forest-50 px-4 py-3 text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/70">
                Target
              </p>
              <p className="mt-1 text-sm font-semibold text-forest-900">
                {STANDAR[kelompok].label}
              </p>
            </div>
          </div>

          <div className="pill-toggle mb-4 rounded-[22px] border border-ink-100 bg-white p-1">
            {(Object.keys(STANDAR) as Kelompok[]).map((k) => (
              <button
                key={k}
                onClick={() => setKelompok(k)}
                data-active={kelompok === k}
                className="flex-1"
              >
                {STANDAR[k].label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <button
              onClick={() => setShowPlateMenuModal(true)}
              className="flex items-center justify-between rounded-[18px] border border-ink-100 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-forest-200 hover:bg-forest-50"
            >
              <span className="font-semibold">
                {selectedMenuId
                  ? sanitizeMenuName(
                      menuLookup.get(selectedMenuId)?.nama || "Pilih menu",
                    )
                  : "Pilih menu untuk Piringku"}
              </span>
              <Search className="h-4 w-4 text-forest-700" />
            </button>
            <button
              onClick={() => selectedMenuId && addMenu(selectedMenuId)}
              className="btn-primary px-4 py-3 text-sm"
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
            className="mb-5 flex min-h-16 flex-wrap gap-2 rounded-[24px] border border-dashed border-forest-300 bg-[linear-gradient(180deg,#f7fbf7_0%,#ffffff_100%)] p-4"
          >
            {piringkuMenus.map((m) => {
              const thumbUrl = resolveMenuImageUrl(m.gambar_url);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-[22px] border border-ink-100 bg-white px-3 py-2.5 text-[12px] shadow-sm"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={sanitizeMenuName(m.nama) || m.nama}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                      <ChefHat className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-gray-700">
                      {sanitizeMenuName(m.nama) || m.nama}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {m.kalori ?? 0} kkal
                    </p>
                  </div>
                  <button
                    onClick={() => removeMenu(m.id)}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-900"
                    title="Hapus dari Piringku"
                  >
                    <X className="h-4 w-4" />
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

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-ink-100 bg-white/85 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    Ringkasan Gizi
                  </p>
                  <h3 className="mt-1 text-base font-bold text-ink-700">
                    Total AKG Harian
                  </h3>
                </div>
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${plateAkgStatus.badgeClass}`}
                >
                  {plateAkgStatus.label}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[0.88fr_1.12fr]">
                <div className="rounded-3xl border border-forest-100 bg-linear-to-b from-forest-50 to-white px-4 py-5 text-center">
                  <motion.div
                    className="relative mx-auto flex h-48 w-48 items-center justify-center"
                    animate={{ scale: plateNutrition.kalori > 0 ? 1 : 0.98 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <svg viewBox="0 0 44 44" className="h-48 w-48 -rotate-90">
                      <circle
                        cx="22"
                        cy="22"
                        r="18.5"
                        fill="none"
                        stroke="#e5efe5"
                        strokeWidth="6"
                      />
                      <motion.circle
                        cx="22"
                        cy="22"
                        r="18.5"
                        fill="none"
                        stroke={plateAkgStatus.ringColor}
                        strokeLinecap="round"
                        strokeWidth="6"
                        initial={{ pathLength: 0 }}
                        animate={{
                          pathLength: Math.min(1, plateAkgPercent / 100),
                        }}
                        transition={{ duration: 0.85, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-forest-700 shadow-sm">
                        <Gauge className="h-5 w-5" />
                      </div>
                      <motion.p
                        key={plateAkgPercent}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className={`mt-2 text-4xl font-black ${plateAkgStatus.textClass}`}
                      >
                        {plateAkgPercent}%
                      </motion.p>
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${plateAkgStatus.textClass}`}
                      >
                        {plateAkgStatus.label}
                      </p>
                    </div>
                  </motion.div>
                  <p className="mt-3 text-sm font-semibold text-ink-700">
                    {Math.round(plateNutrition.kalori)} /{" "}
                    {STANDAR[kelompok].kalori} kkal
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-400">
                    Disesuaikan dengan standar {STANDAR[kelompok].label}.
                  </p>
                </div>

                <div className="space-y-3 rounded-3xl border border-ink-100 bg-white/80 p-4 shadow-sm">
                  {rows.map((r) => {
                    const pct = Math.max(
                      0,
                      Math.round((r.val / r.target) * 100),
                    );
                    const status = getAkgStatus(pct);

                    return (
                      <div
                        key={r.label}
                        className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-800">
                              {r.label === "Kalori" ? (
                                <CalorieIcon className="h-4 w-4" />
                              ) : r.label === "Protein" ? (
                                <ProteinIcon className="h-4 w-4" />
                              ) : r.label === "Lemak" ? (
                                <FatIcon className="h-4 w-4" />
                              ) : (
                                <CarboIcon className="h-4 w-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-700">
                                {r.label}
                              </p>
                              <p className="text-[11px] leading-5 text-gray-400">
                                {Math.round(r.val)} / {r.target} {r.unit} -{" "}
                                {status.hint}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.badgeClass}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="progress-bar mt-2 h-2">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: status.barColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-2xl border border-forest-100 bg-forest-50/70 px-4 py-3 text-sm text-forest-800">
                    <p className="font-semibold">
                      {plateAkgStatus.label === "Optimal"
                        ? "Komposisi sudah optimal"
                        : plateAkgStatus.label === "Cukup"
                          ? "Komposisi sudah mendekati target"
                          : plateAkgStatus.label === "Mulai Berlebih" ||
                              plateAkgStatus.label === "Terlalu Berlebih"
                            ? "Komposisi perlu dikurangi"
                            : "Komposisi masih perlu dilengkapi"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-forest-700/80">
                      {plateNote}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-ink-100 bg-linear-to-b from-white to-forest-50/70 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    Komposisi Makronutrien
                  </p>
                  <h3 className="mt-1 text-base font-bold text-ink-700">
                    Rasio Makro Harian
                  </h3>
                </div>
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-forest-700 shadow-sm">
                  {Math.round(macroTotal)} g total
                </div>
              </div>

              <div className="flex items-center gap-4">
                <svg viewBox="0 0 42 42" className="h-32 w-32">
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

                <div className="min-w-0 flex-1 space-y-3">
                  {slices.map((s) => {
                    const pct =
                      macroTotal > 0
                        ? Math.round((s.value / macroTotal) * 100)
                        : 0;
                    const kcal =
                      s.key === "lemak"
                        ? Math.round(s.value * 9)
                        : Math.round(s.value * 4);

                    return (
                      <div
                        key={s.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700">
                            {s.label}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {Math.round(s.value)} g
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700">
                            {pct}%
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {kcal} kkal
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mt-4 rounded-2xl border border-forest-100 bg-white px-4 py-3 mb-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-forest-800">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-100 text-forest-700">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    Komposisi makro sesuai anjuran
                  </div>

                  <p className="mt-1 text-xs leading-5 text-forest-700/80">
                    Rasio makro dalam rentang yang dianjurkan untuk{" "}
                    {STANDAR[kelompok].label.toLowerCase()}.
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-forest-100 bg-white px-4 py-3 mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700/80">
                        Catatan
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-amber-900/80">
                    {plateNote}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-forest-100 bg-white px-4 py-3 mb-5">
                  <div className="mb-3 flex items-center gap-2 text-forest-800">
                    <TrendingUp className="h-4 w-4" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em]">
                      Tips
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-forest-800/80">
                    {plateTip}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5">
            <div className="rounded-3xl border border-ink-100 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                    Makronutrien
                  </p>
                </div>
              </div>

              {microStatus.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  Belum ada makronutrien manual pada menu yang sedang ada di
                  Piringku.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {microStatus.map((field) => {
                    const shownValue = Math.round(field.value * 10) / 10;

                    return (
                      <div
                        key={field.key}
                        className="rounded-2xl border bg-white p-3 shadow-sm"
                        style={{ borderColor: `${field.color}30` }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: `${field.color}18`,
                              color: field.color,
                            }}
                          >
                            <span className="text-[9px] font-black uppercase">
                              {field.abbr}
                            </span>
                          </div>
                          <p className="truncate text-xs font-semibold text-gray-700">
                            {field.label}
                          </p>
                        </div>

                        <p className="text-2xl font-black text-gray-800">
                          {shownValue}
                          <span className="ml-1 text-xs font-semibold text-gray-400">
                            {field.unit}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card rounded-4xl p-4 xl:self-start xl:p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-2xl bg-forest-50 p-2.5">
              <Gauge className="h-5 w-5 text-forest-800" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Average Nutrition
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                Rata-rata Nutrisi
              </h2>
              <p className="text-sm text-gray-400">
                Dari seluruh menu yang tersedia
              </p>
            </div>
          </div>

          {stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                    <div
                      key={row.label}
                      className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
                    >
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
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Distribusi Kategori
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.per_kategori?.map((k) => (
                    <div
                      key={k.kategori}
                      className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5"
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
        </motion.div> */}
      </div>

      <div className="card rounded-[32px] p-5 sm:p-6">
        <div className="mb-5 rounded-[28px] border border-forest-200/70 bg-[linear-gradient(180deg,#f7fbf6_0%,#ffffff_100%)] p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                Widget Mingguan
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-800">
                Susun Jadwal Menu Senin - Sabtu
              </h3>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Jadwal aktif untuk{" "}
                <span className="font-semibold text-forest-800">
                  {activeLocation.name}
                </span>{" "}
                ({activeLocationRecipients}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-forest-100 bg-white px-4 py-2 text-xs font-semibold text-forest-700 shadow-sm">
                {totalScheduledCount} menu terjadwal
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm ${
                  activeLocationSaved
                    ? "border-forest-200 bg-forest-50 text-forest-800"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {activeLocationSaved ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="h-3.5 w-3.5" />
                )}
                {activeLocationSaved
                  ? "Sudah dijadwalkan"
                  : "Belum dijadwalkan"}
              </span>
              <button
                onClick={() => openDistributionModal()}
                className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-white px-4 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-50"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Lokasi Distribusi
              </button>
              <button
                onClick={() => setShowSaveScheduleConfirm(true)}
                className="inline-flex items-center gap-1 rounded-full border border-forest-700 bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-forest-900"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Simpan Jadwal Mingguan
              </button>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-[26px] border border-forest-100 bg-white shadow-sm">
            <div className="relative min-h-[150px] p-5">
              <div className="relative z-10 max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                  Lokasi Distribusi
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-forest-100 bg-forest-50 text-forest-800 shadow-sm">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xl font-bold text-gray-800">
                      {activeLocation.name}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeLocation.recipients.map((recipient) => (
                        <span
                          key={recipient.label}
                          className="rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800"
                        >
                          {recipient.label}: {recipient.target}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-500">
                      Periode {weekPeriod}. {activeLocation.note}
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden md:block">
                <img
                  src={activeLocation.image}
                  alt={activeLocation.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-r from-white via-white/72 to-white/5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {weekDays.map((day) => {
              const holidayName = holidayMap[day.dateKey];
              const isHoliday = Boolean(holidayName);
              const dayPlan = normalizeDayPlan(weeklyPlan[day.dateKey]);
              const totalDayItems =
                dayPlan.makananIds.length + dayPlan.minumanIds.length;
              const isFilled = totalDayItems > 0;

              return (
                <div
                  key={day.dateKey}
                  className={`min-h-[250px] rounded-[24px] border p-3 transition-all ${
                    isHoliday
                      ? "border-red-200 bg-red-50/45"
                      : day.isToday
                        ? "border-forest-500 bg-white shadow-[0_18px_32px_rgba(46,125,50,0.10)]"
                        : isFilled
                          ? "border-forest-200 bg-forest-50/35"
                          : "border-gray-200 bg-white/90"
                  } hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          day.isToday ? "text-forest-800" : "text-gray-700"
                        }`}
                      >
                        {day.dayLabel}
                      </p>
                      <p className="text-xs text-gray-400">{day.dateLabel}</p>
                      <p className="mt-1 text-[10px] font-medium text-forest-700/70">
                        {activeLocation.name}
                      </p>
                    </div>

                    {day.isToday && (
                      <span className="rounded-full bg-forest-100 px-2 py-1 text-[10px] font-bold text-forest-700">
                        Hari Ini
                      </span>
                    )}
                    {isHoliday && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                        <CalendarDays className="h-3 w-3" />
                        Libur
                      </span>
                    )}
                  </div>

                  {isHoliday ? (
                    <div className="flex min-h-[176px] flex-col items-center justify-center rounded-[20px] border border-dashed border-red-200 bg-white/70 px-3 py-5 text-center">
                      <CalendarDays className="mb-3 h-8 w-8 text-red-500" />
                      <p className="text-sm font-black uppercase tracking-[0.08em] text-red-600">
                        Libur
                      </p>
                      <p className="mt-2 text-xs leading-5 text-red-500">
                        {holidayName}
                      </p>
                    </div>
                  ) : (
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
                              e.stopPropagation();
                              setDragOverTarget(dropTargetKey);
                            }}
                            onDragLeave={() => {
                              if (dragOverTarget === dropTargetKey) {
                                setDragOverTarget(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const menuId = Number(
                                e.dataTransfer.getData("menu-id"),
                              );
                              if (menuId) {
                                assignMenuToDay(day.dateKey, menuId, slot.type);
                                setMenuType(menuId, slot.type);
                              }
                              setDragOverTarget(null);
                            }}
                            className={`rounded-[18px] border px-2.5 py-2.5 transition-all ${slot.sectionClass} ${
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
                                      className="rounded-[14px] border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md"
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
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeMenuFromDay(
                                                day.dateKey,
                                                slot.type,
                                                menu.id,
                                              );
                                            }}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            title="Hapus dari jadwal"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
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
                  )}

                  {!isHoliday && isFilled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDayPlan(day.dateKey);
                      }}
                      className="mt-3 w-full rounded-[16px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
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
            <span className="inline-flex items-center gap-1 text-red-600">
              <CalendarDays className="h-3.5 w-3.5" /> Libur
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
              className="flex-1 px-4 py-3 text-sm"
            />
          </div>

          <div className="pill-toggle">
            {[
              { key: "all" as const, label: "Semua" },
              { key: "makanan" as const, label: "Makanan" },
              { key: "minuman" as const, label: "Minuman" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMenuTypeFilter(tab.key)}
                data-active={menuTypeFilter === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Memuat menu...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
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
                    handleCardDragStart(
                      e as DragEvent<HTMLDivElement>,
                      m.id,
                      menuType,
                    )
                  }
                  onDragEnd={handleCardDragEnd}
                  className={`touch-pan-y cursor-grab overflow-hidden rounded-[24px] border bg-white transition-all active:cursor-grabbing ${
                    isOnPlate
                      ? "border-forest-400 shadow-md shadow-forest-100"
                      : "border-gray-200 hover:shadow-md"
                  } ${draggingMenuId === m.id ? "-rotate-1 scale-[0.985] ring-2 ring-forest-300 opacity-80 shadow-xl" : ""}`}
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
                        <p className="mt-0.5 text-[11px] text-gray-500 inline-flex items-center gap-2">
                          Kategori {m.kategori} ·{" "}
                          <CalorieIcon className="h-3 w-3 text-orange-600" />{" "}
                          {m.kalori ?? 0} kkal
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

      {showPlateMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                    Pilih Menu Piringku
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-800">
                    Tambahkan Menu
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Cari menu, lihat ringkas nutrisi, lalu pilih untuk Piringku.
                  </p>
                </div>
                <button
                  onClick={() => setShowPlateMenuModal(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
                  title="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={plateMenuSearch}
                  onChange={(e) => setPlateMenuSearch(e.target.value)}
                  placeholder="Cari nama menu atau kategori"
                  className="w-full py-3 pl-11 pr-4 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              {plateMenuOptions.map((menu) => {
                const imageUrl = resolveMenuImageUrl(menu.gambar_url);
                const displayName = sanitizeMenuName(menu.nama) || menu.nama;
                const isSelected = selectedMenuId === menu.id;

                return (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setSelectedMenuId(menu.id);
                      setShowPlateMenuModal(false);
                    }}
                    className={`overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md ${
                      isSelected
                        ? "border-forest-400 ring-2 ring-forest-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="relative h-32 overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
                          <ChefHat className="h-9 w-9" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
                      <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-forest-800">
                        {menu.kategori}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="truncate text-sm font-bold text-gray-800">
                        {displayName}
                      </p>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                        {[
                          {
                            label: "Kal",
                            value: menu.kalori ?? 0,
                            unit: "kkal",
                          },
                          { label: "Pro", value: menu.protein ?? 0, unit: "g" },
                          { label: "Lem", value: menu.lemak ?? 0, unit: "g" },
                          {
                            label: "Kar",
                            value: menu.karbohidrat ?? 0,
                            unit: "g",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl bg-forest-50 px-2 py-2 text-center"
                          >
                            <p className="font-bold text-forest-800">
                              {item.value}
                            </p>
                            <p className="mt-0.5 text-[9px] text-gray-500">
                              {item.label} {item.unit}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showDistributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-4xl rounded-[28px] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                  Lokasi Distribusi
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-800">
                  Pilih Lokasi Jadwal
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Klik lokasi untuk mengubah konteks Widget Mingguan tanpa
                  berpindah halaman.
                </p>
              </div>
              <button
                onClick={() => setShowDistributionModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-forest-100 bg-forest-50/70 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Lokasi
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {DISTRIBUTION_LOCATIONS.length}
                </p>
              </div>
              <div className="rounded-[20px] border border-forest-100 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Sekolah
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {
                    DISTRIBUTION_LOCATIONS.filter(
                      (location) => location.type === "sekolah",
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-[20px] border border-forest-100 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Posyandu
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  Balita & Ibu Hamil
                </p>
              </div>
            </div>

            <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {DISTRIBUTION_LOCATIONS.map((location) => {
                const isSelected = location.id === activeLocationId;
                const isScheduled = Boolean(savedScheduleMap[location.id]);

                return (
                  <div
                    key={location.id}
                    onClick={() => selectDistributionLocation(location.id)}
                    className={`cursor-pointer overflow-hidden rounded-[22px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md ${
                      isSelected
                        ? "border-forest-400 ring-2 ring-forest-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="relative h-28 overflow-hidden bg-[linear-gradient(180deg,#edf2ed_0%,#f7f9f7_100%)]">
                      {location.image ? (
                        <img
                          src={location.image}
                          alt={location.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <ChefHat className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/5 to-transparent" />
                      <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                          {location.type === "sekolah" ? "Sekolah" : "Posyandu"}
                        </span>
                        <span className="rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {getLocationRecipientLabel(location)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="truncate text-sm font-bold text-gray-800">
                          {location.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-forest-700">
                          {getLocationTargetLabel(location)} •{" "}
                          {location.schedule}
                        </p>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                          isScheduled
                            ? "border-forest-200 bg-forest-50 text-forest-800"
                            : "border-gray-200 bg-white text-gray-500"
                        }`}
                      >
                        {isScheduled ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock3 className="h-3 w-3" />
                        )}
                        {isScheduled
                          ? "Sudah dijadwalkan"
                          : "Belum dijadwalkan"}
                      </div>
                      <div className="rounded-[16px] border border-forest-100 bg-forest-50/70 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                          Catatan
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          {location.note}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showSaveScheduleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-forest-50 text-forest-800">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Simpan Jadwal?
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Apakah Anda yakin ingin menyimpan jadwal untuk lokasi ini?
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-forest-100 bg-forest-50/70 px-4 py-3">
              <p className="text-xs font-semibold text-forest-800">
                {activeLocation.name} • {activeLocationRecipients}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowSaveScheduleConfirm(false)}
                className="btn-secondary flex-1 px-3 py-3 text-sm"
              >
                Batal
              </button>
              <button
                onClick={confirmSaveWeeklySchedule}
                className="flex-1 rounded-[18px] bg-forest-800 px-3 py-3 text-sm font-semibold text-white transition hover:bg-forest-900"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
