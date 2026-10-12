import os
import re
import math
import io
import datetime
from typing import Dict, Any, List, Optional, Tuple, Union
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def clean_currency_or_number(val: Any) -> Tuple[Optional[float], bool]:
    """
    Safely converts a currency or formatted numeric string or number to float.
    Handles INR/USD/EUR symbols, commas, decimals, parenthesized negatives, and units.
    Does NOT treat 0 as an invalid value.
    """
    if pd.isna(val) or val is None:
        return None, True
    if isinstance(val, (int, float, np.number)):
        if math.isnan(val):
            return None, True
        return float(val), True

    s = str(val).strip()
    if s == "" or s.lower() in ["-", "--", "n/a", "na", "null", "none", "—", "nan"]:
        return None, True

    is_neg = False
    if s.startswith("(") and s.endswith(")"):
        is_neg = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_neg = True
        s = s[1:].strip()

    # Strip currency symbols, spaces, commas, percentage, and common unit terms
    s_clean = re.sub(r'[₹$€£,%\s\xa0]', '', s)
    s_clean = re.sub(r'(?i)cr|crore|crores|inr|rs\.?|usd|lakh|lakhs|mn|bn|units?|g|kg|pcs', '', s_clean).strip()

    try:
        num = float(s_clean)
        return -num if is_neg else num, True
    except ValueError:
        pass

    # Fallback regex extraction of first numeric match
    m = re.search(r'[-+]?\d+(?:,\d+)*(?:\.\d+)?', str(val).replace(' ', ''))
    if m:
        num_str = m.group(0).replace(',', '')
        try:
            num = float(num_str)
            return -num if is_neg else num, True
        except ValueError:
            pass

    return None, False


def robust_parse_date(val: Any) -> Optional[pd.Timestamp]:
    """
    Robustly parses dates across standard formats, Excel serials, and fiscal quarter strings.
    """
    if pd.isna(val) or val is None:
        return None

    if isinstance(val, (pd.Timestamp, datetime.date, datetime.datetime)):
        return pd.Timestamp(val)

    if isinstance(val, (int, float, np.number)):
        # Excel serial days since 1899-12-30
        if 30000 <= val <= 70000:
            try:
                return pd.to_datetime(val, unit='D', origin='1899-12-30')
            except Exception:
                pass
        elif 1990 <= val <= 2050:
            return pd.Timestamp(year=int(val), month=12, day=31)

    s = str(val).strip()
    if s == "" or s.lower() in ["nan", "null", "none", "—", "nat"]:
        return None

    # Fiscal Quarters e.g. 'Q1 FY24', 'FY24 Q1'
    m_fy = re.search(r'(?i)Q([1-4])\s*(?:FY|F\.Y\.)?\s*(\d{2,4})', s)
    if not m_fy:
        m_fy = re.search(r'(?i)(?:FY|F\.Y\.)\s*(\d{2,4})(?:[-/]\d{2,4})?\s*[-_/]?\s*Q([1-4])', s)
        if m_fy:
            yr_str, q_str = m_fy.group(1), m_fy.group(2)
        else:
            yr_str, q_str = None, None
    else:
        q_str, yr_str = m_fy.group(1), m_fy.group(2)

    if q_str and yr_str:
        q = int(q_str)
        yr = int(yr_str)
        if yr < 100:
            yr += 2000
        if q == 1:
            return pd.Timestamp(year=yr - 1, month=6, day=30)
        elif q == 2:
            return pd.Timestamp(year=yr - 1, month=9, day=30)
        elif q == 3:
            return pd.Timestamp(year=yr - 1, month=12, day=31)
        else:
            return pd.Timestamp(year=yr, month=3, day=31)

    # Calendar quarters e.g. '2024-Q1', '2024Q1', 'Q1 2024'
    m_cal = re.search(r'(?i)Q([1-4])\s*[-_/]?\s*(\d{4})', s)
    if not m_cal:
        m_cal = re.search(r'(?i)(\d{4})\s*[-_/]?\s*Q([1-4])', s)
        if m_cal:
            yr_str, q_str = m_cal.group(1), m_cal.group(2)
        else:
            yr_str, q_str = None, None
    else:
        q_str, yr_str = m_cal.group(1), m_cal.group(2)

    if q_str and yr_str:
        q = int(q_str)
        yr = int(yr_str)
        return pd.Timestamp(year=yr, month=q * 3, day=28)

    # Standard date strings
    for dayfirst in [False, True]:
        try:
            dt = pd.to_datetime(s, dayfirst=dayfirst)
            if pd.notna(dt):
                return dt
        except Exception:
            pass

    return None


