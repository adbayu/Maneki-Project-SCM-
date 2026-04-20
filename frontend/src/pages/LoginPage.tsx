import { useState } from "react";
import { motion } from "framer-motion";
import { Leaf, Lock, User, Eye, EyeOff } from "lucide-react";

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
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{
        background:
          "linear-gradient(130deg,#f3f8ed 0%, #e8f5e9 45%, #ffffff 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex flex-col justify-between p-10"
        style={{
          background:
            "linear-gradient(155deg,#1f5f2b 0%, #2e7d32 45%, #74b46f 100%)",
        }}
      >
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">Maneki SCM</p>
            <p className="text-xs text-forest-100">Program MBG Indonesia</p>
          </div>
        </div>
        <div className="text-white max-w-sm">
          <h1 className="text-4xl font-black leading-tight mb-3">
            Distribusi MBG lebih tepat sasaran.
          </h1>
          <p className="text-sm text-forest-100">
            Pantau menu siswa, balita, dan ibu hamil dalam satu dashboard.
          </p>
        </div>
        <p className="text-xs text-forest-100">© 2026 Maneki SCM</p>
      </motion.div>

      <div className="flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md card p-8"
        >
          <h2 className="text-2xl font-bold text-gray-800">
            Masuk ke Maneki SCM
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Sistem gizi, stok, dan rekomendasi AI MBG
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-60"
            >
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Default: <span className="font-mono">admin / admin123</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
