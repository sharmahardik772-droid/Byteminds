import React from 'react';
import {
  Lightbulb,
  TrendingUp,
  Calendar,
  Sparkles,
  PieChart,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Package,
  Layers
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
import { ForecastResponse } from '../types';

interface ForecastInsightsViewProps {
  forecast: ForecastResponse | null;
  onNavigate: (tab: string) => void;
}

export const ForecastInsightsView: React.FC<ForecastInsightsViewProps> = ({
  forecast,
  onNavigate,
}) => {
  if (!forecast) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Insights Generated</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please run the forecasting pipeline first to generate econometric insights and seasonality decomposition.
        </p>
      </div>
    );
  }

  const fResults = forecast.forecasting_results;
  const growthInsights = fResults.future_growth_insights || [];
  const seasonalIndices = fResults.seasonal_indices || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Business Insights & Seasonality</h2>
        <p className="text-xs text-slate-500">
          Econometric decomposition, quarterly seasonality multipliers, and strategic C-suite decision commentary for {forecast.company_name}.
        </p>
      </div>

      {/* Dynamic Executive AI Briefing */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md space-y-3">
        <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Automated AI Executive Narrative</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-normal">
          {forecast.executive_narrative}
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-800">
          <div>
            Historical CAGR:{' '}
            <span className="font-bold text-white">
              {fResults.historical_cagr_pct ? `${fResults.historical_cagr_pct}%` : 'N/A'}
            </span>
          </div>
          <div>
            Evaluated Quarters:{' '}
            <span className="font-bold text-white">{fResults.total_observations} Quarters</span>
          </div>
          <div>
            Winning Architecture:{' '}
            <span className="font-bold text-emerald-400">{fResults.best_model_name}</span>
          </div>
        </div>
      </div>

      {/* Two Grid Cards: Seasonality Indices + Growth Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonality Decomposition Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Quarterly Seasonality Multiplier (FMCG Cycle)
              </h3>
              <p className="text-[11px] text-slate-400">
                Index relative to full-year average (1.00 = Average Quarter).
              </p>
            </div>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {seasonalIndices.map((s) => (
              <div
                key={s.quarter}
                className={`p-3 rounded-xl border text-center ${
                  s.seasonal_index >= 1.0
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-bold text-xs text-slate-900 block">{s.quarter}</span>
                <span
                  className={`text-lg font-extrabold block my-0.5 ${
                    s.seasonal_index >= 1.0 ? 'text-emerald-600' : 'text-slate-600'
                  }`}
                >
                  {s.seasonal_index.toFixed(2)}x
                </span>
                <span className="text-[10px] text-slate-500 font-medium">{s.interpretation}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800 block mb-0.5">Quarterly Dynamics in Indian FMCG:</span>
            Q3 (October–December) captures peak Diwali and wedding festival demand across packaged foods and beverages. Q4 maintains robust wholesale replenishment, whereas Q1 reflects normalized post-festive baselines.
          </div>
        </div>

        {/* Projected Growth Rates Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Projected Growth Velocity (% QoQ & YoY)
              </h3>
              <p className="text-[11px] text-slate-400">Expected percentage changes for future forecast horizon.</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthInsights} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Growth Rate']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', fontSize: '11px', borderRadius: '8px' }}
                />
                <Bar dataKey="qoq_growth_pct" name="QoQ % Growth" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="yoy_growth_pct" name="YoY % Growth" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center space-x-6 text-[11px] text-slate-500 pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>QoQ % Growth</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>YoY % Growth</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic MBA Planning Recommendations */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">
          Strategic Executive Recommendations (MBA Capstone Evaluation)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Working Capital */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-700 font-bold">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>Inventory & Working Capital Buffer</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              With projected forward revenue expanding, procurement teams should initiate inventory stocking 60 days ahead of Q3 festive peaks to optimize bulk freight and avoid spot-market raw material premiums.
            </p>
          </div>

          {/* Card 2: Revenue Headwind Mitigation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-700 font-bold">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Margin & Pricing Power</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              FMCG gross margins remain sensitive to tea, coffee, and agricultural commodity inputs. Econometric models indicate that revenue momentum is resilient enough to absorb selective 2–3% price interventions without demand destruction.
            </p>
          </div>

          {/* Card 3: Model Governance */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-purple-700 font-bold">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Quarterly Re-calibration Cadence</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Upon publication of audited quarterly earnings, the studio should execute chronological backtesting to update lag coefficients, verifying whether Exponential Smoothing continues to outperform Ridge Regression.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