def inspect_workbook_sheets(content_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Detects all sheets in an Excel workbook and recommends the best worksheet.
    For Parle-G workbooks, automatically recommends 'ParleG_Daily_Data'.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".csv":
        return {
            "sheets": ["Default"],
            "recommended_sheet": "Default",
            "is_excel": False
        }

    try:
        excel_file = pd.ExcelFile(io.BytesIO(content_bytes))
        sheet_names = excel_file.sheet_names

        recommended_sheet = sheet_names[0]
        # Check specific recommendation priority
        if "ParleG_Daily_Data" in sheet_names:
            recommended_sheet = "ParleG_Daily_Data"
        else:
            for s in sheet_names:
                s_lower = s.lower()
                if "daily" in s_lower or "data" in s_lower or "quarterly" in s_lower or "revenue" in s_lower:
                    recommended_sheet = s
                    break

        return {
            "sheets": sheet_names,
            "recommended_sheet": recommended_sheet,
            "is_excel": True
        }
    except Exception as e:
        return {
            "sheets": ["Default"],
            "recommended_sheet": "Default",
            "is_excel": True,
            "error": str(e)
        }


def validate_column_mapping(df: pd.DataFrame, mapping: Dict[str, str], mode: str = "revenue") -> Dict[str, Any]:
    """
    Validates user-selected column mappings against DataFrame columns.
    Ensures required fields exist and evaluates data types.
    """
    errors: List[str] = []
    warnings: List[str] = []
    stats: Dict[str, Any] = {}

    date_col = mapping.get("date_col")
    target_col = mapping.get("target_col")

    if not date_col:
        errors.append("Date column is required.")
    elif date_col not in df.columns:
        errors.append(f"Mapped date column '{date_col}' does not exist in dataset.")
    else:
        sample_dates = df[date_col].dropna().head(20)
        parsed_ok = sum(1 for d in sample_dates if robust_parse_date(d) is not None)
        if parsed_ok == 0 and len(sample_dates) > 0:
            errors.append(f"Column '{date_col}' contains unparseable dates.")
        stats["date_valid_sample_pct"] = round(parsed_ok / max(1, len(sample_dates)) * 100, 1)

    if not target_col:
        errors.append("Target column is required.")
    elif target_col not in df.columns:
        errors.append(f"Mapped target column '{target_col}' does not exist in dataset.")
    else:
        sample_targets = df[target_col].dropna().head(20)
        valid_nums = sum(1 for t in sample_targets if clean_currency_or_number(t)[0] is not None)
        if valid_nums == 0 and len(sample_targets) > 0:
            errors.append(f"Column '{target_col}' does not contain numeric target values.")
        stats["target_numeric_sample_pct"] = round(valid_nums / max(1, len(sample_targets)) * 100, 1)

    if mode == "hyperlocal":
        sku_col = mapping.get("sku_col")
        loc_col = mapping.get("locality_col")

        if not sku_col:
            warnings.append("SKU column is recommended for hyperlocal forecasting.")
        elif sku_col not in df.columns:
            errors.append(f"Mapped SKU column '{sku_col}' does not exist in dataset.")
        else:
            stats["unique_skus"] = int(df[sku_col].nunique())

        if not loc_col:
            warnings.append("Locality column is recommended for hyperlocal forecasting.")
        elif loc_col not in df.columns:
            errors.append(f"Mapped locality column '{loc_col}' does not exist in dataset.")
        else:
            stats["unique_localities"] = int(df[loc_col].nunique())

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": stats
    }


