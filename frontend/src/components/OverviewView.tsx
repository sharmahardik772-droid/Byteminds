import React from 'react';
import {
  TrendingUp,
  Store,
  Calendar,
  Layers,
  ArrowRight,
  BarChart2,
  Package,
  ShieldCheck,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  ForecastResponse,
  HyperlocalForecastResponse,
  UploadResponse,
  AuditResponse,
  ForecastingMode
} from '../types';

interface OverviewViewProps {
  forecastingMode: ForecastingMode;
  onModeChange: (mode: ForecastingMode) => void;
  revenueForecast: ForecastResponse | null;
  hyperlocalForecast: HyperlocalForecastResponse | null;
  dataset: UploadResponse | null;
  audit: AuditResponse | null;
  onNavigate: (tab: string) => void;
  onRunRevenueForecast: () => void;
  onRunHyperlocalForecast: () => void;
  isLoading: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  forecastingMode,
  onModeChange,
  revenueForecast,
  hyperlocalForecast,
  dataset,
  audit,
  onNavigate,
  onRunRevenueForecast,
  onRunHyperlocalForecast,
  isLoading,
}) => {
  const isHyperlocal = forecastingMode === 'hyperlocal';

  // Revenue chart data
  const revResults = revenueForecast?.forecasting_results;
  const revHistory = revResults?.historical_timeline || [];
  const revFuture = revResults?.future_timeline || [];

  const revChartData = [
    ...revHistory.map((h) => ({
      label: h.label,
      actual: h.actual,
      forecast: null,
      type: 'Historical',
    })),
    ...revFuture.map((f) => ({
      label: f.label,
      actual: null,
      forecast: f.best_pred,
      type: 'Forecast',
    })),
  ];

  // Hyperlocal chart data
  const hypHistory = hyperlocalForecast?.historical_timeline || [];
  const hypFuture = hyperlocalForecast?.future_timeline || [];

  const hypChartData = [
    ...hypHistory.map((h) => ({
      date: h.date,
      actual: h.actual_demand,
      forecast: h.best_model_predicted,
      inventory: h.inventory,
      type: h.is_validation ? 'Validation' : 'Historical',
    })),
    ...hypFuture.map((f) => ({
      date: f.date,
      actual: null,
      forecast: f.forecast_demand_units,
      inventory: f.current_inventory,
      type: 'Future Forecast',
    })),
  ];

  // Hyperlocal metrics
  const hypMeta = hyperlocalForecast?.metadata;
  const hypReplenish = hyperlocalForecast?.replenishment;
  const totalHypDemand = hypFuture.reduce((acc, curr) => acc + curr.forecast_demand_units, 0);

  // Revenue metrics
  const lastRevActual = revHistory.length > 0 ? revHistory[revHistory.length - 1].actual : null;
  const nextRevForecast = revFuture.length > 0 ? revFuture[0].best_pred : null;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>ByteMinds Forecasting Studio — Dual Enterprise Intelligence</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            ByteMinds Forecasting Studio
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">
            Unified data-driven forecasting platform supporting company-level revenue forecasting and hyperlocal SKU demand forecasting across retail localities, pack sizes, and outlets.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate(isHyperlocal ? 'hyperlocal-forecast' : 'forecast')}
              className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition-colors ${
                isHyperlocal ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              <span>{isHyperlocal ? 'Open Hyperlocal SKU Workspace' : 'Open Revenue Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('comparison')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center space-x-2 transition-colors"
            >
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span>Model Comparison (7 Models)</span>
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download Forecast Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two Prominent Forecasting-Mode Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
            Select Forecasting Architecture
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Active Mode: <strong className="text-slate-800">{isHyperlocal ? 'Mode B (Hyperlocal SKU)' : 'Mode A (Company Revenue)'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card A: Company Revenue Forecasting */}
          <div
            onClick={() => onModeChange('revenue')}
            className={`cursor-pointer rounded-2xl p-6 border transition-all ${
              !isHyperlocal
                ? 'bg-gradient-to-br from-indigo-900/5 via-white to-indigo-50/30 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  !isHyperlocal
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {!isHyperlocal ? 'Active Mode A' : 'Switch to Mode A'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Mode A: Company Revenue Forecasting
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Forecast company-level sales or revenue across quarterly, monthly, or daily reporting intervals using 7 econometrics and ML models with chronological holdout validation.
            </p>

            <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Type:</span>
                <span className="font-semibold text-slate-700">Financial Revenue / Total Sales</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Primary Horizon:</span>
                <span className="font-semibold text-slate-700">1 to 8 Quarters or Months</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-semibold text-indigo-600">
                  {revenueForecast ? 'Forecast Ready (Ridge / Holt-Winters)' : 'Ready to Run'}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onModeChange('revenue');
                  onRunRevenueForecast();
                }}
                disabled={isLoading}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-2xs disabled:opacity-50"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Execute Revenue Forecast</span>
              </button>
            </div>
          </div>

          {/* Card B: Hyperlocal SKU Demand Forecasting */}
          <div
            onClick={() => onModeChange('hyperlocal')}
            className={`cursor-pointer rounded-2xl p-6 border transition-all ${
              isHyperlocal
                ? 'bg-gradient-to-br from-emerald-900/5 via-white to-emerald-50/30 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                <Store className="w-6 h-6" />
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  isHyperlocal
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {isHyperlocal ? 'Active Mode B' : 'Switch to Mode B'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Mode B: Hyperlocal SKU Demand Forecasting
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Product-level demand forecasting for individual SKUs across retail localities, pack sizes, and outlets (Parle-G model) with recursive lag projection and inventory replenishment logic.
            </p>

            <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Type:</span>
                <span className="font-semibold text-slate-700">Unit Sales / Observed Demand</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Granularity:</span>
                <span className="font-semibold text-slate-700">SKU × Locality × Day / Week</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-semibold text-emerald-600">
                  {hyperlocalForecast ? 'Forecast Ready (Parle-G Engine)' : 'Ready to Run'}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onModeChange('hyperlocal');
                  onRunHyperlocalForecast();
                }}
                disabled={isLoading}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-2xs disabled:opacity-50"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Execute Hyperlocal SKU Forecast</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset & Observation Status Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Dataset Status</div>
            <div className="text-sm font-bold text-slate-900">
              {dataset?.filename || 'Sample Dataset Loaded'} — Sheet: {dataset?.active_sheet || 'Default'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400">Total Rows: </span>
            <strong className="text-slate-800">{dataset?.total_rows || 0}</strong>
          </div>
          <div>
            <span className="text-slate-400">Valid Observations: </span>
            <strong className="text-slate-800">
              {isHyperlocal
                ? (hypMeta?.total_valid_observations || dataset?.total_rows || '—')
                : (revResults?.total_observations || dataset?.total_rows || '—')}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">Target Variable: </span>
            <strong className="text-slate-800">
              {isHyperlocal ? 'Sales_Quantity' : (dataset?.column_detection?.recommended_revenue || 'Revenue')}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">Best Model: </span>
            <strong className="text-indigo-600">
              {isHyperlocal
                ? (hypMeta?.best_model || 'Seasonal Naive / RF')
                : (revResults?.best_model_name?.split(':')[1]?.trim() || revResults?.best_model_name || 'Ridge Regression')}
            </strong>
          </div>
        </div>
      </div>

      {/* Dynamic Mode-Specific Dashboard Content */}
      {isHyperlocal ? (
        /* Hyperlocal Mode Dashboard */
        <div className="space-y-6">
          {/* Key Hyperlocal Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Selected SKU & Locality
              </div>
              <div className="text-lg font-bold text-slate-900 truncate">
                {hypMeta?.selected_sku || 'Parle-G 250g'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                in <strong className="text-slate-700">{hypMeta?.selected_locality || 'Amritsar Central'}</strong>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Total Horizon Demand
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {hypFuture.length > 0 ? `${totalHypDemand.toLocaleString()} Units` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Next {hypMeta?.horizon || 7} {hypMeta?.frequency?.toLowerCase() || 'days'} forecast
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Current Inventory
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {hypReplenish?.current_inventory !== undefined
                  ? `${hypReplenish.current_inventory.toLocaleString()} Units`
                  : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Cover: <strong>{hypReplenish?.stock_cover_days ?? '—'} days</strong>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Suggested Order Quantity
              </div>
              <div className="text-2xl font-bold text-indigo-600">
                {hypReplenish?.suggested_order_quantity !== undefined
                  ? `${hypReplenish.suggested_order_quantity.toLocaleString()} Units`
                  : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Safety Stock: {hypReplenish?.safety_stock_units ?? '—'} units
              </div>
            </div>
          </div>

          {/* Actual vs Forecast Chart for Hyperlocal */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Hyperlocal Demand: Actual Historical Demand vs. Model Forecast
                </h3>
                <p className="text-xs text-slate-500">
                  Daily unit demand and recursive projections for {hypMeta?.selected_sku} in {hypMeta?.selected_locality}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-md border border-emerald-200">
                Best: {hypMeta?.best_model || 'Trained Model'}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hypChartData.slice(-60)}>
                  <defs>
                    <linearGradient id="actualDemandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="forecastDemandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#actualDemandGrad)"
                    name="Actual Demand (Units)"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#forecastDemandGrad)"
                    name="Forecast Demand (Units)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        /* Revenue Mode Dashboard */
        <div className="space-y-6">
          {/* Key Revenue Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Last Observed Revenue
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {lastRevActual ? `₹${lastRevActual.toLocaleString()} Cr` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Historical baseline</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Projected Next Period
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {nextRevForecast ? `₹${nextRevForecast.toLocaleString()} Cr` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Model: {revResults?.best_model_name?.split(':')[1]?.trim() || 'Ridge / Holt'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Chronological Holdout
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {revResults?.validation_holdout_size || 4} Quarters
              </div>
              <div className="text-xs text-slate-500 mt-1">Tested on unseen holdout</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Historical CAGR
              </div>
              <div className="text-2xl font-bold text-indigo-600">
                {revResults?.historical_cagr_pct ? `${revResults.historical_cagr_pct.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Compound growth rate</div>
            </div>
          </div>

          {/* Actual vs Forecast Chart for Revenue */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Enterprise Revenue: Historical Actuals vs. Multi-Period Projections
                </h3>
                <p className="text-xs text-slate-500">
                  Quarterly performance trajectory and future projections (₹ Cr)
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md border border-indigo-200">
                Best: {revResults?.best_model_name?.split(':')[1]?.trim() || 'Ridge Regression'}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revChartData}>
                  <defs>
                    <linearGradient id="actualRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="forecastRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#actualRevGrad)"
                    name="Actual Revenue (₹ Cr)"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#forecastRevGrad)"
                    name="Forecast Revenue (₹ Cr)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
