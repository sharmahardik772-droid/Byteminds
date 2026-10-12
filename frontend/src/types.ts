export type ForecastingMode = 'revenue' | 'hyperlocal';

export interface ColumnDetection {
  recommended_date: string;
  date_candidates: string[];
  recommended_revenue: string;
  revenue_candidates: string[];
  category_columns: string[];
  recommended_sku?: string | null;
  recommended_locality?: string | null;
  recommended_brand?: string | null;
  recommended_pack_size?: string | null;
  recommended_outlet?: string | null;
  recommended_inventory?: string | null;
  recommended_replenishment?: string | null;
  recommended_promotion?: string | null;
  weather_columns?: string[];
  unique_skus?: string[];
  unique_localities?: string[];
  unique_brands?: string[];
  suggested_mode?: ForecastingMode;
}

export interface SampleDataset {
  id: string;
  name: string;
  industry: string;
  frequency: string;
  periods: number;
  date_range: string;
  description: string;
  recommended_target: string;
  recommended_date: string;
  sku?: string;
  locality?: string;
  is_hyperlocal?: boolean;
  sheet_name?: string;
}

export interface UploadResponse {
  file_id: string;
  dataset_id?: string;
  filename: string;
  file_size_bytes?: number;
  sheets: string[];
  active_sheet: string;
  recommended_sheet?: string;
  company_name: string;
  total_rows: number;
  total_columns: number;
  columns: string[];
  preview_data: Record<string, any>[];
  column_detection: ColumnDetection;
  is_sample: boolean;
  is_hyperlocal?: boolean;
}

export interface AuditIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning' | 'info';
  count: number;
  message: string;
}

export interface OutlierItem {
  period: string;
  value: number;
  reason: string;
}

export interface SummaryStats {
  count: number;
  mean: number;
  std: number;
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
  iqr: number;
}

export interface AuditResponse {
  status: 'ready' | 'unsuitable' | 'error';
  health_score: number;
  total_rows: number;
  valid_observations: number;
  date_format_detected: string;
  is_chronologically_sorted: boolean;
  summary_statistics: SummaryStats;
  outliers: OutlierItem[];
  issues: AuditIssue[];
  warnings: AuditIssue[];
  message?: string;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  mape: number | null;
  r2: number | null;
  r2_meaningful: boolean;
  validation_periods: number;
}

export interface ModelResult {
  id: string;
  name: string;
  category: 'Baseline' | 'Statistical' | 'Machine Learning';
  status: 'Trained' | 'Ineligible';
  metrics: ModelMetrics | null;
  val_predictions: number[];
  future_predictions: number[];
  description: string;
  warnings: string[];
}

export interface TimelinePoint {
  index: number;
  label: string;
  date: string;
  actual: number | null;
  is_validation: boolean;
  is_future: boolean;
  best_pred?: number;
  lower_bound?: number;
  upper_bound?: number;
  scenario_optimistic?: number;
  scenario_pessimistic?: number;
  [key: string]: any;
}

export interface GrowthInsight {
  period: string;
  date: string;
  forecast_revenue: number;
  qoq_growth_pct: number;
  yoy_growth_pct: number | null;
  lower_bound?: number;
  upper_bound?: number;
}

export interface SeasonalIndex {
  quarter: string;
  average_revenue: number;
  seasonal_index: number;
  interpretation: string;
}

export interface ForecastingResults {
  best_model_id: string;
  best_model_name: string;
  models: ModelResult[];
  validation_holdout_size: number;
  training_size: number;
  total_observations: number;
  frequency: string;
  horizon: number;
  historical_timeline: TimelinePoint[];
  future_timeline: TimelinePoint[];
  future_growth_insights: GrowthInsight[];
  seasonal_indices: SeasonalIndex[];
  historical_cagr_pct: number | null;
  validation_note: string;
}

export interface PreparationReport {
  original_rows: number;
  prepared_rows: number;
  rows_removed_or_aggregated: number;
  date_format: string;
  first_period: string;
  last_period: string;
  min_revenue: number;
  max_revenue: number;
  mean_revenue: number;
  active_revenue_col?: string;
  active_date_col?: string;
}

