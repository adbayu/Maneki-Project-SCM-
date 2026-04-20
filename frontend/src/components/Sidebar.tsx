import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  Brain,
  Package,
  TrendingUp,
  LogOut,
  User,
  Leaf,
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
  { id: "financial", label: "Financial Analytics", Icon: TrendingUp },
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
      style={{ width: 232, minHeight: "100vh", flexShrink: 0 }}
      className="bg-white/80 backdrop-blur-sm flex flex-col border-r border-forest-100/80"
    >
      <div className="px-5 py-5 border-b border-forest-100/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-forest-900 to-forest-700 rounded-xl flex items-center justify-center shadow-md">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 leading-tight">Maneki SCM</p>
            <p className="text-[10px] text-gray-400 leading-tight">MBG - Gizi & Keuangan</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`nav-item w-full text-left ${activePage === id ? "active" : ""}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-forest-100/70">
        <div className="bg-gradient-to-r from-forest-50 to-white rounded-xl p-3 mb-3 border border-forest-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-forest-200 rounded-full flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-forest-800" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Masuk sebagai</p>
              <p className="text-xs font-bold text-gray-700 leading-tight">{user.nama || user.username}</p>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors text-sm font-medium border border-transparent hover:border-red-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </motion.aside>
  );
}
