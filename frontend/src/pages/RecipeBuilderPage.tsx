import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChefHat,
  Clock3,
  Database,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import type {
  GeneratedMenu,
  MenuIngredient,
  MenuKategori,
  MenuNutrition,
  PageView,
} from "../types";
import {
  appendMenuEditLogs,
  clearEditTargetMenuId,
  createMenuEditLogEntry,
  getEditTargetMenuId,
  getMenuEditLogs,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  sanitizeMenuName,
  setMenuMeta,
  type MenuEditLogEntry,
  type MenuPorsi,
  type MenuType,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const KATEGORIS: MenuKategori[] = ["Siswa", "Balita", "Ibu Hamil"];
const SATUANS = [
  "g",
  "kg",
  "ml",
  "liter",
  "butir",
  "buah",
  "sdm",
  "sdt",
  "lembar",
];

const MENU_TYPES: Array<{ key: MenuType; label: string }> = [
  { key: "makanan", label: "Makanan" },
  { key: "minuman", label: "Minuman" },
];

const MENU_PORSI: Array<{ key: MenuPorsi; label: string }> = [
  { key: "porsi_kecil", label: "Porsi Kecil" },
  { key: "porsi_besar", label: "Porsi Besar" },
];

type PorsiTarget = "porsi_kecil" | "porsi_besar";
const PORSI_LABELS: { key: PorsiTarget; label: string }[] = [
  { key: "porsi_kecil", label: "Porsi Kecil" },
  { key: "porsi_besar", label: "Porsi Besar" },
];

interface RecipeBuilderPageProps {
  onNavigate: (p: PageView) => void;
}

interface OriginalMenuSnapshot {
  nama: string;
  kategori: MenuKategori;
  menuType: MenuType;
  menuPorsi: MenuPorsi;
  hargaJual: number;
  ingredientCount: number;
  nutrition: MenuNutrition;
}

const emptyIng: MenuIngredient = {
  nama_bahan: "",
  jumlah: 0,
  satuan: "g",
  harga_satuan: 0,
};

const emptyNut: MenuNutrition = {
  kalori: 0,
  protein: 0,
  lemak: 0,
  karbohidrat: 0,
  serat: 0,
  gula: 0,
};

function resolveMenuImageUrl(gambarUrl: string | null | undefined) {
  if (!gambarUrl) return null;
  if (gambarUrl.startsWith("http://") || gambarUrl.startsWith("https://")) {
    return gambarUrl;
  }
  return `${API_ORIGIN}${gambarUrl}`;
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeNutrition(
  input?: Partial<MenuNutrition> | null,
): MenuNutrition {
  return {
    kalori: toNumber(input?.kalori),
    protein: toNumber(input?.protein),
    lemak: toNumber(input?.lemak),
    karbohidrat: toNumber(input?.karbohidrat),
    serat: toNumber(input?.serat),
    gula: toNumber(input?.gula),
  };
}

function formatLogTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecipeBuilderPage({
  onNavigate,
}: RecipeBuilderPageProps) {
  // Form state
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState<MenuKategori>("Siswa");
  const [menuType, setMenuType] = useState<MenuType>("makanan");
  const [menuPorsi, setMenuPorsi] = useState<MenuPorsi>("porsi_kecil");
  const [hargaJual, setHargaJual] = useState(0);
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([
    { ...emptyIng },
  ]);
  const [nutrition, setNutrition] = useState<MenuNutrition>({ ...emptyNut });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Edit mode state
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] =
    useState<OriginalMenuSnapshot | null>(null);
  const [editLogs, setEditLogs] = useState<MenuEditLogEntry[]>([]);

  // Optional image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // AI Generate state
  const [aiKelompok, setAiKelompok] = useState<PorsiTarget>("porsi_kecil");
  const [aiIngText, setAiIngText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<GeneratedMenu | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    const editId = getEditTargetMenuId();
    if (!editId) return;

    setEditingMenuId(editId);
    setLoadingEdit(true);

    fetch(`${API}/${editId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const menu = data as {
          id: number;
          nama: string;
          kategori: MenuKategori;
          harga_jual?: number;
          deskripsi?: string | null;
          gambar_url?: string | null;
          kalori?: number;
          ingredients?: MenuIngredient[];
          nutrition?: MenuNutrition | null;
        };

        const cleanName = sanitizeMenuName(menu.nama || "");
        const loadedIngredients = Array.isArray(menu.ingredients)
          ? menu.ingredients.map((item) => ({
              ...item,
              jumlah: toNumber(item.jumlah),
              harga_satuan: toNumber(item.harga_satuan),
            }))
          : [];

        const normalizedIng =
          loadedIngredients.length > 0 ? loadedIngredients : [{ ...emptyIng }];
        const normalizedNut = normalizeNutrition(menu.nutrition);

        setNama(cleanName);
        setKategori(menu.kategori || "Siswa");
        setHargaJual(toNumber(menu.harga_jual));
        setIngredients(normalizedIng);
        setNutrition(normalizedNut);
        setImageFile(null);
        setImagePreview(resolveMenuImageUrl(menu.gambar_url || null));

        const metaMap = loadMenuMetaMap();
        const resolvedType =
          metaMap[editId]?.type ||
          inferMenuType({
            nama: menu.nama || "",
            deskripsi: menu.deskripsi || "",
          });
        const resolvedPorsi =
          metaMap[editId]?.porsi ||
          inferMenuPorsi(normalizedNut.kalori || menu.kalori || 0);

        setMenuType(resolvedType);
        setMenuPorsi(resolvedPorsi);
        setAiKelompok(resolvedPorsi);

        const snapshot: OriginalMenuSnapshot = {
          nama: cleanName,
          kategori: menu.kategori || "Siswa",
          menuType: resolvedType,
          menuPorsi: resolvedPorsi,
          hargaJual: toNumber(menu.harga_jual),
          ingredientCount: normalizedIng.filter((i) => i.nama_bahan.trim())
            .length,
          nutrition: normalizedNut,
        };

        setOriginalSnapshot(snapshot);
        setEditLogs(getMenuEditLogs(editId));
      })
      .catch((error) => {
        console.error(error);
        setSaveMsg({
          type: "error",
          text: "Gagal memuat data menu untuk mode edit.",
        });
      })
      .finally(() => setLoadingEdit(false));
  }, []);

  useEffect(() => {
    setAiKelompok(menuPorsi);
  }, [menuPorsi]);

  const isEditMode = editingMenuId !== null;

  const validIngredients = useMemo(
    () => ingredients.filter((item) => item.nama_bahan.trim()),
    [ingredients],
  );

  const buildSnapshot = (
    baseName: string,
    nextKategori: MenuKategori,
    nextMenuType: MenuType,
    nextMenuPorsi: MenuPorsi,
    nextHargaJual: number,
    nextIngredients: MenuIngredient[],
    nextNutrition: MenuNutrition,
  ): OriginalMenuSnapshot => ({
    nama: baseName,
    kategori: nextKategori,
    menuType: nextMenuType,
    menuPorsi: nextMenuPorsi,
    hargaJual: nextHargaJual,
    ingredientCount: nextIngredients.filter((i) => i.nama_bahan.trim()).length,
    nutrition: normalizeNutrition(nextNutrition),
  });

  const buildChangeLogs = (
    menuId: number,
    before: OriginalMenuSnapshot,
    after: OriginalMenuSnapshot,
  ) => {
    const logs: MenuEditLogEntry[] = [];

    const pushIfDifferent = (
      field: string,
      oldValue: string,
      newValue: string,
    ) => {
      if (oldValue === newValue) return;
      logs.push(createMenuEditLogEntry(menuId, field, oldValue, newValue));
    };

    pushIfDifferent("Nama Menu", before.nama, after.nama);
    pushIfDifferent("Kelompok", before.kategori, after.kategori);
    pushIfDifferent(
      "Jenis Menu",
      before.menuType === "makanan" ? "Makanan" : "Minuman",
      after.menuType === "makanan" ? "Makanan" : "Minuman",
    );
    pushIfDifferent(
      "Kategori Porsi",
      before.menuPorsi === "porsi_besar" ? "Porsi Besar" : "Porsi Kecil",
      after.menuPorsi === "porsi_besar" ? "Porsi Besar" : "Porsi Kecil",
    );
    pushIfDifferent(
      "Harga Jual",
      String(before.hargaJual),
      String(after.hargaJual),
    );
    pushIfDifferent(
      "Jumlah Bahan",
      String(before.ingredientCount),
      String(after.ingredientCount),
    );

    const nutrientFields: Array<keyof MenuNutrition> = [
      "kalori",
      "protein",
      "lemak",
      "karbohidrat",
      "serat",
      "gula",
    ];

    nutrientFields.forEach((key) => {
      pushIfDifferent(
        `Nutrisi: ${key}`,
        String(before.nutrition[key]),
        String(after.nutrition[key]),
      );
    });

    return logs;
  };

  // Ingredient handlers
  const addIng = () => setIngredients([...ingredients, { ...emptyIng }]);

  const removeIng = (i: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, idx) => idx !== i));
    }
  };

  const updateIng = (
    i: number,
    field: keyof MenuIngredient,
    val: string | number,
  ) => {
    const updated = [...ingredients];
    (updated[i] as unknown as Record<string, unknown>)[field] = val;
    setIngredients(updated);
  };

  // Nutrition handler
  const updateNut = (field: keyof MenuNutrition, val: number) =>
    setNutrition({ ...nutrition, [field]: val });

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveMsg({
        type: "error",
        text: "File gambar tidak valid. Gunakan JPG, PNG, WebP, atau GIF.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveMsg({
        type: "error",
        text: "Ukuran gambar maksimal 5MB.",
      });
      return;
    }

    setImageFile(file);
    setSaveMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadMenuImage = async (menuId: number) => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);
    setUploadingImage(true);

    try {
      const uploadRes = await fetch(`${API}/${menuId}/upload-image`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Gagal upload gambar menu");
      }

      setImageFile(null);
      setImagePreview(resolveMenuImageUrl(uploadData.gambar_url));
    } finally {
      setUploadingImage(false);
    }
  };

  // Save menu (create / edit)
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    const cleanedName = sanitizeMenuName(nama);
    if (!cleanedName) return;

    if (validIngredients.length === 0) {
      setSaveMsg({ type: "error", text: "Minimal satu bahan harus diisi" });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      const endpoint = isEditMode ? `${API}/${editingMenuId}` : API;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: cleanedName,
          kategori,
          deskripsi: "",
          harga_jual: hargaJual,
          ingredients: validIngredients,
          nutrition,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      const currentMenuId = isEditMode
        ? Number(editingMenuId)
        : Number(data?.data?.id);

      if (imageFile && Number.isFinite(currentMenuId) && currentMenuId > 0) {
        try {
          await uploadMenuImage(currentMenuId);
        } catch (uploadErr: unknown) {
          const uploadMessage =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Menu tersimpan, tetapi upload gambar gagal.";
          setSaveMsg({
            type: "error",
            text: `Menu tersimpan, tetapi upload gambar gagal: ${uploadMessage}`,
          });
        }
      }

      if (Number.isFinite(currentMenuId) && currentMenuId > 0) {
        setMenuMeta(currentMenuId, {
          type: menuType,
          porsi: menuPorsi,
        });
      }

      if (isEditMode && editingMenuId && originalSnapshot) {
        const nextSnapshot = buildSnapshot(
          cleanedName,
          kategori,
          menuType,
          menuPorsi,
          hargaJual,
          validIngredients,
          nutrition,
        );
        const changes = buildChangeLogs(
          editingMenuId,
          originalSnapshot,
          nextSnapshot,
        );

        if (changes.length > 0) {
          appendMenuEditLogs(editingMenuId, changes);
          setEditLogs(getMenuEditLogs(editingMenuId));
          setOriginalSnapshot(nextSnapshot);
          setSaveMsg({
            type: "success",
            text: `Menu berhasil diperbarui (${changes.length} perubahan dicatat).`,
          });
        } else {
          setSaveMsg({
            type: "success",
            text: "Menu tersimpan tanpa perubahan data yang signifikan.",
          });
        }
      } else {
        setSaveMsg({ type: "success", text: "Menu berhasil disimpan!" });
      }

      setNama(cleanedName);

      setTimeout(() => {
        clearEditTargetMenuId();
        onNavigate("menu-catalog");
      }, 1200);
    } catch (err: unknown) {
      setSaveMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setSaving(false);
    }
  };

  // AI Generate
  const handleAIGenerate = async () => {
    const lines = aiIngText.split("\n").filter((l) => l.trim());
    if (lines.length === 0) {
      setAiError("Masukkan setidaknya satu bahan");
      return;
    }

    const ings = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      const namaBahan = parts[0] || line.trim();
      const jumlah = parseFloat(parts[1]) || 100;
      const satuan = parts[2] || "g";
      return { nama: namaBahan, jumlah, satuan };
    });

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch(`${API}/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ings,
          kelompok: aiKelompok,
          kategori,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI gagal generate menu");

      setAiResult(data as GeneratedMenu);
      setNama(sanitizeMenuName(data.nama_menu));
      setNutrition({
        kalori: data.estimasi_gizi.kalori || 0,
        protein: data.estimasi_gizi.protein || 0,
        lemak: data.estimasi_gizi.lemak || 0,
        karbohidrat: data.estimasi_gizi.karbohidrat || 0,
        serat: data.estimasi_gizi.serat || 0,
        gula: data.estimasi_gizi.gula || 0,
      });
      if (data.bahan_digunakan?.length > 0) {
        setIngredients(
          data.bahan_digunakan.map(
            (b: { nama: string; jumlah: number; satuan: string }) => ({
              nama_bahan: b.nama,
              jumlah: b.jumlah,
              satuan: b.satuan,
              harga_satuan: 0,
            }),
          ),
        );
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAiLoading(false);
    }
  };

  const useDummyStock = async () => {
    setStockLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API}/dummy-stock`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat dummy stock");
      const rows = Array.isArray(data.items)
        ? (data.items as Array<{ nama: string; qty: number; satuan: string }>)
        : [];
      setAiIngText(
        rows
          .map((item) => `${item.nama} ${item.qty} ${item.satuan}`)
          .join("\n"),
      );
    } catch (err: unknown) {
      setAiError(
        err instanceof Error ? err.message : "Gagal memuat dummy stock",
      );
    } finally {
      setStockLoading(false);
    }
  };

  // HPP estimate
  const hppEstimate = ingredients.reduce((sum, ing) => {
    const jumlah = Number(ing.jumlah) || 0;
    const harga = Number(ing.harga_satuan) || 0;
    const sat = ing.satuan;
    const mult =
      sat === "kg" || sat === "liter"
        ? jumlah
        : sat === "g" || sat === "ml"
          ? jumlah / 1000
          : jumlah;
    return sum + Math.round(harga * mult);
  }, 0);

  if (loadingEdit) {
    return (
      <div className="p-6">
        <div className="card flex items-center justify-center gap-3 p-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat data menu untuk mode edit...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-6 p-6"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            clearEditTargetMenuId();
            onNavigate("menu-catalog");
          }}
          className="rounded-xl p-2 transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-forest-100 p-2">
            <ChefHat className="h-6 w-6 text-forest-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {isEditMode ? "Edit Menu" : "Recipe Builder"}
            </h1>
            <p className="text-sm text-gray-400">
              {isEditMode
                ? "Perbarui menu dan lihat histori perubahannya"
                : "Create new menu items with nutrition calculation"}
            </p>
          </div>
        </div>

        {isEditMode && (
          <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            Edit ID #{editingMenuId}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <form onSubmit={handleSave} className="card space-y-5 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Menu Name
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Enter menu name..."
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-forest-400 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Kelompok
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as MenuKategori)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-forest-400 focus:bg-white"
                >
                  {KATEGORIS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Selling Price (Rp)
                </label>
                <input
                  type="number"
                  value={hargaJual || ""}
                  onChange={(e) => setHargaJual(Number(e.target.value))}
                  min={0}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-forest-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Jenis Menu
                </label>
                <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
                  {MENU_TYPES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMenuType(item.key)}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        menuType === item.key
                          ? "bg-forest-900 text-white"
                          : "text-gray-600 hover:bg-white/70"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Kategori Porsi
                </label>
                <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
                  {MENU_PORSI.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMenuPorsi(item.key)}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        menuPorsi === item.key
                          ? "bg-forest-900 text-white"
                          : "text-gray-600 hover:bg-white/70"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4">
              <div className="mb-3 flex items-start gap-2">
                <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Gambar Menu (Opsional)
                  </p>
                  <p className="text-xs text-gray-500">
                    Jika tidak diunggah, kartu menu akan memakai placeholder
                    ikon.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview gambar menu"
                      className="h-24 w-24 rounded-xl border border-violet-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-300">
                      <ChefHat className="h-8 w-8" />
                    </div>
                  )}

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <label className="cursor-pointer rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-1.5">
                    <Upload className="h-4 w-4" />
                    {imagePreview ? "Ganti Gambar" : "Pilih Gambar"}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Ingredients
                </label>
                <button
                  type="button"
                  onClick={addIng}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3 w-3" /> Add Ingredient
                </button>
              </div>

              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: "1fr 80px 90px 90px 32px" }}
                  >
                    <input
                      type="text"
                      value={ing.nama_bahan}
                      onChange={(e) =>
                        updateIng(idx, "nama_bahan", e.target.value)
                      }
                      placeholder="Ingredient name"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white"
                    />
                    <input
                      type="number"
                      value={ing.jumlah || ""}
                      onChange={(e) =>
                        updateIng(idx, "jumlah", Number(e.target.value))
                      }
                      placeholder="Qty"
                      min={0}
                      step={0.01}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white"
                    />
                    <select
                      value={ing.satuan}
                      onChange={(e) => updateIng(idx, "satuan", e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none"
                    >
                      {SATUANS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ing.harga_satuan || ""}
                      onChange={(e) =>
                        updateIng(idx, "harga_satuan", Number(e.target.value))
                      }
                      placeholder="Cost/kg"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeIng(idx)}
                      disabled={ingredients.length <= 1}
                      className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {hppEstimate > 0 && (
                <div className="mt-3 flex justify-between rounded-xl bg-forest-50 p-3 text-sm">
                  <span className="text-gray-500">Estimasi HPP per porsi</span>
                  <span className="font-bold text-forest-800">
                    Rp {hppEstimate.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                6-Pillar Nutrition Input
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { key: "kalori" as const, label: "Calories (kcal)" },
                    { key: "protein" as const, label: "Protein (g)" },
                    { key: "lemak" as const, label: "Fat (g)" },
                    { key: "karbohidrat" as const, label: "Carbs (g)" },
                    { key: "serat" as const, label: "Fiber (g)" },
                    { key: "gula" as const, label: "Sugar (g)" },
                  ] satisfies { key: keyof MenuNutrition; label: string }[]
                ).map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs text-gray-500">
                      {f.label}
                    </label>
                    <input
                      type="number"
                      value={nutrition[f.key] || ""}
                      onChange={(e) => updateNut(f.key, Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      step={0.1}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {saveMsg && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                  saveMsg.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {saveMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                {saveMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="btn-primary flex flex-1 items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                {saving || uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "💾"
                )}
                {uploadingImage
                  ? "Uploading Image..."
                  : isEditMode
                    ? "Simpan Perubahan"
                    : "Save Menu"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearEditTargetMenuId();
                  onNavigate("menu-catalog");
                }}
                className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>

            {isEditMode && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-700" />
                  <h4 className="text-sm font-bold text-amber-800">
                    Log Perubahan Menu
                  </h4>
                </div>

                {editLogs.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Belum ada riwayat perubahan pada menu ini.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {editLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-amber-100 bg-white px-3 py-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-gray-700">
                            {log.field}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatLogTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {log.oldValue || "(kosong)"} →{" "}
                          {log.newValue || "(kosong)"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-forest-700" />
              <h3 className="text-base font-bold text-gray-800">
                AI Menu Generator
              </h3>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              Masukkan bahan yang tersedia, AI akan merekomendasikan menu
              optimal.
            </p>
            <button
              type="button"
              onClick={useDummyStock}
              disabled={stockLoading}
              className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-forest-200 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-50 disabled:opacity-60"
            >
              <Database className="h-3.5 w-3.5" />
              {stockLoading ? "Memuat Dummy Stock..." : "Gunakan Dummy Stock"}
            </button>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-600">
                Target Porsi
              </label>
              <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
                {PORSI_LABELS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => {
                      setAiKelompok(k.key);
                      setMenuPorsi(k.key);
                    }}
                    className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-all ${
                      aiKelompok === k.key
                        ? "bg-forest-900 text-white"
                        : "text-gray-500 hover:text-forest-700"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-600">
                Bahan Tersedia
              </label>
              <textarea
                value={aiIngText}
                onChange={(e) => setAiIngText(e.target.value)}
                placeholder={
                  "Ayam 200 g\nBayam 100 g\nBeras 150 g\nWortel 80 g"
                }
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-forest-400 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Format: Nama Jumlah Satuan (satu per baris)
              </p>
            </div>

            {aiError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {aiError}
              </div>
            )}

            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading || !aiIngText.trim()}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {aiLoading ? "AI sedang memproses..." : "Generate Menu dengan AI"}
            </button>
          </div>

          {aiResult && (
            <div className="card space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h4 className="font-bold text-gray-800">
                  {sanitizeMenuName(aiResult.nama_menu)}
                </h4>
                {aiResult.sesuai_target && (
                  <span className="ml-auto rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                    Sesuai Target
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{aiResult.deskripsi}</p>
              <p className="text-xs text-gray-400">
                Metode:{" "}
                <span className="font-semibold text-gray-600">
                  {aiResult.metode_masak}
                </span>
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    {
                      label: "Kalori",
                      val: aiResult.estimasi_gizi.kalori,
                      unit: "kkal",
                    },
                    {
                      label: "Protein",
                      val: aiResult.estimasi_gizi.protein,
                      unit: "g",
                    },
                    {
                      label: "Lemak",
                      val: aiResult.estimasi_gizi.lemak,
                      unit: "g",
                    },
                    {
                      label: "Karbo",
                      val: aiResult.estimasi_gizi.karbohidrat,
                      unit: "g",
                    },
                    {
                      label: "Serat",
                      val: aiResult.estimasi_gizi.serat,
                      unit: "g",
                    },
                    {
                      label: "Gula",
                      val: aiResult.estimasi_gizi.gula,
                      unit: "g",
                    },
                  ] as const
                ).map((n) => (
                  <div
                    key={n.label}
                    className="rounded-lg bg-forest-50 p-2 text-center"
                  >
                    <p className="text-[9px] text-gray-400">{n.label}</p>
                    <p className="text-sm font-bold text-forest-800">
                      {n.val}
                      <span className="ml-0.5 text-[9px] font-normal">
                        {n.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              {aiResult.tips_gizi && (
                <div className="rounded-xl bg-forest-50 p-3 text-xs text-forest-800">
                  💡 {aiResult.tips_gizi}
                </div>
              )}

              {aiResult.bahan_kurang?.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Bahan Kurang
                  </p>
                  {aiResult.bahan_kurang.map((b, i) => (
                    <p key={i} className="text-[10px] text-amber-600">
                      • {b.nama}: butuh {b.jumlah_butuh} {b.satuan} — {b.alasan}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