def clean_time_series_data(
    df: pd.DataFrame,
    date_col: str,
    target_col: str,
    preserve_zeros: bool = True,
    impute_optional_features: bool = True,
    optional_cols: Optional[List[str]] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Robust cleaning pipeline:
    1. Trim whitespace from column names.
    2. Robustly parse dates.
    3. Convert selected target to numeric values.
    4. Remove only rows that are invalid for the selected date and target.
    5. Retain valid zero-demand observations (e.g. 0 units sold).
    6. Do not discard rows just because optional weather/promo/inventory fields are missing.
    7. Impute optional numerical features using statistics learned from historical training records.
    8. Diagnostic report on invalid dates, missing targets, duplicates, and row counts.
    """
    raw_df = df.copy()
    raw_df.columns = [str(c).strip() for c in raw_df.columns]
    initial_rows = len(raw_df)

    date_col = str(date_col).strip()
    target_col = str(target_col).strip()

    if date_col not in raw_df.columns:
        raise ValueError(f"Date column '{date_col}' not found in DataFrame.")
    if target_col not in raw_df.columns:
        raise ValueError(f"Target column '{target_col}' not found in DataFrame.")

    # 2. Parse dates
    parsed_dates = [robust_parse_date(d) for d in raw_df[date_col]]
    raw_df['_parsed_date'] = parsed_dates
    invalid_date_count = sum(1 for d in parsed_dates if d is None)

    # Filter out invalid dates
    valid_mask = raw_df['_parsed_date'].notna()
    work_df = raw_df[valid_mask].copy()

    # 3. Clean target values
    cleaned_targets = []
    for v in work_df[target_col]:
        num_val, _ = clean_currency_or_number(v)
        cleaned_targets.append(num_val)

    work_df['_cleaned_target'] = cleaned_targets

    # Target invalid count (None or NaN)
    missing_target_count = sum(1 for t in cleaned_targets if t is None or np.isnan(t))

    # Keep rows where target is valid numeric. ZERO is valid!
    if preserve_zeros:
        target_valid_mask = work_df['_cleaned_target'].notna()
    else:
        target_valid_mask = work_df['_cleaned_target'].notna() & (work_df['_cleaned_target'] > 0)

    work_df = work_df[target_valid_mask].copy()

    # Sort chronologically
    work_df = work_df.sort_values(by='_parsed_date').reset_index(drop=True)

    # 4. Impute optional features if requested
    imputed_cols = []
    if impute_optional_features and optional_cols:
        for col in optional_cols:
            if col in work_df.columns and col not in [date_col, target_col, '_parsed_date', '_cleaned_target']:
                if pd.api.types.is_numeric_dtype(work_df[col]):
                    missing_num = work_df[col].isna().sum()
                    if missing_num > 0:
                        median_val = work_df[col].dropna().median()
                        if pd.isna(median_val):
                            median_val = 0.0
                        work_df[col] = work_df[col].fillna(median_val)
                        imputed_cols.append({"column": col, "imputed_count": int(missing_num), "strategy": "median"})
                else:
                    missing_cat = work_df[col].isna().sum()
                    if missing_cat > 0:
                        mode_vals = work_df[col].dropna().mode()
                        fill_val = mode_vals.iloc[0] if len(mode_vals) > 0 else "Unknown"
                        work_df[col] = work_df[col].fillna(fill_val)
                        imputed_cols.append({"column": col, "imputed_count": int(missing_cat), "strategy": "mode"})

    valid_obs = len(work_df)

    diagnostic_report = {
        "initial_rows": initial_rows,
        "invalid_dates_removed": invalid_date_count,
        "missing_or_invalid_targets_removed": missing_target_count,
        "valid_observations": valid_obs,
        "rows_retained_pct": round(valid_obs / max(1, initial_rows) * 100, 2),
        "zero_target_count": int((work_df['_cleaned_target'] == 0).sum()) if valid_obs > 0 else 0,
        "imputed_optional_features": imputed_cols,
        "min_date": work_df['_parsed_date'].min().strftime('%Y-%m-%d') if valid_obs > 0 else None,
        "max_date": work_df['_parsed_date'].max().strftime('%Y-%m-%d') if valid_obs > 0 else None,
        "target_min": float(work_df['_cleaned_target'].min()) if valid_obs > 0 else 0.0,
        "target_max": float(work_df['_cleaned_target'].max()) if valid_obs > 0 else 0.0,
        "target_mean": float(work_df['_cleaned_target'].mean()) if valid_obs > 0 else 0.0,
    }

    return work_df, diagnostic_report


def aggregate_observations(
    df: pd.DataFrame,
    date_col: str,
    grain_cols: List[str],
    target_col: str,
    inventory_col: Optional[str] = None,
    frequency: str = "daily"
) -> pd.DataFrame:
    """
    Aggregates time series observations to desired grain without mixing inventories and unit sales:
    - Sums unit sales/target across outlets/records.
    - Preserves last ending inventory snapshot instead of summing snapshots.
    - Aggregates weather/prices using mean.
    - Aggregates promotion/event indicators using max.
    """
    work_df = df.copy()

    # Determine date grouping
    if frequency.lower() in ["weekly", "week", "w"]:
        work_df['_period_key'] = work_df['_parsed_date'].dt.to_period('W').dt.start_time
    else:
        work_df['_period_key'] = work_df['_parsed_date'].dt.floor('D')

    group_keys = ['_period_key'] + [c for c in grain_cols if c in work_df.columns]

    agg_rules: Dict[str, Any] = {
        '_cleaned_target': 'sum'
    }

    if inventory_col and inventory_col in work_df.columns:
        agg_rules[inventory_col] = 'last'

    for col in work_df.columns:
        if col in group_keys or col in agg_rules or col in ['_parsed_date', date_col, target_col]:
            continue
        c_lower = col.lower()
        if any(k in c_lower for k in ['price', 'discount', 'temp', 'rain', 'std', 'mean', 'avg']):
            if pd.api.types.is_numeric_dtype(work_df[col]):
                agg_rules[col] = 'mean'
        elif any(k in c_lower for k in ['flag', 'promo', 'holiday', 'event', 'stockout']):
            if pd.api.types.is_numeric_dtype(work_df[col]):
                agg_rules[col] = 'max'
            else:
                agg_rules[col] = 'first'
        elif pd.api.types.is_numeric_dtype(work_df[col]):
            agg_rules[col] = 'mean'
        else:
            agg_rules[col] = 'first'

    grouped = work_df.groupby(group_keys, as_index=False).agg(agg_rules)
    grouped = grouped.rename(columns={'_period_key': '_parsed_date'})
    grouped = grouped.sort_values(by='_parsed_date').reset_index(drop=True)

    return grouped


def create_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates standard calendar features from _parsed_date:
    day of week, month, quarter, week of year, weekend indicator.
    """
    res = df.copy()
    dt = res['_parsed_date'].dt
    res['Day_of_Week'] = dt.dayofweek
    res['Month'] = dt.month
    res['Quarter'] = dt.quarter
    res['Week_of_Year'] = dt.isocalendar().week.astype(int)
    res['Is_Weekend'] = dt.dayofweek.isin([5, 6]).astype(int)
    res['Trend'] = np.arange(len(res))
    return res


def create_lag_features(
    df: pd.DataFrame,
    target_series: pd.Series,
    lags: List[int] = [1, 7, 14, 28],
    rolling_windows: List[int] = [7, 14, 28]
) -> pd.DataFrame:
    """
    Generates historical lag and rolling features strictly using past observations (shift(1))
    to ensure NO DATA LEAKAGE.
    """
    res = df.copy()
    past_series = target_series.shift(1)

    for lag in lags:
        res[f'Lag_{lag}'] = target_series.shift(lag)

    for w in rolling_windows:
        res[f'Rolling_Mean_{w}'] = past_series.rolling(w, min_periods=max(1, w // 2)).mean()

    res['Rolling_Std_7'] = past_series.rolling(7, min_periods=2).std().fillna(0.0)

    if 'Rolling_Mean_7' in res.columns and 'Rolling_Mean_28' in res.columns:
        res['Demand_Trend'] = res['Rolling_Mean_7'] - res['Rolling_Mean_28']

    return res


def split_chronologically(
    df: pd.DataFrame,
    holdout_periods: int,
    min_train_periods: int = 5
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Chronological train/test split. Never randomly shuffles observations.
    """
    total = len(df)
    if total < (min_train_periods + 1):
        raise ValueError(f"Insufficient observations ({total}) for chronological train/validation split.")

    holdout = max(1, min(holdout_periods, total - min_train_periods))
    train = df.iloc[:-holdout].copy()
    test = df.iloc[-holdout:].copy()

    return train, test


def evaluate_models(
    y_true: Union[np.ndarray, pd.Series],
    predictions: Dict[str, Union[np.ndarray, pd.Series]]
) -> List[Dict[str, Any]]:
    """
    Calculates MAE, RMSE, WAPE, MAPE, and R² for candidate models.
    Ranks candidates by MAE ascending.
    """
    y_arr = np.array(y_true, dtype=float)
    results = []

    for model_name, pred_val in predictions.items():
        p_arr = np.array(pred_val, dtype=float)

        mask = (~np.isnan(y_arr)) & (~np.isnan(p_arr))
        if np.sum(mask) == 0:
            results.append({
                "model_name": model_name,
                "mae": 999999.0,
                "rmse": 999999.0,
                "wape": None,
                "mape": None,
                "r2": None,
                "rank": 999
            })
            continue

        y_m = y_arr[mask]
        p_m = p_arr[mask]

        mae = float(mean_absolute_error(y_m, p_m))
        rmse = float(np.sqrt(mean_squared_error(y_m, p_m)))

        sum_actual = float(np.sum(y_m))
        wape = float(np.sum(np.abs(y_m - p_m)) / sum_actual * 100) if sum_actual > 0 else None

        nz_mask = y_m != 0
        if np.sum(nz_mask) > 0:
            mape = float(np.mean(np.abs((y_m[nz_mask] - p_m[nz_mask]) / y_m[nz_mask])) * 100)
        else:
            mape = None

        try:
            r2 = float(r2_score(y_m, p_m))
            if r2 < -10:
                r2 = -1.0
        except Exception:
            r2 = None

        results.append({
            "model_name": model_name,
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "wape": round(wape, 2) if wape is not None else None,
            "mape": round(mape, 2) if mape is not None else None,
            "r2": round(r2, 4) if r2 is not None else None
        })

    results.sort(key=lambda x: x["mae"])
    for idx, r in enumerate(results):
        r["rank"] = idx + 1

    return results


def calculate_replenishment(
    forecast_demand_units: float,
    current_inventory: float,
    demand_std: float,
    lead_time_days: int = 3,
    review_period_days: int = 7,
    service_level: float = 0.95,
    min_order_quantity: int = 0,
    case_pack_size: int = 1,
    incoming_orders: float = 0.0
) -> Dict[str, Any]:
    """
    Statistically grounded replenishment recommendation logic:
    Target Stock Position = Forecast Demand over Protection Period + Safety Stock
    Suggested Order Quantity = max(0, Target Stock Position - Inventory Position)
    """
    if service_level >= 0.99:
        z = 2.33
    elif service_level >= 0.98:
        z = 2.05
    elif service_level >= 0.95:
        z = 1.65
    elif service_level >= 0.90:
        z = 1.28
    else:
        z = 1.0

    protection_period = max(1, lead_time_days + review_period_days)
    daily_demand = max(0.0, forecast_demand_units / max(1, review_period_days))
    lead_time_demand = daily_demand * lead_time_days

    # Safety Stock = Z * std * sqrt(lead_time)
    safety_stock = int(np.ceil(z * max(1.0, demand_std) * math.sqrt(lead_time_days)))

    target_stock = int(np.ceil((daily_demand * protection_period) + safety_stock))
    inventory_position = current_inventory + incoming_orders
    raw_order = max(0, target_stock - inventory_position)

    if raw_order > 0:
        if raw_order < min_order_quantity:
            raw_order = min_order_quantity
        if case_pack_size > 1:
            raw_order = int(math.ceil(raw_order / case_pack_size) * case_pack_size)

    stock_cover_days = round(current_inventory / max(0.1, daily_demand), 1)

    if current_inventory <= (daily_demand * lead_time_days * 0.5):
        stockout_risk = "High"
    elif current_inventory <= (daily_demand * lead_time_days + safety_stock):
        stockout_risk = "Moderate"
    else:
        stockout_risk = "Low"

    return {
        "current_inventory": int(current_inventory),
        "incoming_orders": int(incoming_orders),
        "inventory_position": int(inventory_position),
        "lead_time_days": lead_time_days,
        "review_period_days": review_period_days,
        "protection_period_days": protection_period,
        "service_level_pct": round(service_level * 100, 1),
        "z_score": z,
        "lead_time_demand_units": round(lead_time_demand, 1),
        "safety_stock_units": safety_stock,
        "target_stock_units": target_stock,
        "suggested_order_quantity": int(raw_order),
        "stock_cover_days": stock_cover_days,
        "stockout_risk": stockout_risk,
        "min_order_quantity": min_order_quantity,
        "case_pack_size": case_pack_size
    }
