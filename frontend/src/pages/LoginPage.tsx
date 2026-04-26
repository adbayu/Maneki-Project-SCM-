import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";

const API = "http://localhost:3002/api/auth";

interface LoginPageProps {
  onLogin: (user: { username: string; role: string; nama: string }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      localStorage.setItem("mbg_user", JSON.stringify(data.user));
      localStorage.setItem("mbg_token", data.token);
      onLogin(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(76,175,80,0.16),transparent_28%),linear-gradient(180deg,#f5f8f4_0%,#edf2ee_100%)]">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-[1.02fr_0.98fr]">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative hidden overflow-hidden bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(165,214,167,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/12 ring-1 ring-white/10">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold">Maneki SCM</p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Menu Planning Dashboard
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="soft-badge border-white/10 bg-white/10 text-white/70">
              <ShieldCheck className="h-3.5 w-3.5" />
              Enterprise-ready workspace
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-white">
              Kelola menu MBG dan pantau analitik gizi
            </h1>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-4"></div>
        </motion.div>

        <div className="flex min-h-screen items-center justify-center bg-white/20 p-6 sm:p-8 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[560px] rounded-[34px] border border-white/70 bg-white/84 p-7 shadow-[0_26px_72px_rgba(36,49,39,0.12)] backdrop-blur-2xl sm:p-9"
          >
            <div className="mb-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-forest-50 text-forest-800">
                <Leaf className="h-5 w-5" />
              </div>
              <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-ink-700">
                Masuk ke Maneki SCM
              </h2>
              <p className="mt-2 text-sm leading-7 text-ink-400">
                Sistem gizi, menu, dan analitik AI MBG dalam satu workspace yang
                lebih modern.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink-500">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full py-3.5 pl-11 pr-4 text-sm"
                    placeholder="admin"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-ink-500">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full py-3.5 pl-11 pr-12 text-sm"
                    placeholder="Masukkan password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 transition hover:text-ink-700"
                    aria-label="Lihat password"
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-[20px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60"
              >
                <span>{loading ? "Masuk..." : "Masuk ke Dashboard"}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-7 rounded-[24px] border border-forest-100 bg-forest-25 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-800/80">
                Default Access
              </p>
              <p className="mt-2 font-mono text-sm text-ink-500">
                admin / admin123
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
