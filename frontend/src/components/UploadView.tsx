import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  FileText,
  Calendar,
  Hash,
  Database,
  Store,
  TrendingUp,
  Download
} from 'lucide-react';
import { UploadResponse, SampleDataset, ForecastingMode } from '../types';
import { uploadDatasetFile, inspectSheet, loadSampleDataset } from '../api';

interface UploadViewProps {
  dataset: UploadResponse | null;
  samples: SampleDataset[];
  onDatasetLoaded: (data: UploadResponse) => void;
  onNavigate: (tab: string) => void;
  forecastingMode: ForecastingMode;
  onModeChange: (mode: ForecastingMode) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  dataset,
  samples,
  onDatasetLoaded,
  onNavigate,
  forecastingMode,
  onModeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>(dataset?.active_sheet || 'Default');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processUpload(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUpload(e.target.files[0]);
    }
  };

  const processUpload = async (file: File) => {
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const resp = await uploadDatasetFile(file);
      setSelectedSheet(resp.active_sheet);
      onDatasetLoaded(resp);
      // If dataset detected as hyperlocal, auto-set mode
      if (resp.column_detection?.suggested_mode === 'hyperlocal') {
        onModeChange('hyperlocal');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload dataset. Ensure it is a valid .csv, .xlsx, or .xls file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSheetSwitch = async (sheetName: string) => {
    if (!dataset?.file_id || sheetName === selectedSheet) return;
    setIsUploading(true);
    try {
      const resp = await inspectSheet(dataset.file_id, sheetName);
      setSelectedSheet(sheetName);
      onDatasetLoaded({
        ...dataset,
        active_sheet: sheetName,
        total_rows: resp.total_rows,
        total_columns: resp.total_columns,
        columns: resp.columns,
        preview_data: resp.preview_data,
        column_detection: resp.column_detection,
      });
      if (resp.column_detection?.suggested_mode === 'hyperlocal') {
        onModeChange('hyperlocal');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to switch sheet.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSample = async (sampleId: string) => {
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const resp = await loadSampleDataset(sampleId);
      setSelectedSheet(resp.active_sheet);
      onDatasetLoaded(resp);
      if (resp.is_hyperlocal || resp.column_detection?.suggested_mode === 'hyperlocal') {
        onModeChange('hyperlocal');
      } else {
        onModeChange('revenue');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load sample dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dataset Ingestion & Management</h2>
        <p className="text-xs text-slate-500">
          Upload custom financial or retail spreadsheets (.xlsx, .xls, .csv), switch worksheets, or load benchmark Indian FMCG datasets.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white shadow-2xs ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv, .xlsx, .xls"
          className="hidden"
        />

        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-inner">
          {isUploading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>

        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Drag and drop your spreadsheet here, or browse files
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Supports multi-sheet Excel (.xlsx, .xls) and CSV datasets. Max 50MB.
        </p>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isUploading ? 'Inspecting Dataset...' : 'Choose File to Upload'}
        </button>
      </div>

      {/* Preset Benchmark Datasets Catalog */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Benchmark Enterprise Datasets (One-Click Ingestion)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Real FMCG & Consumer Retail</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {samples.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-all flex flex-col justify-between shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {s.industry}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      s.is_hyperlocal
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {s.is_hyperlocal ? 'Mode B: Hyperlocal SKU' : 'Mode A: Revenue'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{s.name}</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                  {s.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-medium">Frequency: {s.frequency}</span>
                <button
                  onClick={() => handleLoadSample(s.id)}
                  disabled={isUploading}
                  className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center space-x-1 shadow-2xs ${
                    s.is_hyperlocal
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <span>Load Dataset</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded Dataset Inspection & Worksheet Selector */}
      {dataset && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {dataset.company_name} — Ingestion Ready
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Source File: <strong className="text-slate-700">{dataset.filename}</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate(forecastingMode === 'hyperlocal' ? 'hyperlocal-forecast' : 'explorer')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition-colors"
              >
                <span>Proceed to Forecasting Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Excel Multi-Sheet Selector */}
          {dataset.sheets && dataset.sheets.length > 1 && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 mb-2.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Multi-Sheet Workbook Detected (Select Active Worksheet):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dataset.sheets.map((s) => {
                  const isRec = s === dataset.recommended_sheet || s === 'ParleG_Daily_Data';
                  const isSelected = selectedSheet === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleSheetSwitch(s)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{s}</span>
                      {isRec && (
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                            isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Recommended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Column Roles Detection Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Rows</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{dataset.total_rows}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Columns</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{dataset.total_columns}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Detected Date</span>
              <div className="text-xs font-bold text-indigo-700 mt-1 truncate">
                {dataset.column_detection.recommended_date || 'None'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Detected Target</span>
              <div className="text-xs font-bold text-emerald-700 mt-1 truncate">
                {dataset.column_detection.recommended_revenue || 'None'}
              </div>
            </div>
          </div>

          {/* Hyperlocal Features Detected */}
          {(dataset.column_detection?.recommended_sku || dataset.column_detection?.recommended_locality) && (
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-200/60 text-xs">
              <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-700" />
                <span>Hyperlocal SKU Parameters Detected</span>
              </div>
              <div className="flex flex-wrap gap-4 text-emerald-900">
                <span>SKU Column: <strong>{dataset.column_detection.recommended_sku || '—'}</strong> ({dataset.column_detection.unique_skus?.length || 0} SKUs)</span>
                <span>Locality Column: <strong>{dataset.column_detection.recommended_locality || '—'}</strong> ({dataset.column_detection.unique_localities?.length || 0} Localities)</span>
                <span>Brand: <strong>{dataset.column_detection.recommended_brand || 'Parle-G'}</strong></span>
                <span>Pack Size: <strong>{dataset.column_detection.recommended_pack_size || '—'}</strong></span>
              </div>
            </div>
          )}

          {/* Data Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Worksheet Raw Data Preview (First 10 Rows)
              </h4>
              <span className="text-[11px] text-slate-400">
                Showing {Math.min(10, dataset.preview_data.length)} of {dataset.total_rows} records
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {dataset.columns.map((col) => (
                      <th key={col} className="px-3 py-2 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {dataset.preview_data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {dataset.columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px]">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
