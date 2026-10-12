import axios from 'axios';
import {
  SampleDataset,
  UploadResponse,
  AuditResponse,
  ForecastResponse,
  HyperlocalForecastResponse,
  HyperlocalForecastParams
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://127.0.0.1:8000/api'
    : '/api');

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

export const fetchSamples = async (): Promise<SampleDataset[]> => {
  const res = await api.get('/samples');
  return res.data.samples;
};

export const loadSampleDataset = async (sampleId: string): Promise<UploadResponse> => {
  const res = await api.post('/samples/load', { sample_id: sampleId });
  return res.data;
};

export const uploadDatasetFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getDatasetSheets = async (datasetId: string): Promise<{
  dataset_id: string;
  sheets: string[];
  active_sheet: string;
  recommended_sheet: string;
}> => {
  const res = await api.get(`/dataset/${datasetId}/sheets`);
  return res.data;
};

export const getDatasetPreview = async (
  datasetId: string,
  sheetName?: string,
  limit: number = 20
): Promise<any> => {
  const res = await api.get(`/dataset/${datasetId}/preview`, {
    params: { sheet_name: sheetName, limit }
  });
  return res.data;
};

export const validateColumnMapping = async (
  datasetId: string,
  mapping: {
    date_col: string;
    target_col: string;
    sku_col?: string;
    locality_col?: string;
    brand_col?: string;
    pack_size_col?: string;
    outlet_col?: string;
    inventory_col?: string;
    mode: string;
  }
): Promise<any> => {
  const res = await api.post(`/dataset/${datasetId}/validate`, mapping);
  return res.data;
};

export const inspectSheet = async (fileId: string, sheetName: string): Promise<UploadResponse> => {
  const res = await api.post('/inspect-sheet', {
    file_id: fileId,
    sheet_name: sheetName,
  });
  return res.data;
};

export const auditData = async (params: {
  file_id?: string;
  sample_id?: string;
  sheet_name?: string;
  date_col: string;
  revenue_col: string;
  frequency: string;
}): Promise<AuditResponse> => {
  const res = await api.post('/audit', params);
  return res.data;
};

// MODE A: REVENUE FORECASTING
export const runForecasting = async (params: {
  file_id?: string;
  sample_id?: string;
  sheet_name?: string;
  date_col: string;
  revenue_col: string;
  frequency: string;
  horizon: number;
  holdout_periods?: number;
  preparation: {
    remove_exact_duplicates: boolean;
    aggregation_method: string;
    missing_revenue_strategy: string;
    sort_chronological: boolean;
    entity_col?: string;
  };
  selected_model_id?: string;
}): Promise<ForecastResponse> => {
  const res = await api.post('/revenue/forecast', params);
  return res.data;
};

// MODE B: HYPERLOCAL SKU DEMAND FORECASTING
export const runHyperlocalForecasting = async (
  params: HyperlocalForecastParams
): Promise<HyperlocalForecastResponse> => {
  const res = await api.post('/hyperlocal/forecast', params);
  return res.data;
};

// DOWNLOAD FORECAST BY ID
export const downloadForecastById = async (
  forecastId: string,
  format: 'excel' | 'csv' = 'excel',
  suggestedName: string = 'ByteMinds_Forecast'
) => {
  const response = await api.get(`/forecast/${forecastId}/download`, {
    params: { format },
    responseType: 'blob'
  });
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${suggestedName}.${ext}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const downloadCsvReport = async (forecastData: any, companyName: string) => {
  const response = await api.post(
    '/export/csv',
    { forecast_data: forecastData, company_name: companyName },
    { responseType: 'blob' }
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ByteMinds_Revenue_Forecast_${companyName.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const downloadExcelReport = async (forecastData: any, companyName: string) => {
  const response = await api.post(
    '/export/excel',
    { forecast_data: forecastData, company_name: companyName },
    { responseType: 'blob' }
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ByteMinds_Revenue_Forecast_${companyName.replace(/\s+/g, '_')}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
