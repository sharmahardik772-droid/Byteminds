import React from 'react';
import { UploadCloud, Clock, Sparkles, Building2, Store, TrendingUp, Layers } from 'lucide-react';
import { ForecastingMode } from '../types';

interface HeaderProps {
  datasetName: string | null;
  totalRows?: number;
  frequency?: string;
  lastGeneratedAt: string | null;
  forecastingMode: ForecastingMode;
  onModeChange: (mode: ForecastingMode) => void;
  onOpenUpload: () => void;
  onLoadParleGSample: () => void;
  onLoadTataSample: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  datasetName,
  totalRows,
  frequency,
  lastGeneratedAt,
  forecastingMode,
  onModeChange,
  onOpenUpload,
  onLoadParleGSample,
  onLoadTataSample,
  isLoading,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs z-10 gap-4">
      {/* Title & Mode Switcher */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-slate-900 text-base tracking-tight">
              ByteMinds Forecasting Studio
            </h2>
            <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
              v2.0 Enterprise
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Dual-Engine Platform: Company Revenue & Hyperlocal SKU Demand Intelligence
          </p>
        </div>

        {/* Dual Mode Toggle Pill */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => onModeChange('revenue')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              forecastingMode === 'revenue'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mode A: Revenue</span>
          </button>
          <button
            onClick={() => onModeChange('hyperlocal')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              forecastingMode === 'hyperlocal'
                ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mode B: Hyperlocal SKU</span>
          </button>
        </div>
      </div>

      {/* Dataset & Quick Actions */}
      <div className="flex items-center space-x-2.5">
        {/* Dataset Status Pill */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          <span className="font-medium text-slate-500">Active:</span>
          <span className="font-semibold text-slate-900 truncate max-w-[140px]">
            {datasetName || 'No Dataset'}
          </span>
          {totalRows && (
            <span className="text-slate-400">
              ({totalRows} {frequency || 'rows'})
            </span>
          )}
        </div>

        {/* Parle-G Sample Quick Load */}
        <button
          onClick={onLoadParleGSample}
          disabled={isLoading}
          className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs disabled:opacity-50"
          title="Load Parle-G Multi-SKU Hyperlocal Sample Workbook"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Parle-G Hyperlocal</span>
        </button>

        {/* Tata Consumer Quick Load */}
        <button
          onClick={onLoadTataSample}
          disabled={isLoading}
          className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs disabled:opacity-50"
          title="Load Tata Consumer Products Quarterly Financials"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Tata Revenue</span>
        </button>

        {/* Upload / Replace Button */}
        <button
          onClick={onOpenUpload}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-600/20 disabled:opacity-50"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>{datasetName ? 'Switch Dataset' : 'Upload File'}</span>
        </button>
      </div>
    </header>
  );
};
