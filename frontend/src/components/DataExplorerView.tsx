import React, { useState, useEffect } from 'react';
import {
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Sliders,
  ShieldCheck,
  Search,
  ListFilter
} from 'lucide-react';
import {
  UploadResponse,
  AuditResponse,
  AuditIssue,
  OutlierItem
} from '../types';
import { auditData } from '../api';

interface DataExplorerViewProps {
  dataset: UploadResponse | null;
  dateCol: string;
  setDateCol: (col: string) => void;
  revCol: string;
  setRevCol: (col: string) => void;
  entityCol: string;
  setEntityCol: (col: string) => void;
  frequency: string;
  setFrequency: (freq: string) => void;
  horizon: number;
  setHorizon: (h: number) => void;
  holdoutPeriods: number;
  setHoldoutPeriods: (h: number) => void;
  prepOptions: {
    remove_exact_duplicates: boolean;
    aggregation_method: string;
    missing_revenue_strategy: string;
    sort_chronological: boolean;
  };
  setPrepOptions: React.Dispatch<
    React.SetStateAction<{
      remove_exact_duplicates: boolean;
      aggregation_method: string;
      missing_revenue_strategy: string;
      sort_chronological: boolean;
    }>
  >;
  auditResult: AuditResponse | null;
  setAuditResult: (res: AuditResponse | null) => void;
  onRunForecast: () => void;
  isLoading: boolean;
}

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({
  dataset,
  dateCol,
  setDateCol,
  revCol,
  setRevCol,
  entityCol,
  setEntityCol,
  frequency,
  setFrequency,
  horizon,
  setHorizon,
  holdoutPeriods,
  setHoldoutPeriods,
  prepOptions,
  setPrepOptions,
  auditResult,
  setAuditResult,
  onRunForecast,
  isLoading,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);

  // Auto trigger audit when columns change
  useEffect(() => {
    if (dataset && dateCol && revCol) {
      runAudit();
    }
  }, [dataset, dateCol, revCol, frequency]);

  const runAudit = async () => {
    if (!dataset || !dateCol || !revCol) return;
    setIsAuditing(true);
    try {
      const res = await auditData({
        file_id: dataset.file_id,
        sample_id: (dataset as any).sample_id,
        sheet_name: dataset.active_sheet,
        date_col: dateCol,
        revenue_col: revCol,
        frequency: frequency,
      });
      setAuditResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  if (!dataset) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-2xs">
        <Sliders className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-base mb-1">No Active Dataset</h3>
        <p className="text-xs text-slate-500 mb-4">
          Please upload a spreadsheet or load the benchmark Tata Consumer Products FMCG dataset first.
        </p>
      </div>
    );
  }

  const columns = dataset.columns || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Data Configuration & Quality Audit</h2>
          <p className="text-xs text-slate-500">
            Define target variables, validation splits, econometric frequency, and inspect data health before training models.
          </p>
        </div>

        <button
          onClick={onRunForecast}
          disabled={isLoading || isAuditing}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isLoading ? 'Training Models...' : 'Execute Forecasting Pipeline'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Column Mapping & Split Configuration (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Column Selectors */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
              <Settings className="w-4 h-4 text-indigo-600" />
              <span>Series Mapping & Frequency</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date Column */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date / Period Column <span className="text-rose-500">*</span>
                </label>
                <select
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === dataset.column_detection.recommended_date ? '(Suggested)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports Q1 FY22, 2022-Q1, or standard calendar dates.
                </p>
              </div>

              {/* Revenue Target Column */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revenue Target Column <span className="text-rose-500">*</span>
                </label>
                <select
                  value={revCol}
                  onChange={(e) => setRevCol(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === dataset.column_detection.recommended_revenue ? '(Suggested)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Numeric or formatted currency strings (safe conversion applied).
                </p>
              </div>

              {/* Time Frequency */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reporting Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="Quarterly">Quarterly (m = 4, e.g. FMCG Q1-Q4)</option>
                  <option value="Monthly">Monthly (m = 12)</option>
                  <option value="Daily">Daily</option>
                </select>
              </div>

              {/* Entity / Category Column */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Entity / Segment Column (Optional)
                </label>
                <select
                  value={entityCol}
                  onChange={(e) => setEntityCol(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">None (Single Enterprise Aggregate)</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sliders for Horizon and Validation Holdout */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Forecast Horizon */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Forecast Horizon: <span className="text-indigo-600 font-bold">{horizon} Periods</span>
                  </label>
                  <span className="text-[11px] text-slate-400">1 to 12 periods</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={horizon}
                  onChange={(e) => setHorizon(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Future periods to predict beyond historical actuals.
                </p>
              </div>

              {/* Chronological Validation Holdout */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Validation Holdout: <span className="text-indigo-600 font-bold">{holdoutPeriods} Periods</span>
                  </label>
                  <span className="text-[11px] text-slate-400">2 to 8 periods</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={holdoutPeriods}
                  onChange={(e) => setHoldoutPeriods(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Latest chronological periods withheld for out-of-sample testing.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Data Preparation & Preprocessing Policy */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
              <ListFilter className="w-4 h-4 text-indigo-600" />
              <span>Data Preparation & Imputation Policy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Aggregation method */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Duplicate Period Aggregation
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="agg"
                      checked={prepOptions.aggregation_method === 'sum'}
                      onChange={() => setPrepOptions({ ...prepOptions, aggregation_method: 'sum' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Sum (Recommended for Revenue)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="agg"
                      checked={prepOptions.aggregation_method === 'mean'}
                      onChange={() => setPrepOptions({ ...prepOptions, aggregation_method: 'mean' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Mean Average</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="agg"
                      checked={prepOptions.aggregation_method === 'last'}
                      onChange={() => setPrepOptions({ ...prepOptions, aggregation_method: 'last' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Last Observation</span>
                  </label>
                </div>
              </div>

              {/* Missing target strategy */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Missing Target Imputation
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="missing"
                      checked={prepOptions.missing_revenue_strategy === 'interpolate'}
                      onChange={() => setPrepOptions({ ...prepOptions, missing_revenue_strategy: 'interpolate' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Linear Interpolation</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="missing"
                      checked={prepOptions.missing_revenue_strategy === 'drop'}
                      onChange={() => setPrepOptions({ ...prepOptions, missing_revenue_strategy: 'drop' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Drop Incomplete Rows</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="missing"
                      checked={prepOptions.missing_revenue_strategy === 'ffill'}
                      onChange={() => setPrepOptions({ ...prepOptions, missing_revenue_strategy: 'ffill' })}
                      className="accent-indigo-600"
                    />
                    <span className="text-slate-700">Forward Fill (Last Known)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepOptions.remove_exact_duplicates}
                  onChange={(e) => setPrepOptions({ ...prepOptions, remove_exact_duplicates: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0 accent-indigo-600"
                />
                <span className="text-slate-700 font-medium">Remove exact duplicate rows</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepOptions.sort_chronological}
                  onChange={(e) => setPrepOptions({ ...prepOptions, sort_chronological: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0 accent-indigo-600"
                />
                <span className="text-slate-700 font-medium">Sort strictly by time (ascending)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Data Quality Audit Report */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Data Quality Audit Report</span>
              </div>
              {auditResult && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    auditResult.health_score >= 80
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  Health: {auditResult.health_score}/100
                </span>
              )}
            </div>

            {auditResult ? (
              <div className="space-y-3">
                {/* Status Items */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-600">Valid Observations:</span>
                    <span className="font-bold text-slate-900">{auditResult.valid_observations} Periods</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-600">Date Format:</span>
                    <span className="font-semibold text-indigo-700 capitalize">{auditResult.date_format_detected}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-600">Chronologically Ordered:</span>
                    <span className="font-semibold text-emerald-700">
                      {auditResult.is_chronologically_sorted ? 'Yes (Strict)' : 'No (Auto-sort)'}
                    </span>
                  </div>
                </div>

                {/* Issues & Warnings List */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {auditResult.issues.length === 0 && auditResult.warnings.length === 0 && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Zero integrity flaws detected. High statistical confidence for forecasting.</span>
                    </div>
                  )}

                  {auditResult.issues.map((iss, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">{iss.type.replace('_', ' ').toUpperCase()}</span>
                        <span>{iss.message}</span>
                      </div>
                    </div>
                  ))}

                  {auditResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs flex items-start gap-2"
                    >
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">{warn.type.replace('_', ' ').toUpperCase()}</span>
                        <span>{warn.message}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Outlier Faculty Note */}
                {auditResult.outliers && auditResult.outliers.length > 0 && (
                  <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed">
                    <span className="font-bold block mb-1">MBA Econometric Note on Outliers:</span>
                    In FMCG and Indian corporate revenue (e.g. Tata Consumer, HUL), festive quarters (Q3 Diwali or summer beverages) naturally exhibit legitimate revenue peaks. These are retained by default to avoid deleting valid business demand.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                Running data health audit...
              </div>
            )}
          </div>

          {/* Statistical Summary Panel */}
          {auditResult?.summary_statistics && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Historical Descriptive Statistics
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">MEAN</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.mean} Cr</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">MEDIAN</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.median} Cr</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">MIN</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.min} Cr</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">MAX</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.max} Cr</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">STD DEV</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.std} Cr</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">IQR</span>
                  <span className="font-bold text-slate-800">₹{auditResult.summary_statistics.iqr} Cr</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
