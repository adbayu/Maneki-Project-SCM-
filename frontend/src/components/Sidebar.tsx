import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  ChefHat,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  User,
  UtensilsCrossed,
} from "lucide-react";
import type { PageView, AuthUser } from "../types";

interface SidebarProps {
  activePage: PageView;
  onNavigate: (page: PageView) => void;
  onLogout: () => void;
  user: AuthUser;
}

const NAV_ITEMS: Array<{
  id: PageView;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "menu-catalog", label: "Menu Catalog", Icon: UtensilsCrossed },
  { id: "recipe-builder", label: "Recipe Builder", Icon: ChefHat },
  { id: "ai-lab", label: "AI Nutrition Lab", Icon: Brain },
  { id: "smart-stock", label: "Smart Stock", Icon: Package },
];

export default function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  user,
}: SidebarProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="card flex w-full flex-col overflow-hidden px-3 py-3 lg:sticky lg:top-5 lg:min-h-[calc(100vh-2.5rem)] lg:w-[280px] lg:px-4 lg:py-4"
    >
      <div className="flex flex-col gap-4 border-b border-ink-100 px-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-forest-900 via-forest-800 to-forest-600 shadow-[0_18px_28px_rgba(23,59,35,0.18)]">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink-700">
              Maneki SCM
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
              MBG Operations
            </p>
          </div>
        </div>

        <div className="surface-muted rounded-[24px] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-800/80">
            Signed in
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-forest-800 shadow-sm">
              <User className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-700">
                {user.nama || user.username}
              </p>
              <p className="truncate text-xs text-ink-400">
                {user.role || "Operator MBG"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4">
        <p className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">
          Main Navigation
        </p>

        <nav className="mt-3 flex gap-2 overflow-x-auto px-1 pb-2 lg:flex-col lg:overflow-visible">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`nav-item min-w-max text-left lg:w-full ${activePage === id ? "active" : ""}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/60 text-inherit shadow-sm">
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              <span className="whitespace-nowrap text-sm">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="border-t border-ink-100 px-1 pt-4">
        <div className="rounded-[24px] bg-gradient-to-br from-forest-950 to-forest-800 p-4 text-white shadow-[0_18px_36px_rgba(23,59,35,0.24)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Workspace
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/90">
            Seluruh halaman kini memakai sistem desain baru yang lebih clean,
            lega, dan konsisten.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          <LogOut className="h-4 w-4" />
          <span>Keluar</span>
        </button>
      </div>
    </motion.aside>
  );
}
