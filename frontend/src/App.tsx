import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MenuCatalogPage from "./pages/MenuCatalogPage";
import RecipeBuilderPage from "./pages/RecipeBuilderPage";
import AILabPage from "./pages/AILabPage";
import FinancialPage from "./pages/FinancialPage";
import type { PageView, AuthUser } from "./types";

function SmartStockPage() {
  return (
    <div className="p-8">
      <div className="card p-12 text-center">
        <p className="text-4xl mb-4">Stock</p>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Smart Stock</h2>
        <p className="text-gray-400 text-sm">Fitur ini akan segera hadir</p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activePage, setActivePage] = useState<PageView>("dashboard");

  useEffect(() => {
    const savedUser = localStorage.getItem("mbg_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("mbg_user");
      }
    }
  }, []);

  const handleLogin = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("mbg_user");
    localStorage.removeItem("mbg_token");
    setUser(null);
    setActivePage("dashboard");
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage onNavigate={setActivePage} />;
      case "menu-catalog":
        return <MenuCatalogPage onNavigate={setActivePage} />;
      case "recipe-builder":
        return <RecipeBuilderPage onNavigate={setActivePage} />;
      case "ai-lab":
        return <AILabPage />;
      case "smart-stock":
        return <SmartStockPage />;
      case "financial":
        return <FinancialPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div
      className="flex"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(129,199,132,.25), transparent 30%), linear-gradient(145deg,#f4f9ee 0%,#eff8ec 45%,#f8fbf6 100%)",
      }}
    >
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
        user={user}
      />
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
