import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path so 'app' is discoverable when launched from project root
_backend_dir = str(Path(__file__).resolve().parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import uuid
import io
import datetime
from typing import Dict, Any, Optional, List
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

try:
    from app.sample_datasets import get_sample_catalogue, get_sample_df
    from app.data_processor import (
        detect_column_roles,
        audit_dataset,
        prepare_and_clean_dataset,
        clean_currency_string,
        parse_period_column
    )
    from app.shared_engine import (
        inspect_workbook_sheets,
        validate_column_mapping
    )
    from app.forecasting import RevenueForecastingEngine
    from app.hyperlocal_forecasting import HyperlocalForecastingEngine
    from app.models import (
        LoadSampleRequest,
        InspectSheetRequest,
        ColumnMappingRequest,
        AuditRequest,
        ForecastRequest,
        HyperlocalForecastRequest,
        ExportForecastRequest
    )
except ImportError:
    from backend.app.sample_datasets import get_sample_catalogue, get_sample_df
    from backend.app.data_processor import (
        detect_column_roles,
        audit_dataset,
        prepare_and_clean_dataset,
        clean_currency_string,
        parse_period_column
    )
    from backend.app.shared_engine import (
        inspect_workbook_sheets,
        validate_column_mapping
    )
    from backend.app.forecasting import RevenueForecastingEngine
    from backend.app.hyperlocal_forecasting import HyperlocalForecastingEngine
    from backend.app.models import (
        LoadSampleRequest,
        InspectSheetRequest,
        ColumnMappingRequest,
        AuditRequest,
        ForecastRequest,
        HyperlocalForecastRequest,
        ExportForecastRequest
    )


app = FastAPI(
    title="ByteMinds Forecasting Studio API",
    description="Enterprise dual-mode revenue intelligence and hyperlocal SKU demand forecasting platform.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for active uploaded files and forecasts
UPLOAD_CACHE: Dict[str, Dict[str, Any]] = {}
FORECAST_CACHE: Dict[str, Dict[str, Any]] = {}

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "ByteMinds Forecasting Studio",
        "version": "2.0.0",
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/api/samples")
def list_samples():
    """Returns catalog of built-in corporate revenue and hyperlocal SKU datasets."""
    return {"samples": get_sample_catalogue()}

@app.post("/api/samples/load")
def load_sample(req: LoadSampleRequest):
    """Loads a pre-configured benchmark dataset (e.g. Parle-G Hyperlocal or Tata Consumer)."""
    df = get_sample_df(req.sample_id)
    catalogue = {s["id"]: s for s in get_sample_catalogue()}
    sample_info = catalogue.get(req.sample_id, catalogue.get("parle_g_daily_sample", {}))
    
    file_id = f"sample_{req.sample_id}_{uuid.uuid4().hex[:8]}"
    sheet_name = sample_info.get("sheet_name", "Default")
    
    UPLOAD_CACHE[file_id] = {
        "df": df,
        "filename": f"{sample_info.get('name', 'Sample')}.xlsx",
        "file_type": "sample",
        "sheets": [sheet_name],
        "active_sheet": sheet_name,
        "company_name": sample_info.get("name", "Sample Entity"),
        "is_hyperlocal": sample_info.get("is_hyperlocal", False)
    }
    
    roles = detect_column_roles(df)
    
    return {
        "file_id": file_id,
        "dataset_id": file_id,
        "sample_id": req.sample_id,
        "company_name": sample_info.get("name", "Sample Entity"),
        "filename": f"{sample_info.get('name', 'Sample')}.xlsx",
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "preview_data": df.head(20).replace({np.nan: None}).to_dict(orient="records"),
        "column_detection": roles,
        "frequency": sample_info.get("frequency", "Daily"),
        "is_sample": True,
        "is_hyperlocal": sample_info.get("is_hyperlocal", False)
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads an Excel (.xlsx, .xls) or CSV dataset, detects sheets, previews data,
    and intelligently suggests columns. For Parle-G workbooks, automatically recommends
    and selects 'ParleG_Daily_Data'.
    """
    filename = file.filename or "uploaded_data.csv"
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload .xlsx, .xls, or .csv files."
        )
        
    content = await file.read()
    file_id = f"upload_{uuid.uuid4().hex[:10]}"
    
    try:
        if ext == ".csv":
            try:
                df = pd.read_csv(io.BytesIO(content))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
            sheets = ["Default"]
            active_sheet = "Default"
            workbook_dict = {"Default": df}
            rec_sheet = "Default"
        else:
            excel_file = pd.ExcelFile(io.BytesIO(content))
            sheets = excel_file.sheet_names
            
            # Recommendation logic:
            if "ParleG_Daily_Data" in sheets:
                rec_sheet = "ParleG_Daily_Data"
            else:
                sheet_res = inspect_workbook_sheets(content, filename)
                rec_sheet = sheet_res.get("recommended_sheet", sheets[0])
                
            active_sheet = rec_sheet if rec_sheet in sheets else sheets[0]
            workbook_dict = {}
            for s in sheets:
                try:
                    workbook_dict[s] = pd.read_excel(excel_file, sheet_name=s)
                except Exception:
                    pass
            df = workbook_dict.get(active_sheet, pd.DataFrame())
            
        UPLOAD_CACHE[file_id] = {
            "workbook": workbook_dict,
            "df": df,
            "filename": filename,
            "file_type": ext[1:],
            "sheets": sheets,
            "active_sheet": active_sheet,
            "recommended_sheet": rec_sheet,
            "company_name": os.path.splitext(filename)[0].replace("_", " ").title()
        }
        
        roles = detect_column_roles(df)
        
        return {
            "file_id": file_id,
            "dataset_id": file_id,
            "filename": filename,
            "file_size_bytes": len(content),
            "sheets": sheets,
            "active_sheet": active_sheet,
            "recommended_sheet": rec_sheet,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "preview_data": df.head(20).replace({np.nan: None}).to_dict(orient="records"),
            "column_detection": roles,
            "is_sample": False
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect uploaded file: {str(e)}")

@app.get("/api/dataset/{dataset_id}/sheets")
def get_dataset_sheets(dataset_id: str):
    """Retrieves all sheet names for an uploaded multi-sheet Excel file."""
    if dataset_id not in UPLOAD_CACHE:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired.")
    cache = UPLOAD_CACHE[dataset_id]
    return {
        "dataset_id": dataset_id,
        "sheets": cache.get("sheets", ["Default"]),
        "active_sheet": cache.get("active_sheet", "Default"),
        "recommended_sheet": cache.get("recommended_sheet", "Default")
    }

@app.get("/api/dataset/{dataset_id}/preview")
def get_dataset_preview(
    dataset_id: str,
    sheet_name: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """Returns row preview, total rows, and detected column roles for dataset/sheet."""
    if dataset_id not in UPLOAD_CACHE:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired.")
    cache = UPLOAD_CACHE[dataset_id]
    
    if sheet_name and "workbook" in cache:
        workbook = cache.get("workbook", {})
        if sheet_name in workbook:
            df = workbook[sheet_name]
            cache["df"] = df
            cache["active_sheet"] = sheet_name
        else:
            df = cache.get("df", pd.DataFrame())
    else:
        df = cache.get("df", pd.DataFrame())
        
    roles = detect_column_roles(df)
    
    return {
        "dataset_id": dataset_id,
        "active_sheet": cache.get("active_sheet", "Default"),
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "preview_data": df.head(limit).replace({np.nan: None}).to_dict(orient="records"),
        "column_detection": roles
    }

@app.post("/api/dataset/{dataset_id}/validate")
def validate_dataset_mapping(dataset_id: str, req: ColumnMappingRequest):
    """Validates user-mapped columns against dataset without starting forecast training."""
    if dataset_id not in UPLOAD_CACHE:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired.")
    df = UPLOAD_CACHE[dataset_id]["df"]
    
    mapping = {
        "date_col": req.date_col,
        "target_col": req.target_col,
        "sku_col": req.sku_col,
        "locality_col": req.locality_col,
        "brand_col": req.brand_col,
        "pack_size_col": req.pack_size_col,
        "outlet_col": req.outlet_col,
        "inventory_col": req.inventory_col
    }
    
    validation_res = validate_column_mapping(df=df, mapping=mapping, mode=req.mode)
    return validation_res

@app.post("/api/inspect-sheet")
def inspect_sheet(req: InspectSheetRequest):
    """Switches sheet in uploaded multi-sheet Excel file (backward compatibility)."""
    if req.file_id not in UPLOAD_CACHE:
        raise HTTPException(status_code=404, detail="File session expired. Please re-upload.")
        
    cache = UPLOAD_CACHE[req.file_id]
    workbook = cache.get("workbook", {})
    if req.sheet_name not in workbook:
        raise HTTPException(status_code=404, detail=f"Sheet '{req.sheet_name}' not found.")
        
    df = workbook[req.sheet_name]
    cache["df"] = df
    cache["active_sheet"] = req.sheet_name
    
    roles = detect_column_roles(df)
    
    return {
        "file_id": req.file_id,
        "dataset_id": req.file_id,
        "sheet_name": req.sheet_name,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "preview_data": df.head(20).replace({np.nan: None}).to_dict(orient="records"),
        "column_detection": roles
    }

def _resolve_dataframe(file_id: Optional[str], sample_id: Optional[str]) -> pd.DataFrame:
    """Helper to retrieve DataFrame from active session or sample."""
    if file_id and file_id in UPLOAD_CACHE:
        return UPLOAD_CACHE[file_id]["df"]
    elif sample_id:
        return get_sample_df(sample_id)
    else:
        return get_sample_df("parle_g_daily_sample")

@app.post("/api/audit")
def audit_data(req: AuditRequest):
    """Audits the selected date and revenue columns for missing values, interval regularity, and outliers."""
    df = _resolve_dataframe(req.file_id, req.sample_id)
    audit_res = audit_dataset(
        df=df,
        date_col=req.date_col,
        revenue_col=req.revenue_col,
        frequency=req.frequency
    )
    return audit_res

# MODE A: COMPANY REVENUE FORECASTING
@app.post("/api/revenue/forecast")
@app.post("/api/forecast")
def run_revenue_forecasting(req: ForecastRequest):
    """
    Mode A: Company Revenue Forecasting pipeline:
    1. Prepares and cleans dataset per user configuration.
    2. Runs chronological holdout validation on econometric & ML models.
    3. Evaluates MAE, RMSE, MAPE, and R².
    4. Projects future revenue for requested horizon.
    5. Stores forecast result with forecast_id for download.
    """
    df = _resolve_dataframe(req.file_id, req.sample_id)
    
    # Clean & Prepare
    prep_opts = req.preparation
    clean_df, prep_report = prepare_and_clean_dataset(
        df=df,
        date_col=req.date_col,
        revenue_col=req.revenue_col,
        remove_exact_duplicates=prep_opts.remove_exact_duplicates,
        aggregation_method=prep_opts.aggregation_method,
        missing_revenue_strategy=prep_opts.missing_revenue_strategy,
        sort_chronological=prep_opts.sort_chronological,
        entity_col=prep_opts.entity_col
    )
    
    if len(clean_df) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(clean_df)} valid observations remain after cleaning. At least 5 observations are required to forecast."
        )
        
    engine = RevenueForecastingEngine(
        series=clean_df['_cleaned_revenue'],
        dates=clean_df['_parsed_date'],
        labels=clean_df['_period_label'],
        frequency=req.frequency,
        holdout_periods=req.holdout_periods
    )
    
    results = engine.run_all(horizon=req.horizon)
    
    if req.selected_model_id:
        selected_exists = any(m["id"] == req.selected_model_id and m["status"] == "Trained" for m in results["models"])
        if selected_exists:
            results["best_model_id"] = req.selected_model_id
            picked_obj = next(m for m in results["models"] if m["id"] == req.selected_model_id)
            results["best_model_name"] = picked_obj["name"]
            
    best_m_info = next((m for m in results["models"] if m["id"] == results["best_model_id"]), None)
    best_mae = best_m_info["metrics"]["mae"] if best_m_info and best_m_info["metrics"] else 0.0
    best_mape = best_m_info["metrics"]["mape"] if best_m_info and best_m_info["metrics"] else 0.0
    
    first_fut = results["future_growth_insights"][0] if results["future_growth_insights"] else None
    cagr_str = f"{results['historical_cagr_pct']:.1f}%" if results['historical_cagr_pct'] is not None else "N/A"
    next_rev_str = f"{first_fut['forecast_revenue']:,.1f}" if first_fut else "N/A"
    
    executive_narrative = (
        f"Based on chronological validation of {results['training_size']} periods against a {results['validation_holdout_size']}-period "
        f"holdout window, {results['best_model_name']} demonstrated the superior predictive accuracy with an MAE of {best_mae:,.1f} "
        f"and MAPE of {best_mape:.1f}%. Historical CAGR reached {cagr_str}. "
        f"For the upcoming period ({first_fut['period'] if first_fut else 'Next'}), projected revenue is {next_rev_str} units."
    )
    
    forecast_id = f"fc_rev_{uuid.uuid4().hex[:10]}"
    company_name = UPLOAD_CACHE.get(req.file_id, {}).get("company_name", "Corporate Revenue") if req.file_id else "Corporate Revenue"
    
    response_payload = {
        "status": "success",
        "forecast_id": forecast_id,
        "mode": "revenue",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "preparation_report": prep_report,
        "forecasting_results": results,
        "executive_narrative": executive_narrative,
        "company_name": company_name
    }
    
    # Cache forecast for retrieval and download
    FORECAST_CACHE[forecast_id] = response_payload
    
    return response_payload

# MODE B: HYPERLOCAL SKU DEMAND FORECASTING
@app.post("/api/hyperlocal/forecast")
def run_hyperlocal_forecasting(req: HyperlocalForecastRequest):
    """
    Mode B: Hyperlocal SKU Demand Forecasting pipeline:
    1. Dynamically filters dataset for the chosen SKU and Locality.
    2. Constructs lag, rolling, calendar, and commercial features without future data leakage.
    3. Performs chronological holdout validation across 7 models (Seasonal Naive, Naive, MA, Exp Smoothing, Ridge, RF, GBM).
    4. Recursively projects demand for the requested horizon (1-30 days / 1-12 weeks).
    5. Computes statistical safety stock and replenishment quantities.
    6. Stores forecast with forecast_id for download.
    """
    df = _resolve_dataframe(req.file_id, req.sample_id)
    
    if len(df) == 0:
        raise HTTPException(status_code=400, detail="Empty dataset provided for hyperlocal forecasting.")
        
    try:
        engine = HyperlocalForecastingEngine(
            df=df,
            date_col=req.date_col,
            target_col=req.target_col,
            sku_col=req.sku_col,
            locality_col=req.locality_col,
            brand_col=req.brand_col,
            pack_size_col=req.pack_size_col,
            outlet_col=req.outlet_col,
            inventory_col=req.inventory_col,
            price_col=req.price_col,
            promotion_col=req.promotion_col,
            competitor_col=req.competitor_col,
            holiday_col=req.holiday_col,
            temperature_col=req.temperature_col,
            rainfall_col=req.rainfall_col,
            selected_sku=req.selected_sku,
            selected_locality=req.selected_locality,
            frequency=req.frequency,
            horizon=req.horizon,
            holdout_periods=req.holdout_periods
        )
        
        rep_opts = req.replenishment
        results = engine.run(
            lead_time_days=rep_opts.lead_time_days,
            review_period_days=rep_opts.review_period_days,
            service_level=rep_opts.service_level,
            min_order_quantity=rep_opts.min_order_quantity,
            case_pack_size=rep_opts.case_pack_size,
            existing_incoming_orders=rep_opts.existing_incoming_orders,
            current_inventory_override=rep_opts.current_inventory_override,
            user_model_choice=req.selected_model
        )
        
        forecast_id = f"fc_hyp_{uuid.uuid4().hex[:10]}"
        company_name = UPLOAD_CACHE.get(req.file_id, {}).get("company_name", "Hyperlocal Store") if req.file_id else "Parle Products Hyperlocal"
        
        response_payload = {
            "status": "success",
            "forecast_id": forecast_id,
            "mode": "hyperlocal",
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "company_name": company_name,
            **results
        }
        
        FORECAST_CACHE[forecast_id] = response_payload
        return response_payload

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hyperlocal forecasting execution failed: {str(e)}")

# GET FORECAST BY ID
@app.get("/api/forecast/{forecast_id}")
def get_forecast_by_id(forecast_id: str):
    """Retrieves computed forecast results by ID."""
    if forecast_id not in FORECAST_CACHE:
        raise HTTPException(status_code=404, detail="Forecast ID not found or expired.")
    return FORECAST_CACHE[forecast_id]

# DOWNLOAD FORECAST RESULTS
@app.get("/api/forecast/{forecast_id}/download")
def download_forecast(forecast_id: str, format: str = Query("excel", pattern="^(excel|csv)$")):
    """Downloads calculated forecast results as an Excel or CSV file."""
    if forecast_id not in FORECAST_CACHE:
        raise HTTPException(status_code=404, detail="Forecast ID not found.")
        
    fc = FORECAST_CACHE[forecast_id]
    mode = fc.get("mode", "revenue")
    
    if mode == "hyperlocal":
        return _export_hyperlocal_forecast(fc, format=format)
    else:
        return _export_revenue_forecast(fc, format=format)

def _export_hyperlocal_forecast(fc: Dict[str, Any], format: str):
    """Generates Excel or CSV download for hyperlocal demand forecast."""
    meta = fc.get("metadata", {})
    sku = meta.get("selected_sku", "SKU")
    locality = meta.get("selected_locality", "Locality")
    clean_name = f"{sku}_{locality}".replace(" ", "_").replace("/", "_")
    
    future = fc.get("future_timeline", [])
    history = fc.get("historical_timeline", [])
    models = fc.get("model_evaluations", [])
    replenish = fc.get("replenishment", {})
    
    # 1. Timeline rows
    rows = []
    for h in history:
        rows.append({
            "Date": h.get("date"),
            "SKU": sku,
            "Locality": locality,
            "Type": "Historical Actual" if not h.get("is_validation") else "Validation Holdout",
            "Actual_Demand_Units": h.get("actual_demand"),
            "Forecast_Demand_Units": h.get("best_model_predicted"),
            "Lower_Bound_95CI": None,
            "Upper_Bound_95CI": None,
            "Inventory": h.get("inventory")
        })
    for f in future:
        rows.append({
            "Date": f.get("date"),
            "SKU": sku,
            "Locality": locality,
            "Type": "Future Forecast",
            "Actual_Demand_Units": None,
            "Forecast_Demand_Units": f.get("forecast_demand_units"),
            "Lower_Bound_95CI": f.get("lower_bound"),
            "Upper_Bound_95CI": f.get("upper_bound"),
            "Inventory": f.get("current_inventory")
        })
    df_timeline = pd.DataFrame(rows)
    df_models = pd.DataFrame(models)
    df_replenish = pd.DataFrame([replenish])
    
    if format == "csv":
        stream = io.StringIO()
        df_timeline.to_csv(stream, index=False)
        stream.seek(0)
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Hyperlocal_Forecast_{clean_name}.csv"}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_timeline.to_excel(writer, sheet_name="Forecast_Timeline", index=False)
            df_models.to_excel(writer, sheet_name="Model_Comparison", index=False)
            df_replenish.to_excel(writer, sheet_name="Replenishment_Plan", index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=ByteMinds_Hyperlocal_Forecast_{clean_name}.xlsx"}
        )

def _export_revenue_forecast(fc: Dict[str, Any], format: str):
    """Generates Excel or CSV download for corporate revenue forecast."""
    company_name = fc.get("company_name", "Revenue").replace(" ", "_")
    f_data = fc.get("forecasting_results", {})
    history = f_data.get("historical_timeline", [])
    future = f_data.get("future_timeline", [])
    models = f_data.get("models", [])
    
    rows = []
    for h in history:
        rows.append({
            "Period": h.get("label"),
            "Date": h.get("date"),
            "Type": "Historical Actual" if not h.get("is_validation") else "Validation Holdout",
            "Actual_Revenue": h.get("actual"),
            "Forecast_Revenue": None,
            "Lower_Bound": None,
            "Upper_Bound": None
        })
    for f in future:
        rows.append({
            "Period": f.get("label"),
            "Date": f.get("date"),
            "Type": "Future Forecast",
            "Actual_Revenue": None,
            "Forecast_Revenue": f.get("best_pred"),
            "Lower_Bound": f.get("lower_bound"),
            "Upper_Bound": f.get("upper_bound")
        })
    df_timeline = pd.DataFrame(rows)
    df_models = pd.DataFrame(models)
    
    if format == "csv":
        stream = io.StringIO()
        df_timeline.to_csv(stream, index=False)
        stream.seek(0)
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=ByteMinds_Revenue_Forecast_{company_name}.csv"}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_timeline.to_excel(writer, sheet_name="Revenue_Forecast", index=False)
            df_models.to_excel(writer, sheet_name="Model_Evaluation", index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=ByteMinds_Revenue_Forecast_{company_name}.xlsx"}
        )

# Backward compatible export endpoints
@app.post("/api/export/csv")
def export_csv(req: ExportForecastRequest):
    return _export_revenue_forecast({"forecasting_results": req.forecast_data, "company_name": req.company_name}, format="csv")

@app.post("/api/export/excel")
def export_excel(req: ExportForecastRequest):
    return _export_revenue_forecast({"forecasting_results": req.forecast_data, "company_name": req.company_name}, format="excel")

@app.get("/api/download/sample-excel/{sample_id}")
def download_sample_excel_file(sample_id: str = "tata_consumer"):
    """Serves raw multi-sheet Excel dataset file."""
    sample_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "sample_data"
    )
    if sample_id in ["parle_g_daily_sample", "parle_g_hyperlocal"]:
        sample_file_path = os.path.join(sample_dir, "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx")
        fn = "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx"
    else:
        sample_file_path = os.path.join(sample_dir, "Tata_Consumer_Products_Quarterly.xlsx")
        fn = "Tata_Consumer_Products_Quarterly_Revenue.xlsx"
        
    if not os.path.exists(sample_file_path):
        sample_file_path = os.path.join(sample_dir, "ByteMinds_Hyperlocal_ParleG_Vadodara.xlsx")
        fn = "ByteMinds_Hyperlocal_ParleG_Vadodara.xlsx"
        
    with open(sample_file_path, "rb") as f:
        file_bytes = f.read()
        
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fn}"}
    )

# Static files mounting for unified production deployment
from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend",
    "dist"
)
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

