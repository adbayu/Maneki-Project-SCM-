import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import type { HPPGroup } from "../types";

const FINANCIAL_API = "http://localhost:3002/api/financial";

type GroupTab = "kecil" | "standar" | "besar";
const TABS: { key: GroupTab; label: string }[] = [
  { key: "kecil", label: "Menu Kecil" },
  { key: "standar", label: "Menu Standar" },
  { key: "besar", label: "Menu Besar" },
];

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState<GroupTab>("standar");
  const [data, setData] = useState<HPPGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (group: GroupTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FINANCIAL_API}/hpp/${group}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal memuat data");
      setData(d as HPPGroup);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  const anggaranPct = data
    ? Math.min(
        100,
        Math.round((data.anggaran.terpakai / data.anggaran.bulan) * 100),
      )
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="p-6 space-y-5"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-forest-700" />
            Kalkulator HPP Dinamis
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Harga pasar terupdate · perubahan otomatis di semua menu
          </p>
        </div>
        <button
          onClick={() => loadData(activeTab)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-forest-200 text-forest-700 hover:bg-forest-50 transition-colors text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Perbarui Harga Pasar
        </button>
      </div>

      {/* ── Group Tabs ── */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
              activeTab === t.key
                ? "bg-forest-900 text-white border-forest-900 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-forest-300"
            }`}
          >
            <div>{t.label}</div>
            <div
              className={`text-[11px] font-normal mt-0.5 ${
                activeTab === t.key ? "text-forest-200" : "text-gray-400"
              }`}
            >
              stabil
            </div>
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading ? (
        <div className="card p-16 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-forest-600 animate-spin" />
          <p className="text-sm text-gray-400">Memuat data HPP...</p>
        </div>
      ) : error ? (
        /* ── Error state ── */
        <div className="card p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => loadData(activeTab)}
            className="btn-primary px-6 py-2 text-sm"
          >
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <>
          {/* ── HPP Breakdown Card ── */}
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="p-4 bg-forest-900 text-white flex justify-between items-center">
              <div>
                <p className="font-bold">{data.label}</p>
                <p className="text-xs text-forest-200">{data.sublabel}</p>
                {data.kalori_target && (
                  <p className="text-[11px] text-forest-300 mt-0.5">
                    Target kalori: {data.kalori_target}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black">
                  {formatRp(data.hpp_per_porsi)}
                </p>
                <p className="text-xs text-forest-200">HPP per porsi</p>
              </div>
            </div>

            {/* Ingredients rows */}
            <div className="divide-y divide-gray-50">
              {data.ingredients.map((ing, i) => {
                const hargaPerUnit = ing.harga_satuan || 0;
                const satLabel =
                  ing.satuan === "g" || ing.satuan === "ml"
                    ? `@Rp ${(hargaPerUnit / 1000).toFixed(0)}k/${ing.satuan === "g" ? "kg" : "liter"}`
                    : `@Rp ${hargaPerUnit.toLocaleString("id-ID")}/${ing.satuan}`;

                return (
                  <div
                    key={i}
                    className="flex justify-between items-center px-5 py-3"
                  >
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{ing.nama_bahan}</span>
                      <span className="text-gray-400 ml-2">
                        {ing.jumlah}
                        {ing.satuan}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {satLabel}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">
                      {formatRp(ing.subtotal || 0)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            <div className="flex justify-between items-center px-5 py-4 bg-gray-50 border-t border-gray-100">
              <span className="font-bold text-gray-800">Total HPP</span>
              <span className="text-xl font-black text-forest-800">
                {formatRp(data.hpp_per_porsi)}
              </span>
            </div>
          </div>

          {/* ── Anggaran vs Stok ── */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <span>📋</span> Ketersediaan Anggaran vs Stok Gudang
            </h3>

            {/* Anggaran bulan ini */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-forest-600 font-medium flex items-center gap-1">
                  <span>📅</span> Anggaran Bulan Ini
                </span>
                <span className="font-bold text-gray-700">
                  {formatRp(data.anggaran.terpakai)} /{" "}
                  {formatRp(data.anggaran.bulan)}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${anggaranPct}%`,
                    backgroundColor: anggaranPct > 80 ? "#EF5350" : "#2E7D32",
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Sisa anggaran:{" "}
                {formatRp(data.anggaran.bulan - data.anggaran.terpakai)} (
                {100 - anggaranPct}%)
              </p>
            </div>

            {/* Stok gudang */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <span>📦</span> Stok Gudang
                </span>
                <span className="font-bold text-gray-700">
                  {data.anggaran.stok_gudang_pct}% kapasitas
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${data.anggaran.stok_gudang_pct}%`,
                    backgroundColor:
                      data.anggaran.stok_gudang_pct < 20
                        ? "#EF5350"
                        : "#FFA726",
                  }}
                />
              </div>
              <p className="text-xs mt-1">
                <span className="text-gray-400">Bottleneck: </span>
                <span className="font-semibold text-danger">
                  {data.anggaran.bottleneck}
                </span>
                <span className="text-gray-400">
                  {" "}
                  — sisa {data.anggaran.bottleneck_sisa}
                </span>
              </p>
            </div>
          </div>

          {/* ── Prediksi AI ── */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: "#2E7D32" }}
          >
            <p className="text-sm font-semibold opacity-80 mb-2 flex items-center gap-2">
              <span>🤖</span> Prediksi AI — Sisa Hari Operasional
            </p>
            <p className="text-5xl font-black mb-1">
              {data.anggaran.prediksi_hari}
              <span className="text-xl font-normal opacity-70"> hari</span>
            </p>

            {/* Detail prediksi */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-sm opacity-80">
                <span className="flex items-center gap-1">
                  <span>📅</span> Dari anggaran tersisa
                </span>
                <span className="font-bold">
                  {Math.round(
                    ((data.anggaran.bulan - data.anggaran.terpakai) /
                      data.anggaran.bulan) *
                      30,
                  )}{" "}
                  hari
                </span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span className="flex items-center gap-1">
                  <span>📦</span> Dari stok gudang
                </span>
                <span className="font-bold">
                  {data.anggaran.bottleneck_sisa}
                </span>
              </div>
            </div>

            {/* Warning banner */}
            <div className="mt-4 p-3 bg-red-500/20 rounded-xl text-sm flex items-center gap-2">
              <span>⚡</span>
              <span>
                Anggaran perlu diisi ulang dalam{" "}
                <strong>{data.anggaran.prediksi_hari} hari</strong>. Segera
                ajukan permintaan pengadaan.
              </span>
            </div>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
