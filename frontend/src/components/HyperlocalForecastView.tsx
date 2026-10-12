import React, { useState } from 'react';
import {
  Store,
  Layers,
  Calendar,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  HyperlocalForecastResponse,
  UploadResponse
} from '../types';
import { downloadForecastById } from '../api';

interface HyperlocalForecastViewProps {
  forecast: HyperlocalForecastResponse | null;
  dataset: UploadResponse | null;
  selectedSku: string;
  setSelectedSku: (sku: string) => void;
  selectedLocality: string;
  setSelectedLocality: (locality: string) => void;
  horizon: number;
  setHorizon: (h: number) => void;
  frequency: string;
  setFrequency: (f: string) => void;
  replenishmentParams: {
    lead_time_days: number;
    review_period_days: number;
    service_level: number;
    min_order_quantity: number;
    case_pack_size: number;
    existing_incoming_orders: number;
    current_inventory_override?: number;
  };
  setReplenishmentParams: React.Dispatch<React.SetStateAction<any>>;
  onExecuteForecast: () => void;
  isLoading: boolean;
}

export const HyperlocalForecastView: React.FC<HyperlocalForecastViewProps> = ({
  forecast,
  dataset,
  selectedSku,
  setSelectedSku,
  selectedLocality,
  setSelectedLocality,
  horizon,
  setHorizon,
  frequency,
  setFrequency,
  replenishmentParams,
  setReplenishmentParams,
  onExecuteForecast,
  isLoading,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const availableSkus = dataset?.column_detection?.unique_skus || forecast?.metadata?.available_skus || [];
  const availableLocalities = dataset?.column_detection?.unique_localities || forecast?.metadata?.available_localities || [];
  const availableBrands = dataset?.column_detection?.unique_brands || forecast?.metadata?.available_brands || [];

  const meta = forecast?.metadata;
  const replenish = forecast?.replenishment;
  const history = forecast?.historical_timeline || [];
  const future = forecast?.future_timeline || [];
  const models = forecast?.model_evaluations || [];
  const skuComparison = forecast?.sku_comparison || [];
  const localityComparison = forecast?.locality_comparison || [];

  // Timeline chart data combining recent history and future projections
  const chartData = [
    ...history.slice(-35).map((h) => ({
      date: h.date,
      actual: h.actual_demand,
      forecast: h.best_model_predicted,
      naive: h.naive_predicted,
      lower: null,
      upper: null,
      type: h.is_validation ? 'Validation Holdout' : 'Historical',
    })),
    ...future.map((f) => ({
      date: f.date,
      actual: null,
      forecast: f.forecast_demand_units,
      naive: null,
      lower: f.lower_bound,
      upper: f.upper_bound,
      type: 'Future Forecast',
    })),
  ];

  const totalFutureUnits = future.reduce((acc, curr) => acc + curr.forecast_demand_units, 0);

  const handleDownload = async (format: 'excel' | 'csv') => {
    if (!forecast?.forecast_id) return;
    setDownloadingFormat(format);
    try {
      const fn = `Hyperlocal_Demand_${meta?.selected_sku || 'SKU'}_${meta?.selected_locality || 'Locality'}`;
      await downloadForecastById(forecast.forecast_id, format, fn.replace(/\s+/g, '_'));
    } catch (err) {
      alert('Failed to download forecast report.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Execution Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>Hyperlocal SKU Demand Forecasting Workspace</span>
            </h2>
            <p className="text-xs text-slate-500">
              Select product SKU and retail locality to generate genuine filtered econometric demand forecasts.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center space-x-1.5 transition-colors ${
                showConfig ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Replenishment Settings</span>
            </button>

            <button
              onClick={onExecuteForecast}
              disabled={isLoading || !selectedSku || !selectedLocality}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Training Models...' : 'Run SKU Forecast'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Selectors Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          {/* SKU Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Select SKU / Product
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              {availableSkus.length > 0 ? (
                availableSkus.map((sku) => (
                  <option key={sku} value={sku}>
                    {sku}
                  </option>
                ))
              ) : (
                <option value="Parle-G 250g">Parle-G 250g (Sample)</option>
              )}
            </select>
          </div>

          {/* Locality Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Select Retail Locality
            </label>
            <select
              value={selectedLocality}
              onChange={(e) => setSelectedLocality(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              {availableLocalities.length > 0 ? (
                availableLocalities.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))
              ) : (
                <option value="Amritsar Central">Amritsar Central (Sample)</option>
              )}
            </select>
          </div>

          {/* Frequency Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Observation Grain
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="daily">Daily (Day by Day)</option>
              <option value="weekly">Weekly (Weekly Rollup)</option>
            </select>
          </div>

          {/* Horizon Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Forecast Horizon
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
              <option value={21}>21 Days (3 Weeks)</option>
              <option value={28}>28 Days (4 Weeks / 1 Month)</option>
            </select>
          </div>
        </div>

        {/* Collapsible Replenishment Parameters Drawer */}
        {showConfig && (
          <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Supply Chain & Inventory Replenishment Assumptions</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Lead Time (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={replenishmentParams.lead_time_days}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      lead_time_days: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Review Period (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={replenishmentParams.review_period_days}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      review_period_days: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Service Level (%)</label>
                <select
                  value={replenishmentParams.service_level}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      service_level: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                >
                  <option value={0.90}>90% (Z = 1.28)</option>
                  <option value={0.95}>95% (Z = 1.65)</option>
                  <option value={0.98}>98% (Z = 2.05)</option>
                  <option value={0.99}>99% (Z = 2.33)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">MOQ (Units)</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={replenishmentParams.min_order_quantity}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      min_order_quantity: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Case Pack Size</label>
                <input
                  type="number"
                  min={1}
                  value={replenishmentParams.case_pack_size}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      case_pack_size: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Incoming Orders</label>
                <input
                  type="number"
                  min={0}
                  value={replenishmentParams.existing_incoming_orders}
                  onChange={(e) =>
                    setReplenishmentParams((prev: any) => ({
                      ...prev,
                      existing_incoming_orders: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Forecast Demand */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Total Forecast Demand
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {future.length > 0 ? `${totalFutureUnits.toLocaleString()} Units` : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Next {meta?.horizon || 7} {meta?.frequency?.toLowerCase() || 'days'}
          </div>
        </div>

        {/* Card 2: Current Inventory */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Current Inventory
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {replenish?.current_inventory !== undefined
              ? `${replenish.current_inventory.toLocaleString()} Units`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Ending store snapshot
          </div>
        </div>

        {/* Card 3: Stock Cover Days */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Expected Stock Cover
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {replenish?.stock_cover_days !== undefined ? `${replenish.stock_cover_days} Days` : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Days of demand on-hand
          </div>
        </div>

        {/* Card 4: Safety Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Target Safety Stock
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {replenish?.safety_stock_units !== undefined
              ? `${replenish.safety_stock_units.toLocaleString()} Units`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {replenish?.service_level_pct || 95}% service buffer
          </div>
        </div>

        {/* Card 5: Suggested Order Quantity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Suggested Reorder
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {replenish?.suggested_order_quantity !== undefined
              ? `${replenish.suggested_order_quantity.toLocaleString()} Units`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Risk:{' '}
            <strong
              className={
                replenish?.stockout_risk === 'High'
                  ? 'text-rose-600'
                  : replenish?.stockout_risk === 'Moderate'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }
            >
              {replenish?.stockout_risk || 'Normal'}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Demand Timeline Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Demand Forecast Timeline: {meta?.selected_sku} ({meta?.selected_locality})
            </h3>
            <p className="text-xs text-slate-500">
              Chronological validation test window followed by recursive multi-step future projections with 95% confidence bands.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDownload('excel')}
              disabled={downloadingFormat === 'excel'}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Excel</span>
            </button>
            <button
              onClick={() => handleDownload('csv')}
              disabled={downloadingFormat === 'csv'}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="hypActualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="hypFutureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Legend />
              {/* Confidence Band */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="#10b981"
                fillOpacity={0.12}
                name="95% Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#hypActualGrad)"
                name="Actual Historical Demand"
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#10b981' }}
                name="Forecast Demand (Units)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Comparison Visualizations: SKU Comparison & Locality Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Chart A: SKU Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">SKU Demand Distribution</h4>
              <p className="text-[11px] text-slate-500">Average daily unit demand across pack sizes</p>
            </div>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skuComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="sku" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar
                  dataKey="average_daily_sales"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  name="Avg Daily Units"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Locality Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Locality Demand Comparison</h4>
              <p className="text-[11px] text-slate-500">Average daily unit demand across retail territories</p>
            </div>
            <Store className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={localityComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="locality" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar
                  dataKey="average_daily_sales"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="Avg Daily Units"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Benchmark Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Chronological Model Benchmark Evaluation ({meta?.holdout_periods || 28}-Period Holdout)
            </h4>
            <p className="text-[11px] text-slate-500">
              Strict chronological validation testing without future data leakage. Primary selection criteria: MAE.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-md border border-emerald-200">
            Selected Best: {meta?.best_model}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Model Name</th>
                <th className="py-2.5 px-3">MAE (Units)</th>
                <th className="py-2.5 px-3">RMSE</th>
                <th className="py-2.5 px-3">WAPE (%)</th>
                <th className="py-2.5 px-3">MAPE (%)</th>
                <th className="py-2.5 px-3">R²</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {models.map((m) => (
                <tr
                  key={m.model_name}
                  className={m.model_name === meta?.best_model ? 'bg-emerald-50/40 font-semibold' : ''}
                >
                  <td className="py-2.5 px-3">{m.rank}</td>
                  <td className="py-2.5 px-3 flex items-center space-x-2">
                    <span>{m.model_name}</span>
                    {m.model_name === meta?.best_model && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded font-bold">
                        Best
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{m.mae.toFixed(1)}</td>
                  <td className="py-2.5 px-3">{m.rmse.toFixed(1)}</td>
                  <td className="py-2.5 px-3">{m.wape !== null ? `${m.wape.toFixed(1)}%` : '—'}</td>
                  <td className="py-2.5 px-3">{m.mape !== null ? `${m.mape.toFixed(1)}%` : '—'}</td>
                  <td className="py-2.5 px-3">{m.r2 !== null ? m.r2.toFixed(3) : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-200">
                      Evaluated
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Future Forecast & Replenishment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Future Replenishment & Stock Position Schedule
            </h4>
            <p className="text-[11px] text-slate-500">
              Day-by-day projected units, safety stock calculation, and recommended order replenishment
            </p>
          </div>
          <button
            onClick={() => handleDownload('excel')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Table</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Forecast Date</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Locality</th>
                <th className="py-2.5 px-3">Forecast Units</th>
                <th className="py-2.5 px-3">95% Range</th>
                <th className="py-2.5 px-3">Lead Time Demand</th>
                <th className="py-2.5 px-3">Safety Stock</th>
                <th className="py-2.5 px-3">Current Inventory</th>
                <th className="py-2.5 px-3">Stock Cover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {future.map((f, i) => (
                <tr key={f.date} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{f.date}</td>
                  <td className="py-2.5 px-3">{meta?.selected_sku}</td>
                  <td className="py-2.5 px-3">{meta?.selected_locality}</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-700">{f.forecast_demand_units}</td>
                  <td className="py-2.5 px-3 text-slate-500">
                    [{f.lower_bound} – {f.upper_bound}]
                  </td>
                  <td className="py-2.5 px-3">{f.estimated_lead_time_demand}</td>
                  <td className="py-2.5 px-3">{f.safety_stock_units}</td>
                  <td className="py-2.5 px-3">{f.current_inventory}</td>
                  <td className="py-2.5 px-3">{f.stock_cover_days} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
