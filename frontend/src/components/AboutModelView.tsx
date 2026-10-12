import React from 'react';
import {
  BookOpen,
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Brain,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

export const AboutModelView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Econometric & Machine Learning Methodology</h2>
        <p className="text-xs text-slate-500">
          Academic documentation and algorithmic theory designed for MBA project presentation and faculty evaluation.
        </p>
      </div>

      {/* Model Architectures Breakdown */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-600" />
          <span>The 7 Implemented Forecasting Architectures</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Model A */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model A: Naive Forecast</span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                Baseline
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <strong className="text-slate-800">Formula:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded">ŷ_{'{t+h}'} = y_T</code>. Assumes future periods equal the latest observed historical revenue. Serves as the fundamental lower-bound benchmark for all time-series evaluations.
            </p>
          </div>

          {/* Model B */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model B: Seasonal Naive</span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                Baseline
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <strong className="text-slate-800">Formula:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded">ŷ_{'{T+h}'} = y_{'{T+h-m}'}</code> where <code className="bg-slate-100 px-1 py-0.5 rounded">m = 4</code> for quarterly data. Predicts revenue equal to the corresponding quarter of the prior year, capturing festive patterns.
            </p>
          </div>

          {/* Model C */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model C: Moving Average</span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Statistical
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <strong className="text-slate-800">Formula:</strong> Rolling arithmetic mean of recent <code className="bg-slate-100 px-1 py-0.5 rounded">k</code> periods (default 4). Dampens quarterly volatility but lags during sharp revenue inflections.
            </p>
          </div>

          {/* Model D */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model D: Exponential Smoothing (Holt-Winters)</span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Statistical / Statsmodels
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Implemented using Python <code className="bg-slate-100 px-1 py-0.5 rounded">statsmodels.tsa.api.ExponentialSmoothing</code>. Decomposes revenue into exponential level, additive linear trend, and quarterly seasonal indices. State-of-the-art for quarterly FMCG.
            </p>
          </div>

          {/* Model E */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model E: Ridge Regression (L2)</span>
              <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                Machine Learning
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Constructs chronological autoregressive features (<code className="bg-slate-100 px-1 py-0.5 rounded">Lag-1, Lag-2, Lag-4</code>) and regularizes with an L2 Tikhonov penalty (<code className="bg-slate-100 px-1 py-0.5 rounded">α = 1.0</code>) to prevent coefficient explosion.
            </p>
          </div>

          {/* Model F */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model F: Random Forest Regressor</span>
              <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                Machine Learning
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Ensemble of 100 decision trees utilizing lagged revenue, rolling moving averages, and seasonal calendar quarters. Constrained depth (<code className="bg-slate-100 px-1 py-0.5 rounded">max_depth = 3</code>) to prevent overfitting on short series.
            </p>
          </div>

          {/* Model G */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Model G: Gradient Boosting Regressor</span>
              <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                Machine Learning
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Iterative boosting of pseudo-residuals via <code className="bg-slate-100 px-1 py-0.5 rounded">scikit-learn GradientBoostingRegressor</code> (<code className="bg-slate-100 px-1 py-0.5 rounded">learning_rate = 0.08</code>). Sequentially targets error patterns from earlier estimators.
            </p>
          </div>
        </div>
      </div>

      {/* Chronological Validation Protocol */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Why Chronological Validation is Required (No Data Leakage)</span>
        </h3>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            In standard machine learning classification and cross-sectional regression, datasets are randomly partitioned into train and test splits (e.g., 5-Fold Cross-Validation). In financial time series, <strong className="text-slate-800">random shuffling is fatally flawed</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
            <li>
              <strong>Look-Ahead Bias:</strong> Shuffling feeds future information (e.g. Q4 FY25 revenue) into a model to predict past periods (e.g. Q1 FY23), creating artificial, non-replicable accuracy.
            </li>
            <li>
              <strong>Autocorrelation Violation:</strong> Successive quarterly sales exhibit strong serial correlation. Randomly holding out isolated points leaks neighborhood information.
            </li>
            <li>
              <strong>Real-World Replication:</strong> In real corporate planning, executives must forecast unseen future quarters based strictly on past history. The studio strictly enforces chronological holdout splits.
            </li>
          </ul>
        </div>
      </div>

      {/* MBA Faculty Rubric Reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Award className="w-4 h-4 text-indigo-600" />
          <span>MBA Capstone Faculty Evaluation Checklist</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Real scikit-learn and statsmodels implementation (zero simulated or hardcoded values).</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Excel (.xlsx) multi-sheet ingestion and custom CSV support.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Comparative benchmarking across 7 distinct econometric paradigms.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Full export suite (CSV, multi-sheet Excel, and print-ready executive memo).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
