import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { ForecastResponse, TimelinePoint, ModelResult } from '../types';

interface ForecastViewProps {
  forecast: ForecastResponse | null;
  onNavigate: (tab: string) => void;
  onSelectModel: (modelId: string) => void;
  selectedModelId: string | null;
}

export const ForecastView: React.FC<ForecastViewProps> = ({
  forecast,
  onNavigate,
  onSelectModel,
  selectedModelId,
}) => {
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [showScenarios, setShowScenarios] = useState(true);
  const [showAllModels, setShowAllModels] = useState(false);

  if (!forecast) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Forecast Generated Yet</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please upload a dataset or load the benchmark Tata Consumer Products data, configure target variables, and run forecasting.
        </p>
        <button
          onClick={() => onNavigate('explorer')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
        >
          Go to Data Configuration
        </button>
      </div>
    );
  }

  const fResults = forecast.forecasting_results;
  const models = fResults.models || [];
  const activeModelId = selectedModelId || fResults.best_model_id;
  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  const history = fResults.historical_timeline || [];
  const future = fResults.future_timeline || [];

  // Prepare Chart Data
  const chartData = [
    ...history.map((h) => {
      const item: any = {
        label: h.label,
        date: h.date,
        actual: h.actual,
        is_validation: h.is_validation,
        is_future: false,
      };
      // Validation prediction for active model
      if (h.is_validation && h[`pred_${activeModelId}`] !== undefined) {
        item.val_pred = h[`pred_${activeModelId}`];
      }
      // If showing all models, add them
      if (showAllModels && h.is_validation) {
        models.forEach((m) => {
          if (h[`pred_${m.id}`] !== undefined) {
            item[`val_${m.id}`] = h[`pred_${m.id}`];
          }
        });
      }
      return item;
    }),
    ...future.map((f) => {
      const activeFuturePred = f[`pred_${activeModelId}`] !== undefined ? f[`pred_${activeModelId}`] : f.best_pred;
      const item: any = {
        label: f.label,
        date: f.date,
        actual: null,
        is_validation: false,
        is_future: true,
        forecast: activeFuturePred,
        lower_bound: f.lower_bound,
        upper_bound: f.upper_bound,
        scenario_optimistic: f.scenario_optimistic,
        scenario_pessimistic: f.scenario_pessimistic,
      };
      if (showAllModels) {
        models.forEach((m) => {
          if (f[`pred_${m.id}`] !== undefined) {
            item[`fut_${m.id}`] = f[`pred_${m.id}`];
          }
        });
      }
      return item;
    }),
  ];

  // Colors for all models when overlayed
  const modelColors: Record<string, string> = {
    model_a_naive: '#94a3b8',
    model_b_seasonal_naive: '#f59e0b',
    model_c_moving_average: '#06b6d4',
    model_d_exponential_smoothing: '#10b981',
    model_e_ridge: '#8b5cf6',
    model_f_random_forest: '#ec4899',
    model_g_gradient_boosting: '#f97316',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Revenue Forecast Studio</h2>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              {forecast.company_name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive multi-model projection with chronological validation holdout and risk scenario corridors.
          </p>
        </div>

        {/* Model Switcher Dropdown */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-600">Active Model:</label>
          <select
            value={activeModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-500/20"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.id === fResults.best_model_id ? '★ (Best Holdout MAE)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Model Status Card & Metric Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">{activeModel.name}</h3>
              <span className="text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {activeModel.category}
              </span>
              {activeModel.id === fResults.best_model_id && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span>★</span> Best Holdout Performer
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{activeModel.description}</p>
          </div>
        </div>

        {/* Metrics Row */}
        {activeModel.metrics && (
          <div className="flex items-center space-x-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold">HOLDOUT MAE</span>
              <span className="font-bold text-slate-900">₹{activeModel.metrics.mae} Cr</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-400 block text-[10px] font-semibold">RMSE</span>
              <span className="font-bold text-slate-900">₹{activeModel.metrics.rmse} Cr</span>
            </div>
            {activeModel.metrics.mape !== null && (
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px] font-semibold">MAPE</span>
                <span className="font-bold text-slate-900">{activeModel.metrics.mape}%</span>
              </div>
            )}
            {activeModel.metrics.r2 !== null && (
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px] font-semibold">R² SCORE</span>
                <span className="font-bold text-slate-900">{activeModel.metrics.r2}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Interactive Recharts Forecast Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        {/* Chart Options & Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Display Options:</span>
            <label className="flex items-center space-x-1.5 cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={showConfidenceInterval}
                onChange={(e) => setShowConfidenceInterval(e.target.checked)}
                className="rounded accent-emerald-600"
              />
              <span className="text-slate-600 font-medium">95% Confidence Corridor</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={showScenarios}
                onChange={(e) => setShowScenarios(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              <span className="text-slate-600 font-medium">±8% Scenario Corridor</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={showAllModels}
                onChange={(e) => setShowAllModels(e.target.checked)}
                className="rounded accent-purple-600"
              />
              <span className="text-slate-600 font-medium">Overlay All 7 Models</span>
            </label>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" /> Actual Historical
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Validation Holdout
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2" /> Forward Forecast
          </div>
        </div>

        {/* Recharts Composed Chart */}
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `₹${v}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs rounded-xl p-3.5 shadow-xl border border-slate-800 space-y-1.5 min-w-[200px]">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-800">
                          <span className="font-bold text-slate-200">{label}</span>
                          <span className="text-[10px] text-slate-400">{d.date}</span>
                        </div>
                        {d.actual !== null && (
                          <div className="text-blue-400 flex justify-between">
                            <span>Actual Revenue:</span>
                            <span className="font-bold text-white">₹{d.actual.toLocaleString()} Cr</span>
                          </div>
                        )}
                        {d.val_pred !== undefined && (
                          <div className="text-amber-400 flex justify-between">
                            <span>Validation Est:</span>
                            <span className="font-bold text-white">₹{d.val_pred.toLocaleString()} Cr</span>
                          </div>
                        )}
                        {d.forecast !== undefined && (
                          <div className="text-emerald-400 flex justify-between">
                            <span>Projected Revenue:</span>
                            <span className="font-bold text-white">₹{d.forecast.toLocaleString()} Cr</span>
                          </div>
                        )}
                        {d.lower_bound !== undefined && showConfidenceInterval && (
                          <div className="text-slate-400 flex justify-between text-[11px] pt-1 border-t border-slate-800/80">
                            <span>95% CI Range:</span>
                            <span className="text-slate-300 font-mono">
                              ₹{d.lower_bound} - ₹{d.upper_bound} Cr
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {/* Confidence Interval Shaded Band */}
              {showConfidenceInterval && (
                <Area
                  type="monotone"
                  dataKey="upper_bound"
                  stroke="none"
                  fill="url(#ciGradient)"
                  name="95% Confidence Corridor"
                />
              )}

              {/* Historical Actuals */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
                name="Historical Actual Revenue"
              />

              {/* Validation Holdout Predictions for active model */}
              <Line
                type="monotone"
                dataKey="val_pred"
                stroke="#f59e0b"
                strokeWidth={2.2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#f59e0b' }}
                name={`Validation Prediction (${activeModel.name.split(':')[1]?.trim()})`}
              />

              {/* Future Forecast for active model */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#10b981"
                strokeWidth={2.8}
                strokeDasharray="5 5"
                dot={{ r: 4.5, fill: '#10b981' }}
                name={`Future Forecast (${activeModel.name.split(':')[1]?.trim()})`}
              />

              {/* Scenarios */}
              {showScenarios && (
                <>
                  <Line
                    type="monotone"
                    dataKey="scenario_optimistic"
                    stroke="#059669"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                    name="Optimistic (+8%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario_pessimistic"
                    stroke="#dc2626"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                    name="Pessimistic (-8%)"
                  />
                </>
              )}

              {/* Multi-model overlay */}
              {showAllModels &&
                models
                  .filter((m) => m.id !== activeModelId && m.status === 'Trained')
                  .map((m) => (
                    <Line
                      key={m.id}
                      type="monotone"
                      dataKey={`fut_${m.id}`}
                      stroke={modelColors[m.id] || '#cbd5e1'}
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      name={m.name.split(':')[1]?.trim()}
                    />
                  ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabular Forecast Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Quarterly Revenue Forecast Breakdown ({fResults.horizon} Quarters Ahead)
            </h3>
            <p className="text-xs text-slate-500">
              Generated by {activeModel.name} with chronological econometric extrapolations.
            </p>
          </div>

          <button
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Forecast Report</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Period</th>
                <th className="px-3.5 py-2.5">Period End</th>
                <th className="px-3.5 py-2.5">Projected Revenue</th>
                <th className="px-3.5 py-2.5">Expected QoQ %</th>
                <th className="px-3.5 py-2.5">Expected YoY %</th>
                <th className="px-3.5 py-2.5">95% Lower Bound</th>
                <th className="px-3.5 py-2.5">95% Upper Bound</th>
                <th className="px-3.5 py-2.5">Optimistic (+8%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {future.map((fut, idx) => {
                const growthObj = fResults.future_growth_insights[idx];
                const predVal = fut[`pred_${activeModelId}`] !== undefined ? fut[`pred_${activeModelId}`] : fut.best_pred;
                return (
                  <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                    <td className="px-3.5 py-2.5 font-bold text-slate-900 font-sans">{fut.label}</td>
                    <td className="px-3.5 py-2.5 text-slate-500">{fut.date}</td>
                    <td className="px-3.5 py-2.5 font-bold text-emerald-600">
                      ₹{predVal ? predVal.toLocaleString() : '—'} Cr
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`font-semibold ${
                          growthObj?.qoq_growth_pct && growthObj.qoq_growth_pct >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {growthObj?.qoq_growth_pct ? `${growthObj.qoq_growth_pct > 0 ? '+' : ''}${growthObj.qoq_growth_pct}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`font-semibold ${
                          growthObj?.yoy_growth_pct && growthObj.yoy_growth_pct >= 0
                            ? 'text-indigo-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {growthObj?.yoy_growth_pct ? `${growthObj.yoy_growth_pct > 0 ? '+' : ''}${growthObj.yoy_growth_pct}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">₹{fut.lower_bound || '—'} Cr</td>
                    <td className="px-3.5 py-2.5 text-slate-500">₹{fut.upper_bound || '—'} Cr</td>
                    <td className="px-3.5 py-2.5 text-emerald-700">₹{fut.scenario_optimistic || '—'} Cr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
