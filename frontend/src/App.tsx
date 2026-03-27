import { useState } from 'react';
import { UtensilsCrossed, LayoutDashboard, Plus } from 'lucide-react';
import MenuList from './components/MenuList';
import MenuForm from './components/MenuForm';
import DashboardStats from './components/DashboardStats';

type ActiveView = 'dashboard' | 'list' | 'form';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [editMenuId, setEditMenuId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (menuId: number) => {
    setEditMenuId(menuId);
    setActiveView('form');
  };

  const handleCreateNew = () => {
    setEditMenuId(null);
    setActiveView('form');
  };

  const handleFormSuccess = () => {
    setEditMenuId(null);
    setRefreshKey(prev => prev + 1);
    setActiveView('list');
  };

  const handleFormCancel = () => {
    setEditMenuId(null);
    setActiveView('list');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <UtensilsCrossed className="h-8 w-8 text-emerald-400" />
              <span className="text-xl font-bold text-white tracking-tight">Maneki SCM</span>
              <span className="hidden sm:inline-block text-xs font-medium bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full ml-2">
                Menu & Gizi AI
              </span>
            </div>

            {activeView !== 'form' && (
              <div className="flex items-center">
                <button
                  onClick={handleCreateNew}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Menu Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Perencanaan Menu & Analisis Gizi
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Kelola menu makanan, analisis komposisi gizi, dan dapatkan rekomendasi AI untuk keseimbangan nutrisi.
          </p>
        </div>

        {/* Tabs */}
        {activeView !== 'form' && (
          <div className="border-b border-slate-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`${
                  activeView === 'dashboard'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors duration-200`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveView('list')}
                className={`${
                  activeView === 'list'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors duration-200`}
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>Daftar Menu</span>
              </button>
            </nav>
          </div>
        )}

        {/* Content */}
        <div className="transition-all duration-300">
          {activeView === 'dashboard' && <DashboardStats key={refreshKey} onNavigateToList={() => setActiveView('list')} />}
          {activeView === 'list' && <MenuList key={refreshKey} onEdit={handleEdit} onCreateNew={handleCreateNew} />}
          {activeView === 'form' && (
            <MenuForm
              menuId={editMenuId}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
