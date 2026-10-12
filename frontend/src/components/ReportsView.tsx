import React, { useState } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Award,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Store,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import {
  ForecastResponse,
  HyperlocalForecastResponse,
  ForecastingMode
} from '../types';
import { downloadCsvReport, downloadExcelReport, downloadForecastById } from '../api';

interface ReportsViewProps {
  forecastingMode: ForecastingMode;
  revenueForecast: ForecastResponse | null;
  hyperlocalForecast: HyperlocalForecastResponse | null;
  onNavigate: (tab: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  forecastingMode,
  revenueForecast,
  hyperlocalForecast,
  onNavigate,
}) => {
  const isHyperlocal = forecastingMode === 'hyperlocal';
  const [isExporting, setIsExporting] = useState<string | null>(null);

  if (isHyperlocal && !hyperlocalForecast) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Hyperlocal Report Data Available</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please run a Hyperlocal SKU forecast before generating reports.
        </p>
        <button
          onClick={() => onNavigate('hyperlocal-forecast')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
        >
          Open Hyperlocal Workspace
        </button>
      </div>
    );
  }

  if (!isHyperlocal && !revenueForecast) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Revenue Report Data Available</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please run the company revenue forecast before generating reports.
        </p>
        <button
          onClick={() => onNavigate('forecast')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
        >
          Open Revenue Workspace
        </button>
      </div>
    );
  }

  const handleExport = async (format: 'excel' | 'csv') => {
    setIsExporting(format);
    try {
      if (isHyperlocal && hyperlocalForecast?.forecast_id) {
        const fn = `Hyperlocal_Forecast_${hyperlocalForecast.metadata?.selected_sku || 'SKU'}_${hyperlocalForecast.metadata?.selected_locality || 'Locality'}`;
        await downloadForecastById(hyperlocalForecast.forecast_id, format, fn.replace(/\s+/g, '_'));
      } else if (!isHyperlocal && revenueForecast?.forecast_id) {
        const fn = `Revenue_Forecast_${revenueForecast.company_name || 'Company'}`;
        await downloadForecastById(revenueForecast.forecast_id, format, fn.replace(/\s+/g, '_'));
      } else if (!isHyperlocal && revenueForecast?.forecasting_results) {
        if (format === 'csv') {
          await downloadCsvReport(revenueForecast.forecasting_results, revenueForecast.company_name);
        } else {
          await downloadExcelReport(revenueForecast.forecasting_results, revenueForecast.company_name);
        }
      }
    } catch (e) {
      alert(`Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner & Export Actions */}
      <div className="no-print bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileDown className="w-5 h-5 text-indigo-600" />
              <span>Download Forecast Reports & Executive Documentation</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isHyperlocal
                ? 'Export multi-tab Hyperlocal SKU Forecast workbook with daily timelines, model leaderboard, and safety stock recommendations.'
                : 'Export corporate revenue forecasts with chronological holdout scores, confidence bands, and CAGR insights.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting !== null}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>{isExporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting !== null}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting === 'excel' ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Executive Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Executive Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
              ByteMinds Forecasting Studio — Executive Brief
            </div>
            <h3 className="text-2xl font-bold text-slate-900">
              {isHyperlocal
                ? `Hyperlocal SKU Demand Report: ${hyperlocalForecast?.metadata?.selected_sku}`
                : `Company Revenue Forecast: ${revenueForecast?.company_name}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="font-semibold text-slate-700">Architecture:</span>
            <div className="font-bold text-indigo-600">
              {isHyperlocal ? 'Mode B: Hyperlocal SKU Demand' : 'Mode A: Company Revenue'}
            </div>
          </div>
        </div>

        {/* Narrative / Commentary */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Analytical Summary & Model Benchmark
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed">
            {isHyperlocal
              ? `Chronological holdout validation across 7 models identified ${hyperlocalForecast?.metadata?.best_model} as the optimal model for ${hyperlocalForecast?.metadata?.selected_sku} in ${hyperlocalForecast?.metadata?.selected_locality} with a Mean Absolute Error (MAE) of ${hyperlocalForecast?.metadata?.best_model_metrics?.mae} units. Over the next ${hyperlocalForecast?.metadata?.horizon} ${hyperlocalForecast?.metadata?.frequency?.toLowerCase()}, total demand is projected at ${hyperlocalForecast?.future_timeline?.reduce((acc, curr) => acc + curr.forecast_demand_units, 0).toLocaleString()} units. Current inventory cover is estimated at ${hyperlocalForecast?.replenishment?.stock_cover_days} days with a suggested replenishment order of ${hyperlocalForecast?.replenishment?.suggested_order_quantity} units.`
              : revenueForecast?.executive_narrative}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-slate-400 font-medium">Best Model</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {isHyperlocal ? hyperlocalForecast?.metadata?.best_model : revenueForecast?.forecasting_results?.best_model_name}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-slate-400 font-medium">Evaluation Metric (MAE)</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {isHyperlocal
                ? `${hyperlocalForecast?.metadata?.best_model_metrics?.mae} Units`
                : `${revenueForecast?.forecasting_results?.models?.find((m) => m.id === revenueForecast.forecasting_results.best_model_id)?.metrics?.mae?.toFixed(1)} Cr`}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-slate-400 font-medium">Validation Methodology</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">Chronological Holdout</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-slate-400 font-medium">Forecast Horizon</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {isHyperlocal
                ? `${hyperlocalForecast?.metadata?.horizon} ${hyperlocalForecast?.metadata?.frequency}`
                : `${revenueForecast?.forecasting_results?.horizon} Quarters`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