export interface ForecastResponse {
  status: string;
  forecast_id?: string;
  mode?: string;
  generated_at: string;
  preparation_report: PreparationReport;
  forecasting_results: ForecastingResults;
  executive_narrative: string;
  company_name: string;
}

// HYPERLOCAL FORECASTING SPECIFIC TYPES
export interface HyperlocalMetadata {
  selected_sku: string;
  selected_locality: string;
  brand: string | null;
  pack_size: string | null;
  frequency: string;
  horizon: number;
  holdout_periods: number;
  training_periods: number;
  total_valid_observations: number;
  best_model: string;
  best_model_metrics: {
    model_name: string;
    mae: number;
    rmse: number;
    wape: number | null;
    mape: number | null;
    r2: number | null;
    rank: number;
  };
  available_skus: string[];
  available_localities: string[];
  available_brands: string[];
}

export interface HyperlocalHistoricalPoint {
  date: string;
  actual_demand: number;
  is_validation: boolean;
  best_model_predicted: number | null;
  naive_predicted: number | null;
  residual_error: number | null;
  inventory?: number | null;
}

export interface HyperlocalFuturePoint {
  date: string;
  forecast_demand_units: number;
  lower_bound: number;
  upper_bound: number;
  lag_reference: number;
  rolling_mean: number;
  rolling_std: number;
  is_future: boolean;
  estimated_lead_time_demand?: number;
  safety_stock_units?: number;
  current_inventory?: number;
  stock_cover_days?: number;
}

export interface HyperlocalModelEvaluation {
  model_name: string;
  mae: number;
  rmse: number;
  wape: number | null;
  mape: number | null;
  r2: number | null;
  rank: number;
}

export interface ReplenishmentReport {
  current_inventory: number;
  incoming_orders: number;
  inventory_position: number;
  lead_time_days: number;
  review_period_days: number;
  protection_period_days: number;
  service_level_pct: number;
  z_score: number;
  lead_time_demand_units: number;
  safety_stock_units: number;
  target_stock_units: number;
  suggested_order_quantity: number;
  stock_cover_days: number;
  stockout_risk: 'High' | 'Moderate' | 'Low';
  min_order_quantity: number;
  case_pack_size: number;
}

export interface SKUComparisonItem {
  sku: string;
  total_sales: number;
  average_daily_sales: number;
  records_count: number;
  is_selected: boolean;
}

export interface LocalityComparisonItem {
  locality: string;
  total_sales: number;
  average_daily_sales: number;
  records_count: number;
  is_selected: boolean;
}

export interface FeatureAvailabilityItem {
  feature_name: string;
  category: string;
  non_null_count: number;
  sample_value: any;
}

export interface HyperlocalForecastResponse {
  status: string;
  forecast_id: string;
  mode: 'hyperlocal';
  generated_at: string;
  company_name: string;
  metadata: HyperlocalMetadata;
  historical_timeline: HyperlocalHistoricalPoint[];
  future_timeline: HyperlocalFuturePoint[];
  model_evaluations: HyperlocalModelEvaluation[];
  replenishment: ReplenishmentReport;
  sku_comparison: SKUComparisonItem[];
  locality_comparison: LocalityComparisonItem[];
  feature_availability: FeatureAvailabilityItem[];
  cleaning_diagnostics: Record<string, any>;
}

export interface HyperlocalForecastParams {
  file_id?: string;
  sample_id?: string;
  sheet_name?: string;
  date_col: string;
  target_col: string;
  sku_col?: string;
  locality_col?: string;
  brand_col?: string;
  pack_size_col?: string;
  outlet_col?: string;
  inventory_col?: string;
  price_col?: string;
  promotion_col?: string;
  competitor_col?: string;
  holiday_col?: string;
  temperature_col?: string;
  rainfall_col?: string;
  selected_sku?: string;
  selected_locality?: string;
  frequency?: string;
  horizon?: number;
  holdout_periods?: number;
  selected_model?: string;
  replenishment?: {
    lead_time_days?: number;
    review_period_days?: number;
    service_level?: number;
    min_order_quantity?: number;
    case_pack_size?: number;
    existing_incoming_orders?: number;
    current_inventory_override?: number;
  };
}
