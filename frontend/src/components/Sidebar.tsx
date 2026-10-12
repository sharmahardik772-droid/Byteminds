import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Database,
  TrendingUp,
  BarChart3,
  Lightbulb,
  FileDown,
  BookOpen,
  Store,
  PackageCheck,
  ShieldCheck
} from 'lucide-react';
import { ForecastingMode } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  datasetName: string | null;
  hasForecast: boolean;
  forecastingMode: ForecastingMode;
  onModeChange: (mode: ForecastingMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  datasetName,
  hasForecast,
  forecastingMode,
  onModeChange,
}) => {
  const isHyperlocal = forecastingMode === 'hyperlocal';

  const navItems = [
    { id: 'overview', label: '1. Overview Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'upload', label: '2. Upload & Ingest Data', icon: UploadCloud, badge: datasetName ? 'Loaded' : null },
    { id: 'explorer', label: '3. Data Explorer', icon: Database, badge: null },
    {
      id: isHyperlocal ? 'hyperlocal-forecast' : 'forecast',
      label: isHyperlocal ? '4. Hyperlocal SKU Forecast' : '4. Revenue Forecast',
      icon: isHyperlocal ? Store : TrendingUp,
      badge: hasForecast ? 'Active' : null,
    },
    {
      id: 'comparison',
      label: '5. Model Comparison',
      icon: BarChart3,
      badge: hasForecast ? '7 Models' : null,
    },
    ...(isHyperlocal
      ? [{ id: 'replenishment', label: '6. Replenishment Planner', icon: PackageCheck, badge: 'Smart' }]
      : []),
    {
      id: 'insights',
      label: isHyperlocal ? '7. Demand Insights' : '6. Forecast Insights',
      icon: Lightbulb,
      badge: null,
    },
    {
      id: 'reports',
      label: isHyperlocal ? '8. Download Reports' : '7. Download Reports',
      icon: FileDown,
      badge: null,
    },
    {
      id: 'about',
      label: isHyperlocal ? '9. About the Models' : '8. About the Model',
      icon: BookOpen,
      badge: 'Docs',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 border-r border-slate-800 select-none min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            {isHyperlocal ? (
              <Store className="w-5 h-5 text-white" />
            ) : (
              <TrendingUp className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              ByteMinds
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">
                Studio
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Forecasting Studio</p>
          </div>
        </div>

        {/* Mode Switcher inside sidebar for convenient navigation */}
        <div className="mt-4 pt-3 border-t border-slate-800/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Forecasting Mode
          </div>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => onModeChange('revenue')}
              className={`px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center space-x-1 transition-all ${
                forecastingMode === 'revenue'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Revenue</span>
            </button>
            <button
              onClick={() => onModeChange('hyperlocal')}
              className={`px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center space-x-1 transition-all ${
                forecastingMode === 'hyperlocal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Store className="w-3 h-3" />
              <span>Hyperlocal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Analytics Pipeline
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? isHyperlocal
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info Box */}
      <div className="p-4 m-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
        <div className="flex items-center space-x-2 text-indigo-400 font-semibold mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isHyperlocal ? 'Hyperlocal SKU Engine' : 'Revenue Intel Engine'}</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          {isHyperlocal
            ? 'Chronological validation, 7 models, recursive lag projection, and automated replenishment logic.'
            : 'Quarterly econometric & ML models with chronological holdout validation and growth insights.'}
        </p>
      </div>
    </aside>
  );
};
