import React from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  HelpCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  Store,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  ForecastResponse,
  HyperlocalForecastResponse,
  ForecastingMode
} from '../types';

interface ModelComparisonViewProps {
  forecastingMode: ForecastingMode;
  revenueForecast: ForecastResponse | null;
  hyperlocalForecast: HyperlocalForecastResponse | null;
  onSelectRevenueModel: (modelId: string) => void;
  selectedModelId: string | null;
  onNavigate: (tab: string) => void;
}

export const ModelComparisonView: React.FC<ModelComparisonViewProps> = ({
  forecastingMode,
  revenueForecast,
  hyperlocalForecast,
  onSelectRevenueModel,
  selectedModelId,
  onNavigate,
}) => {
  const isHyperlocal = forecastingMode === 'hyperlocal';

  // Check if active forecast is available
  if (isHyperlocal && !hyperlocalForecast) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Hyperlocal Model Evaluations Available</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please run a Hyperlocal SKU forecast to evaluate the 7 candidate models across chronological holdouts.
        </p>
        <button
          onClick={() => onNavigate('hyperlocal-forecast')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
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
        <h3 className="font-bold text-slate-900 text-base mb-1">No Revenue Model Evaluations Available</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please execute the company revenue forecasting pipeline to evaluate candidate algorithms.
        </p>
        <button
          onClick={() => onNavigate('forecast')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
        >
          Open Revenue Workspace
        </button>
      </div>
    );
  }

  // Hyperlocal Model Data
  const hypEvaluations = hyperlocalForecast?.model_evaluations || [];
  const hypMeta = hyperlocalForecast?.metadata;

  // Revenue Model Data
  const revResults = revenueForecast?.forecasting_results;
  const revModels = revResults?.models || [];
  const activeRevModelId = selectedModelId || revResults?.best_model_id;

  interface ChartItem {
    name: string;
    mae: number;
    rmse: number;
    mape: number;
    wape: number;
    isBest: boolean;
    rank: number;
  }

  // Format chart data based on mode
  const chartData: ChartItem[] = isHyperlocal
    ? hypEvaluations.map((m) => ({
        name: m.model_name,
        mae: m.mae,
        rmse: m.rmse,
        mape: m.mape || 0,
        wape: m.wape || 0,
        isBest: m.model_name === hypMeta?.best_model,
        rank: m.rank,
      }))
    : revModels
        .filter((m) => m.status === 'Trained' && m.metrics)
        .map((m, idx) => ({
          name: m.name.split(':')[1]?.trim() || m.name,
          mae: m.metrics?.mae || 0,
          rmse: m.metrics?.rmse || 0,
          mape: m.metrics?.mape || 0,
          wape: 0,
          isBest: m.id === revResults?.best_model_id,
          rank: idx + 1,
        }))
        .sort((a, b) => a.mae - b.mae);

  const bestModelLabel = isHyperlocal
    ? hypMeta?.best_model
    : (revResults?.best_model_name?.split(':')[1]?.trim() || revResults?.best_model_name);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Model Comparison & Out-of-Sample Leaderboard</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isHyperlocal
              ? `Chronological holdout evaluation of 7 candidate models for ${hypMeta?.selected_sku} in ${hypMeta?.selected_locality}.`
              : `Rigorous out-of-sample chronological evaluation across 7 forecasting algorithms on ${revResults?.validation_holdout_size} holdout quarters.`}
          </p>
        </div>

        {/* Winner Highlight Pill */}
        <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs shadow-2xs">
          <Award className="w-4 h-4 text-amber-600" />
          <span className="font-semibold">Winner by Lowest MAE:</span>
          <span className="font-bold">{bestModelLabel}</span>
        </div>
      </div>

      {/* Two Comparison Charts: MAE & RMSE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: MAE Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Mean Absolute Error (MAE) Comparison
              </h3>
              <p className="text-[11px] text-slate-400">Lower error indicates higher predictive accuracy</p>
            </div>
            <span className="text-[11px] font-bold text-emerald-600">Primary Benchmark</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 9 }}
                  width={130}
                  stroke="#475569"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="mae" name="MAE" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isBest ? '#10b981' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: RMSE Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Root Mean Squared Error (RMSE) Comparison
              </h3>
              <p className="text-[11px] text-slate-400">Penalizes large outlier forecast misses</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 9 }}
                  width={130}
                  stroke="#475569"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="rmse" name="RMSE" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-rmse-${index}`}
                      fill={entry.isBest ? '#10b981' : '#818cf8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Cards / Leaderboard Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Detailed Model Evaluation Matrix</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">MAE</th>
                <th className="py-2.5 px-3">RMSE</th>
                <th className="py-2.5 px-3">MAPE / WAPE</th>
                <th className="py-2.5 px-3">Validation Methodology</th>
                <th className="py-2.5 px-3">Evaluation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isHyperlocal
                ? hypEvaluations.map((m) => (
                    <tr
                      key={m.model_name}
                      className={m.model_name === hypMeta?.best_model ? 'bg-emerald-50/50 font-semibold' : ''}
                    >
                      <td className="py-3 px-3 font-medium text-slate-900 flex items-center space-x-2">
                        <span>{m.model_name}</span>
                        {m.model_name === hypMeta?.best_model && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded font-bold">
                            Winner
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {m.model_name.includes('Baseline')
                          ? 'Baseline'
                          : m.model_name.includes('Forest') || m.model_name.includes('Boosting') || m.model_name.includes('Ridge')
                          ? 'Machine Learning'
                          : 'Statistical'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{m.mae.toFixed(1)}</td>
                      <td className="py-3 px-3">{m.rmse.toFixed(1)}</td>
                      <td className="py-3 px-3">{m.wape !== null ? `${m.wape.toFixed(1)}%` : '—'}</td>
                      <td className="py-3 px-3 text-slate-500">
                        Chronological holdout ({hypMeta?.holdout_periods} {hypMeta?.frequency?.toLowerCase()})
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-200">
                          Trained & Validated
                        </span>
                      </td>
                    </tr>
                  ))
                : revModels.map((m) => (
                    <tr
                      key={m.id}
                      className={m.id === revResults?.best_model_id ? 'bg-indigo-50/50 font-semibold' : ''}
                    >
                      <td className="py-3 px-3 font-medium text-slate-900 flex items-center space-x-2">
                        <span>{m.name}</span>
                        {m.id === revResults?.best_model_id && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-bold">
                            Winner
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{m.category}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{m.metrics?.mae?.toFixed(1) || '—'}</td>
                      <td className="py-3 px-3">{m.metrics?.rmse?.toFixed(1) || '—'}</td>
                      <td className="py-3 px-3">
                        {m.metrics?.mape !== null && m.metrics?.mape !== undefined
                          ? `${m.metrics.mape.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        Chronological holdout ({m.metrics?.validation_periods || 4} Quarters)
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            m.status === 'Trained'
                              ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
