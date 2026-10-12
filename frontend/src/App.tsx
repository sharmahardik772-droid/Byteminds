import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { UploadView } from './components/UploadView';
import { DataExplorerView } from './components/DataExplorerView';
import { ForecastView } from './components/ForecastView';
import { HyperlocalForecastView } from './components/HyperlocalForecastView';
import { ModelComparisonView } from './components/ModelComparisonView';
import { ForecastInsightsView } from './components/ForecastInsightsView';
import { ReportsView } from './components/ReportsView';
import { AboutModelView } from './components/AboutModelView';
import {
  SampleDataset,
  UploadResponse,
  AuditResponse,
  ForecastResponse,
  HyperlocalForecastResponse,
  ForecastingMode
} from './types';
import {
  fetchSamples,
  loadSampleDataset,
  runForecasting,
  runHyperlocalForecasting,
  auditData
} from './api';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [forecastingMode, setForecastingMode] = useState<ForecastingMode>('hyperlocal');
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [dataset, setDataset] = useState<UploadResponse | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);

  // Mode A: Revenue Forecast State
  const [revenueForecast, setRevenueForecast] = useState<ForecastResponse | null>(null);
  const [dateCol, setDateCol] = useState<string>('Date');
  const [revCol, setRevCol] = useState<string>('Revenue_Cr');
  const [entityCol, setEntityCol] = useState<string>('');
  const [revFrequency, setRevFrequency] = useState<string>('Quarterly');
  const [revHorizon, setRevHorizon] = useState<number>(4);
  const [revHoldoutPeriods, setRevHoldoutPeriods] = useState<number>(4);
  const [selectedRevModelId, setSelectedRevModelId] = useState<string | null>(null);

  const [prepOptions, setPrepOptions] = useState({
    remove_exact_duplicates: true,
    aggregation_method: 'sum',
    missing_revenue_strategy: 'interpolate',
    sort_chronological: true,
  });

  // Mode B: Hyperlocal SKU Forecast State
  const [hyperlocalForecast, setHyperlocalForecast] = useState<HyperlocalForecastResponse | null>(null);
  const [selectedSku, setSelectedSku] = useState<string>('Parle-G 250g');
  const [selectedLocality, setSelectedLocality] = useState<string>('Amritsar Central');
  const [hypFrequency, setHypFrequency] = useState<string>('daily');
  const [hypHorizon, setHypHorizon] = useState<number>(7);
  const [replenishmentParams, setReplenishmentParams] = useState({
    lead_time_days: 3,
    review_period_days: 7,
    service_level: 0.95,
    min_order_quantity: 0,
    case_pack_size: 1,
    existing_incoming_orders: 0,
    current_inventory_override: undefined,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Initial load: Fetch samples catalogue and load Parle-G Hyperlocal sample dataset
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setStatusMessage('Connecting to ByteMinds Python Forecasting Engine...');
        const sList = await fetchSamples();
        setSamples(sList);

        // Load Parle-G Multi-SKU Hyperlocal dataset by default
        setStatusMessage('Loading Parle-G Multi-SKU Hyperlocal daily dataset...');
        const parleData = await loadSampleDataset('parle_g_daily_sample');
        setDataset(parleData);
        setForecastingMode('hyperlocal');

        const defSku = parleData.column_detection.unique_skus?.[0] || 'Parle-G 250g';
        const defLoc = parleData.column_detection.unique_localities?.[0] || 'Amritsar Central';
        setSelectedSku(defSku);
        setSelectedLocality(defLoc);

        // Execute initial genuine hyperlocal forecast
        setStatusMessage(`Benchmarking 7 models for ${defSku} in ${defLoc}...`);
        const hypResp = await runHyperlocalForecasting({
          sample_id: 'parle_g_daily_sample',
          date_col: 'Date',
          target_col: 'Sales_Quantity',
          sku_col: 'SKU',
          locality_col: 'Locality',
          selected_sku: defSku,
          selected_locality: defLoc,
          frequency: 'daily',
          horizon: 7,
          holdout_periods: 28,
          replenishment: {
            lead_time_days: 3,
            review_period_days: 7,
            service_level: 0.95,
          },
        });
        setHyperlocalForecast(hypResp);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
        setStatusMessage('');
      }
    };

    initializeApp();
  }, []);

  // Handler when user uploads or loads a new dataset
  const handleDatasetLoaded = (newDataset: UploadResponse) => {
    setDataset(newDataset);
    const roles = newDataset.column_detection;

    setDateCol(roles.recommended_date || 'Date');
    setRevCol(roles.recommended_revenue || 'Sales_Quantity');

    if (roles.unique_skus && roles.unique_skus.length > 0) {
      setSelectedSku(roles.unique_skus[0]);
    }
    if (roles.unique_localities && roles.unique_localities.length > 0) {
      setSelectedLocality(roles.unique_localities[0]);
    }

    if (roles.suggested_mode === 'hyperlocal' || newDataset.is_hyperlocal) {
      setForecastingMode('hyperlocal');
      setCurrentTab('hyperlocal-forecast');
    } else {
      setForecastingMode('revenue');
      setCurrentTab('explorer');
    }

    setAuditResult(null);
  };

  // Handler to execute Mode A Revenue Forecast
  const handleExecuteRevenueForecast = async () => {
    if (!dataset || !dateCol || !revCol) {
      alert('Please specify both Date and Revenue target columns.');
      return;
    }
    setIsLoading(true);
    setStatusMessage('Training econometric models (Naive, Exponential Smoothing, Ridge, RF, GBM)...');
    try {
      const resp = await runForecasting({
        file_id: dataset.file_id,
        sample_id: (dataset as any).sample_id,
        sheet_name: dataset.active_sheet,
        date_col: dateCol,
        revenue_col: revCol,
        frequency: revFrequency,
        horizon: revHorizon,
        holdout_periods: revHoldoutPeriods,
        preparation: {
          ...prepOptions,
          entity_col: entityCol || undefined,
        },
        selected_model_id: selectedRevModelId || undefined,
      });
      setRevenueForecast(resp);
      setForecastingMode('revenue');
      setCurrentTab('forecast');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate revenue forecast.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Handler to execute Mode B Hyperlocal SKU Forecast
  const handleExecuteHyperlocalForecast = async () => {
    if (!dataset) {
      alert('Please load or upload a dataset first.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(`Training 7 candidate models for ${selectedSku} in ${selectedLocality}...`);
    try {
      const resp = await runHyperlocalForecasting({
        file_id: dataset.file_id,
        sample_id: (dataset as any).sample_id,
        sheet_name: dataset.active_sheet,
        date_col: dataset.column_detection?.recommended_date || 'Date',
        target_col: dataset.column_detection?.recommended_revenue || 'Sales_Quantity',
        sku_col: dataset.column_detection?.recommended_sku || 'SKU',
        locality_col: dataset.column_detection?.recommended_locality || 'Locality',
        brand_col: dataset.column_detection?.recommended_brand || undefined,
        pack_size_col: dataset.column_detection?.recommended_pack_size || undefined,
        outlet_col: dataset.column_detection?.recommended_outlet || undefined,
        inventory_col: dataset.column_detection?.recommended_inventory || 'Ending_Inventory_Units',
        selected_sku: selectedSku,
        selected_locality: selectedLocality,
        frequency: hypFrequency,
        horizon: hypHorizon,
        holdout_periods: hypFrequency === 'daily' ? 28 : 4,
        replenishment: replenishmentParams,
      });
      setHyperlocalForecast(resp);
      setForecastingMode('hyperlocal');
      setCurrentTab('hyperlocal-forecast');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate hyperlocal forecast.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Quick Loader: Parle-G Sample
  const handleLoadParleGSample = async () => {
    setIsLoading(true);
    setStatusMessage('Loading Parle-G Multi-SKU Hyperlocal dataset...');
    try {
      const resp = await loadSampleDataset('parle_g_daily_sample');
      handleDatasetLoaded(resp);
      const defSku = resp.column_detection.unique_skus?.[0] || 'Parle-G 250g';
      const defLoc = resp.column_detection.unique_localities?.[0] || 'Amritsar Central';
      setSelectedSku(defSku);
      setSelectedLocality(defLoc);

      const hypResp = await runHyperlocalForecasting({
        sample_id: 'parle_g_daily_sample',
        date_col: 'Date',
        target_col: 'Sales_Quantity',
        sku_col: 'SKU',
        locality_col: 'Locality',
        selected_sku: defSku,
        selected_locality: defLoc,
        frequency: 'daily',
        horizon: 7,
        holdout_periods: 28,
        replenishment: replenishmentParams,
      });
      setHyperlocalForecast(hypResp);
      setForecastingMode('hyperlocal');
      setCurrentTab('hyperlocal-forecast');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Quick Loader: Tata Consumer Sample
  const handleLoadTataSample = async () => {
    setIsLoading(true);
    setStatusMessage('Loading Tata Consumer Products quarterly financials...');
    try {
      const resp = await loadSampleDataset('tata_consumer');
      handleDatasetLoaded(resp);
      setDateCol(resp.column_detection.recommended_date);
      setRevCol(resp.column_detection.recommended_revenue);

      const fResp = await runForecasting({
        sample_id: 'tata_consumer',
        date_col: resp.column_detection.recommended_date,
        revenue_col: resp.column_detection.recommended_revenue,
        frequency: 'Quarterly',
        horizon: 4,
        holdout_periods: 4,
        preparation: {
          remove_exact_duplicates: true,
          aggregation_method: 'sum',
          missing_revenue_strategy: 'interpolate',
          sort_chronological: true,
        },
      });
      setRevenueForecast(fResp);
      setForecastingMode('revenue');
      setCurrentTab('forecast');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const activeDatasetName = dataset?.company_name || 'ByteMinds Dataset';
  const hasActiveForecast = forecastingMode === 'hyperlocal' ? hyperlocalForecast !== null : revenueForecast !== null;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        datasetName={activeDatasetName}
        hasForecast={hasActiveForecast}
        forecastingMode={forecastingMode}
        onModeChange={(m) => {
          setForecastingMode(m);
          setCurrentTab(m === 'hyperlocal' ? 'hyperlocal-forecast' : 'forecast');
        }}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Global Header */}
        <Header
          datasetName={activeDatasetName}
          totalRows={dataset?.total_rows}
          frequency={forecastingMode === 'hyperlocal' ? hypFrequency : revFrequency}
          lastGeneratedAt={
            forecastingMode === 'hyperlocal'
              ? (hyperlocalForecast?.generated_at || null)
              : (revenueForecast?.generated_at || null)
          }
          forecastingMode={forecastingMode}
          onModeChange={(m) => {
            setForecastingMode(m);
            setCurrentTab(m === 'hyperlocal' ? 'hyperlocal-forecast' : 'forecast');
          }}
          onOpenUpload={() => setCurrentTab('upload')}
          onLoadParleGSample={handleLoadParleGSample}
          onLoadTataSample={handleLoadTataSample}
          isLoading={isLoading || isInitializing}
        />

        {/* Global Loading Overlay */}
        {(isLoading || isInitializing) && (
          <div className="bg-indigo-600 text-white text-xs py-1.5 px-4 flex items-center justify-center space-x-2 shrink-0 shadow-inner">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-medium">{statusMessage || 'Processing algorithm execution...'}</span>
          </div>
        )}

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {currentTab === 'overview' && (
            <OverviewView
              forecastingMode={forecastingMode}
              onModeChange={setForecastingMode}
              revenueForecast={revenueForecast}
              hyperlocalForecast={hyperlocalForecast}
              dataset={dataset}
              audit={auditResult}
              onNavigate={setCurrentTab}
              onRunRevenueForecast={handleExecuteRevenueForecast}
              onRunHyperlocalForecast={handleExecuteHyperlocalForecast}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'upload' && (
            <UploadView
              dataset={dataset}
              samples={samples}
              onDatasetLoaded={handleDatasetLoaded}
              onNavigate={setCurrentTab}
              forecastingMode={forecastingMode}
              onModeChange={setForecastingMode}
            />
          )}

          {currentTab === 'explorer' && (
            <DataExplorerView
              dataset={dataset}
              dateCol={dateCol}
              setDateCol={setDateCol}
              revCol={revCol}
              setRevCol={setRevCol}
              entityCol={entityCol}
              setEntityCol={setEntityCol}
              frequency={revFrequency}
              setFrequency={setRevFrequency}
              horizon={revHorizon}
              setHorizon={setRevHorizon}
              holdoutPeriods={revHoldoutPeriods}
              setHoldoutPeriods={setRevHoldoutPeriods}
              prepOptions={prepOptions}
              setPrepOptions={setPrepOptions}
              auditResult={auditResult}
              setAuditResult={setAuditResult}
              onRunForecast={handleExecuteRevenueForecast}
              isLoading={isLoading}
            />
          )}

          {/* Mode A: Company Revenue Forecast View */}
          {currentTab === 'forecast' && (
            <ForecastView
              forecast={revenueForecast}
              onNavigate={setCurrentTab}
              onSelectModel={(id) => setSelectedRevModelId(id)}
              selectedModelId={selectedRevModelId}
            />
          )}

          {/* Mode B: Hyperlocal SKU Demand Forecast View */}
          {(currentTab === 'hyperlocal-forecast' || currentTab === 'replenishment') && (
            <HyperlocalForecastView
              forecast={hyperlocalForecast}
              dataset={dataset}
              selectedSku={selectedSku}
              setSelectedSku={setSelectedSku}
              selectedLocality={selectedLocality}
              setSelectedLocality={setSelectedLocality}
              horizon={hypHorizon}
              setHorizon={setHypHorizon}
              frequency={hypFrequency}
              setFrequency={setHypFrequency}
              replenishmentParams={replenishmentParams}
              setReplenishmentParams={setReplenishmentParams}
              onExecuteForecast={handleExecuteHyperlocalForecast}
              isLoading={isLoading}
            />
          )}

          {/* Model Comparison View (Dual Mode) */}
          {currentTab === 'comparison' && (
            <ModelComparisonView
              forecastingMode={forecastingMode}
              revenueForecast={revenueForecast}
              hyperlocalForecast={hyperlocalForecast}
              onSelectRevenueModel={(id) => {
                setSelectedRevModelId(id);
                setCurrentTab('forecast');
              }}
              selectedModelId={selectedRevModelId}
              onNavigate={setCurrentTab}
            />
          )}

          {/* Forecast Insights View */}
          {currentTab === 'insights' && (
            <ForecastInsightsView
              forecast={revenueForecast}
              onNavigate={setCurrentTab}
            />
          )}

          {/* Reports & Exports View (Dual Mode) */}
          {currentTab === 'reports' && (
            <ReportsView
              forecastingMode={forecastingMode}
              revenueForecast={revenueForecast}
              hyperlocalForecast={hyperlocalForecast}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'about' && <AboutModelView />}
        </main>
      </div>
    </div>
  );
};

export default App;
