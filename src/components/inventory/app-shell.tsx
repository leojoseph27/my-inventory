'use client';

import { useInventoryStore, ViewMode } from '@/store/inventory-store';
import { Dashboard } from './dashboard';
import { ProductTable } from './product-table';
import { ProductForm } from './product-form';
import { ProductDetail } from './product-detail';
import { ExcelImport } from './excel-import';
import { AuthScreen } from './auth-screen';
import { Button } from '@/components/ui/button';
import {
  Package,
  LayoutDashboard,
  LogOut,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export function AppShell() {
  const {
    isAuthenticated,
    currentView,
    setView,
    setAuthenticated,
  } = useInventoryStore();

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductTable />;
      case 'add-product':
        return <ProductForm mode="add" />;
      case 'edit-product':
        return <ProductForm mode="edit" />;
      case 'product-detail':
        return <ProductDetail />;
      case 'import':
        return <ExcelImport />;
      default:
        return <Dashboard />;
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm hidden sm:inline">Product Catalog</span>
          </button>

          <div className="flex-1" />

          {/* Nav tabs for desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <NavButton
              active={currentView === 'dashboard'}
              onClick={() => setView('dashboard')}
              icon={LayoutDashboard}
              label="Dashboard"
            />
            <NavButton
              active={currentView === 'products'}
              onClick={() => setView('products')}
              icon={Package}
              label="Products"
            />
            <NavButton
              active={currentView === 'add-product'}
              onClick={() => setView('add-product')}
              icon={Plus}
              label="Add Product"
            />
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 text-xs"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        {renderView()}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden sticky bottom-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="flex items-center justify-around h-14">
          <MobileNavButton
            active={currentView === 'dashboard'}
            onClick={() => setView('dashboard')}
            icon={LayoutDashboard}
            label="Dashboard"
          />
          <MobileNavButton
            active={currentView === 'products'}
            onClick={() => setView('products')}
            icon={Package}
            label="Products"
          />
          <MobileNavButton
            active={currentView === 'add-product'}
            onClick={() => setView('add-product')}
            icon={Plus}
            label="Add"
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1 px-4 transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
