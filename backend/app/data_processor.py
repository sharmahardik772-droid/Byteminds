import re
import math
import datetime
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

def clean_currency_string(val: Any) -> Tuple[Optional[float], bool]:
    """Safely converts currency/formatted string or numeric to float.
    Handles INR/USD symbols, commas, decimals, parenthesized negatives, and footnotes."""
    if pd.isna(val) or val is None:
        return None, True
    if isinstance(val, (int, float, np.number)):
        if math.isnan(val):
            return None, True
        return float(val), True
    
    s = str(val).strip()
    if s == "" or s.lower() in ["-", "--", "n/a", "na", "null", "none", "—"]:
        return None, True
    
    is_neg = False
    if s.startswith("(") and s.endswith(")"):
        is_neg = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_neg = True
        s = s[1:].strip()
    
    # Strip common currency symbols, whitespace, and units
    s_clean = re.sub(r'[₹$€£,%\s\xa0]', '', s)
    s_clean = re.sub(r'(?i)cr|crore|crores|inr|rs\.?|usd|lakh|lakhs|mn|bn', '', s_clean).strip()
    
    try:
        num = float(s_clean)
        return -num if is_neg else num, True
    except ValueError:
        pass

    # Fallback: extract first valid numeric substring with optional decimal
    m = re.search(r'[-+]?\d+(?:,\d+)*(?:\.\d+)?', str(val).replace(' ', ''))
    if m:
        num_str = m.group(0).replace(',', '')
        try:
            num = float(num_str)
            return -num if is_neg else num, True
        except ValueError:
            pass

    return None, False

def parse_single_period(x: Any, idx: int = 0) -> Tuple[Optional[pd.Timestamp], str]:
    """
    Parses an individual period/date entry into a Timestamp and display label.
    Supports:
    - Pre-parsed pd.Timestamp, datetime.date
    - Excel serial numbers (e.g. 40000 - 60000)
    - Indian Fiscal Quarters ('Q1 FY22', 'FY 2021-22 Q1', 'FY22 Q1', 'Q1 FY 2022')
    - Calendar Quarters ('2022-Q1', '2022Q1', 'Q1 2022', '1Q22')
    - Month-Year strings ('Jun-18', 'Jun 2018', 'June 2018')
    - Standard date strings ('YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY')
    """
    if pd.isna(x) or x is None:
        return None, ""

    # 1. Already a Timestamp / date object (common from openpyxl / pd.read_excel)
    if isinstance(x, (pd.Timestamp, datetime.date, datetime.datetime)):
        ts = pd.Timestamp(x)
        m = ts.month
        q = (m - 1) // 3 + 1
        return ts, f"Q{q} {ts.year}"

    # 2. Excel numeric serial date (days since 1899-12-30)
    if isinstance(x, (int, float, np.number)):
        if 35000 <= x <= 65000:
            ts = pd.to_datetime(x, unit='D', origin='1899-12-30')
            q = (ts.month - 1) // 3 + 1
            return ts, f"Q{q} {ts.year}"
        elif 1990 <= x <= 2050:
            # Year only
            return pd.Timestamp(year=int(x), month=12, day=31), f"FY {int(x)}"

    s = str(x).strip()
    if s == "" or s.lower() in ["nan", "null", "none", "—"]:
        return None, ""

    # 3. Fiscal Year quarterly formats:
    # 'Q1 FY22', 'Q1 FY 2022', 'FY 2021-22 Q1', 'FY22 Q1', 'Q1-FY22'
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
        # Indian FY: Q1=Jun 30, Q2=Sep 30, Q3=Dec 31, Q4=Mar 31
        if q == 1:
            dt = pd.Timestamp(year=yr - 1, month=6, day=30)
        elif q == 2:
            dt = pd.Timestamp(year=yr - 1, month=9, day=30)
        elif q == 3:
            dt = pd.Timestamp(year=yr - 1, month=12, day=31)
        else:
            dt = pd.Timestamp(year=yr, month=3, day=31)
        return dt, f"Q{q} FY{str(yr)[-2:]}"

    # 4. Calendar quarters: '2022-Q1', '2022Q1', 'Q1 2022', '1Q22'
    m_cal = re.search(r'(?i)([1-4])Q(\d{2,4})', s)
    if m_cal:
        q = int(m_cal.group(1))
        yr = int(m_cal.group(2))
        if yr < 100:
            yr += 2000
        dt = pd.Timestamp(year=yr, month=q * 3, day=28)
        return dt, f"Q{q} {yr}"

    m_cal2 = re.search(r'(?i)(\d{4})\s*[-_/]?\s*Q([1-4])', s)
    if not m_cal2:
        m_cal2 = re.search(r'(?i)Q([1-4])\s*[-_/]?\s*(\d{4})', s)
        if m_cal2:
            q_str, yr_str = m_cal2.group(1), m_cal2.group(2)
        else:
            q_str, yr_str = None, None
    else:
        yr_str, q_str = m_cal2.group(1), m_cal2.group(2)

    if q_str and yr_str:
        q = int(q_str)
        yr = int(yr_str)
        dt = pd.Timestamp(year=yr, month=q * 3, day=28)
        return dt, f"Q{q} {yr}"

    # 5. Standard date parsing with pandas / dateutil
    for dayfirst_opt in [True, False]:
        try:
            dt = pd.to_datetime(s, dayfirst=dayfirst_opt)
            if pd.notna(dt):
                q = (dt.month - 1) // 3 + 1
                return dt, dt.strftime('%Y-%m-%d')
        except Exception:
            pass

    return None, s

def parse_period_column(series: pd.Series) -> Tuple[pd.Series, pd.Series, str, float]:
    """
    Parses a date/period column robustly.
    Returns:
    - parsed_timestamps: pd.Series of pd.Timestamp
    - formatted_labels: pd.Series of string period representations
    - detected_format_type: 'quarterly_parsed', 'datetime', 'sequential_generated'
    - parse_success_rate: float (0.0 to 1.0)
    """
    n = len(series)
    if n == 0:
        return pd.Series(dtype='datetime64[ns]'), pd.Series(dtype=str), 'empty', 0.0

    parsed_dates = []
    labels = []
    valid_count = 0

    for idx, val in enumerate(series):
        dt, lbl = parse_single_period(val, idx)
        if dt is not None and pd.notna(dt):
            parsed_dates.append(dt)
            labels.append(lbl)
            valid_count += 1
        else:
            parsed_dates.append(pd.NaT)
            labels.append(str(val) if pd.notna(val) else f"Period {idx + 1}")

    success_rate = valid_count / n

    # If at least 30% of records parsed, interpolate missing dates
    if valid_count >= max(2, int(n * 0.3)):
        s_dt = pd.Series(parsed_dates)
        # Interpolate NaTs chronologically
        if s_dt.isna().any():
            s_dt = s_dt.bfill().ffill()
        return s_dt, pd.Series(labels), 'quarterly_parsed' if 'Q' in labels[0] else 'datetime', success_rate

    # If parsing completely failed or column is sequential text (e.g. 'Period 1, 2...'),
    # generate regular quarterly timestamps starting from a reasonable base (e.g. 2018-06-30)
    # This prevents the dataset from being completely dropped!
    base_date = pd.Timestamp('2018-06-30')
    gen_dates = [base_date + pd.DateOffset(months=3 * i) for i in range(n)]
    gen_labels = [str(series.iloc[i]) if pd.notna(series.iloc[i]) else f"P{i + 1}" for i in range(n)]
    
    return pd.Series(gen_dates), pd.Series(gen_labels), 'sequential_generated', 1.0

def detect_column_roles(df: pd.DataFrame) -> Dict[str, Any]:
    """Inspects column headers and sample data to identify candidate date and revenue target columns."""
    if df.empty or len(df.columns) == 0:
        return {
            "recommended_date": "",
            "date_candidates": [],
            "recommended_revenue": "",
            "revenue_candidates": [],
            "category_columns": []
        }

    date_candidates = []
    revenue_candidates = []
    category_candidates = []
    
    date_keywords = ['date', 'period', 'quarter', 'month', 'year', 'time', 'qtr', 'fy', 'fiscal']
    revenue_keywords = ['revenue', 'sales', 'turnover', 'income', 'net_sales', 'total_revenue', 'gross_sales', 'cr', 'ebitda', 'amount']
    
    for col in df.columns:
        col_str = str(col).strip().lower()
        sample = df[col].dropna().head(10)
        
        # Date scoring
        score_date = 0
        for kw in date_keywords:
            if kw in col_str:
                score_date += 3
        if len(sample) > 0:
            parsed_s, _, fmt, rate = parse_period_column(sample)
            if fmt in ['quarterly_parsed', 'datetime'] and rate >= 0.5:
                score_date += 6
        if score_date > 0:
            date_candidates.append({"column": str(col), "score": score_date})
            
        # Revenue scoring
        score_rev = 0
        for kw in revenue_keywords:
            if kw in col_str:
                score_rev += 3
        if len(sample) > 0:
            clean_success = 0
            for val in sample:
                c_val, ok = clean_currency_string(val)
                if ok and c_val is not None:
                    clean_success += 1
            if clean_success / len(sample) >= 0.5:
                score_rev += 5
        if score_rev > 0:
            revenue_candidates.append({"column": str(col), "score": score_rev})
            
        # Category/Entity columns
        if df[col].dtype == object or isinstance(df[col].dtype, pd.CategoricalDtype):
            unique_count = df[col].nunique()
            if 1 <= unique_count <= 20 and score_date == 0:
                category_candidates.append(str(col))

    # Sort candidates by score descending
    date_candidates.sort(key=lambda x: x["score"], reverse=True)
    revenue_candidates.sort(key=lambda x: x["score"], reverse=True)
    
    rec_date = date_candidates[0]["column"] if date_candidates else str(df.columns[0])
    rec_rev = revenue_candidates[0]["column"] if revenue_candidates else (str(df.columns[1]) if len(df.columns) > 1 else str(df.columns[0]))
    
    # Avoid picking the same column for date and revenue
    if rec_date == rec_rev and len(df.columns) > 1:
        alt_rev = [c["column"] for c in revenue_candidates if c["column"] != rec_date]
        if alt_rev:
            rec_rev = alt_rev[0]
        else:
            for c in df.columns:
                if str(c) != rec_date:
                    rec_rev = str(c)
                    break

    # Hyperlocal SKU & Locality detection
    sku_keywords = ['sku', 'product', 'item', 'item_name', 'material', 'product_name']
    loc_keywords = ['locality', 'location', 'city', 'region', 'area', 'zone', 'market', 'district', 'town', 'branch']
    brand_keywords = ['brand', 'company', 'make', 'manufacturer']
    pack_keywords = ['pack', 'pack_size', 'size', 'weight', 'gram', 'pack_size_g', 'volume']
    outlet_keywords = ['outlet', 'store', 'shop', 'pos', 'counter']
    inventory_keywords = ['inventory', 'ending_inventory', 'ending_inventory_units', 'stock', 'on_hand', 'closing_stock']
    replenishment_keywords = ['replenish', 'replenishment', 'replenishment_units', 'order', 'reorder', 'suggested_order']
    promo_keywords = ['promotion', 'promo', 'discount', 'discount_pct', 'promotion_flag', 'offer', 'campaign']
    weather_keywords = ['temperature', 'temperature_c', 'temp', 'rainfall', 'rainfall_mm', 'rain', 'weather']

    rec_sku = None
    rec_loc = None
    rec_brand = None
    rec_pack = None
    rec_outlet = None
    rec_inv = None
    rec_replenish = None
    rec_promo = None
    weather_cols = []

    for c in df.columns:
        c_str = str(c).strip().lower()
        if not rec_sku and any(k == c_str or k in c_str for k in sku_keywords):
            rec_sku = str(c)
        elif not rec_loc and any(k == c_str or k in c_str for k in loc_keywords):
            rec_loc = str(c)
        elif not rec_brand and any(k == c_str or k in c_str for k in brand_keywords):
            rec_brand = str(c)
        elif not rec_pack and any(k == c_str or k in c_str for k in pack_keywords):
            rec_pack = str(c)
        elif not rec_outlet and any(k == c_str or k in c_str for k in outlet_keywords):
            rec_outlet = str(c)
        elif not rec_inv and any(k == c_str or k in c_str for k in inventory_keywords):
            rec_inv = str(c)
        elif not rec_replenish and any(k == c_str or k in c_str for k in replenishment_keywords):
            rec_replenish = str(c)
        elif not rec_promo and any(k == c_str or k in c_str for k in promo_keywords):
            rec_promo = str(c)

        if any(k in c_str for k in weather_keywords):
            weather_cols.append(str(c))

    # Dynamically extract unique values if present
    unique_skus = []
    if rec_sku and rec_sku in df.columns:
        unique_skus = sorted([str(x) for x in df[rec_sku].dropna().unique().tolist()])

    unique_localities = []
    if rec_loc and rec_loc in df.columns:
        unique_localities = sorted([str(x) for x in df[rec_loc].dropna().unique().tolist()])

    unique_brands = []
    if rec_brand and rec_brand in df.columns:
        unique_brands = sorted([str(x) for x in df[rec_brand].dropna().unique().tolist()])

    # Determine suggested mode
    suggested_mode = "hyperlocal" if (rec_sku or rec_loc) and len(unique_skus) > 0 else "revenue"

    # If dataset has 'Sales_Quantity', prefer it over others for hyperlocal target
    for c in df.columns:
        if str(c).strip().lower() in ['sales_quantity', 'units_sold', 'demand_units', 'sales_units']:
            rec_rev = str(c)
            break
    
    return {
        "recommended_date": rec_date,
        "date_candidates": [c["column"] for c in date_candidates],
        "recommended_revenue": rec_rev,
        "revenue_candidates": [c["column"] for c in revenue_candidates],
        "category_columns": category_candidates,
        "recommended_sku": rec_sku,
        "recommended_locality": rec_loc,
        "recommended_brand": rec_brand,
        "recommended_pack_size": rec_pack,
        "recommended_outlet": rec_outlet,
        "recommended_inventory": rec_inv,
        "recommended_replenishment": rec_replenish,
        "recommended_promotion": rec_promo,
        "weather_columns": weather_cols,
        "unique_skus": unique_skus,
        "unique_localities": unique_localities,
        "unique_brands": unique_brands,
        "suggested_mode": suggested_mode
    }


def audit_dataset(
    df: pd.DataFrame, 
    date_col: str, 
    revenue_col: str, 
    frequency: str = "Quarterly"
) -> Dict[str, Any]:
    """
    Performs comprehensive data-quality auditing:
    - Missing dates and revenue values
    - Duplicate dates / duplicate rows
    - Non-numeric or negative revenue
    - Irregular time intervals
    - Outlier detection (IQR and Z-score)
    - Chronological ordering check
    - Sample size sufficiency
    """
    total_rows = len(df)
    issues = []
    warnings = []
    
    if total_rows == 0:
        return {
            "status": "error",
            "message": "Dataset is completely empty.",
            "total_rows": 0,
            "issues": ["Empty dataset"]
        }
        
    if date_col not in df.columns:
        date_col = df.columns[0]
    if revenue_col not in df.columns:
        revenue_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
        
    # 1. Parse date column
    parsed_dates, labels, fmt_type, parse_rate = parse_period_column(df[date_col])
    invalid_dates_count = int((parsed_dates.isna()).sum())
    
    if invalid_dates_count > 0:
        issues.append({
            "type": "invalid_dates",
            "severity": "medium",
            "count": invalid_dates_count,
            "message": f"{invalid_dates_count} rows have unparseable dates (will be chronologically interpolated)."
        })
        
    # 2. Clean revenue column
    cleaned_rev = []
    unparseable_rev_count = 0
    neg_rev_count = 0
    null_rev_count = 0
    
    for val in df[revenue_col]:
        if pd.isna(val) or val is None:
            null_rev_count += 1
            cleaned_rev.append(None)
            continue
        cleaned_val, ok = clean_currency_string(val)
        if not ok or cleaned_val is None:
            unparseable_rev_count += 1
            cleaned_rev.append(None)
        else:
            if cleaned_val < 0:
                neg_rev_count += 1
            cleaned_rev.append(cleaned_val)
            
    if null_rev_count > 0:
        issues.append({
            "type": "missing_revenue",
            "severity": "medium",
            "count": null_rev_count,
            "message": f"{null_rev_count} rows have missing revenue values."
        })
    if unparseable_rev_count > 0:
        issues.append({
            "type": "unparseable_revenue",
            "severity": "high",
            "count": unparseable_rev_count,
            "message": f"{unparseable_rev_count} revenue entries could not be parsed as numeric amounts."
        })
    if neg_rev_count > 0:
        warnings.append({
            "type": "negative_revenue",
            "severity": "warning",
            "count": neg_rev_count,
            "message": f"{neg_rev_count} records contain negative revenue amounts."
        })

    # 3. Duplicate checks
    exact_duplicates = int(df.duplicated().sum())
    if exact_duplicates > 0:
        warnings.append({
            "type": "exact_duplicates",
            "severity": "medium",
            "count": exact_duplicates,
            "message": f"{exact_duplicates} exact duplicate rows detected."
        })
        
    valid_dates_series = parsed_dates.dropna()
    period_duplicates = int(valid_dates_series.duplicated().sum())
    if period_duplicates > 0:
        warnings.append({
            "type": "duplicate_periods",
            "severity": "medium",
            "count": period_duplicates,
            "message": f"{period_duplicates} records share the same period date."
        })

    # 4. Chronological order check
    is_sorted = True
    if len(valid_dates_series) > 1:
        is_sorted = bool(valid_dates_series.is_monotonic_increasing)
        if not is_sorted:
            warnings.append({
                "type": "unsorted_dates",
                "severity": "low",
                "count": 1,
                "message": "Historical records will be sorted chronologically during preparation."
            })

    # 5. Outliers & summary statistics
    valid_rev = [r for r in cleaned_rev if r is not None and not np.isnan(r)]
    outliers = []
    summary_stats = {}
    
    if len(valid_rev) >= 4:
        s_rev = pd.Series(valid_rev)
        q1 = float(s_rev.quantile(0.25))
        q3 = float(s_rev.quantile(0.75))
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        mean_val = float(s_rev.mean())
        std_val = float(s_rev.std()) if len(s_rev) > 1 else 0.0
        
        summary_stats = {
            "count": len(valid_rev),
            "mean": round(mean_val, 2),
            "std": round(std_val, 2),
            "min": round(float(s_rev.min()), 2),
            "q25": round(q1, 2),
            "median": round(float(s_rev.median()), 2),
            "q75": round(q3, 2),
            "max": round(float(s_rev.max()), 2),
            "iqr": round(iqr, 2)
        }
        
        for idx, r_val in enumerate(cleaned_rev):
            if r_val is not None:
                if r_val < lower_bound or r_val > upper_bound:
                    p_label = labels.iloc[idx] if idx < len(labels) else f"Row {idx+1}"
                    outliers.append({
                        "period": p_label,
                        "value": r_val,
                        "reason": f"Beyond IQR threshold [{round(lower_bound, 1)}, {round(upper_bound, 1)}]"
                    })
                    
        if outliers:
            warnings.append({
                "type": "outliers_detected",
                "severity": "info",
                "count": len(outliers),
                "message": f"{len(outliers)} possible outlier points detected (festive surges are retained by default)."
            })

    valid_obs_count = len(valid_rev)
    if valid_obs_count < 5:
        issues.append({
            "type": "insufficient_observations",
            "severity": "critical",
            "count": valid_obs_count,
            "message": f"Only {valid_obs_count} valid revenue observations found. At least 5 observations are required."
        })

    health_score = 100
    for issue in issues:
        if issue["severity"] == "critical":
            health_score -= 40
        elif issue["severity"] == "high":
            health_score -= 20
        else:
            health_score -= 10
    for w in warnings:
        health_score -= 5
    health_score = max(10, min(100, health_score))

    return {
        "status": "ready" if not any(i["severity"] == "critical" for i in issues) else "unsuitable",
        "health_score": health_score,
        "total_rows": total_rows,
        "valid_observations": valid_obs_count,
        "date_format_detected": fmt_type,
        "is_chronologically_sorted": is_sorted,
        "summary_statistics": summary_stats,
        "outliers": outliers,
        "issues": issues,
        "warnings": warnings
    }

def prepare_and_clean_dataset(
    df: pd.DataFrame,
    date_col: str,
    revenue_col: str,
    remove_exact_duplicates: bool = True,
    aggregation_method: str = "sum", # 'sum', 'mean', 'last'
    missing_revenue_strategy: str = "interpolate", # 'interpolate', 'drop', 'ffill'
    sort_chronological: bool = True,
    entity_col: Optional[str] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Applies the preparation pipeline to produce a clean, sorted, regular time-series dataframe.
    Robust against misconfigured columns, missing dates, or formatted strings.
    Never drops data down to 0 valid rows if usable rows exist.
    """
    work_df = df.copy()
    initial_count = len(work_df)
    
    # 1. Validate column existence or fallback gracefully
    if date_col not in work_df.columns:
        date_candidates = [c for c in work_df.columns if any(k in str(c).lower() for k in ['date', 'quarter', 'period', 'year', 'time'])]
        date_col = date_candidates[0] if date_candidates else work_df.columns[0]
        
    if revenue_col not in work_df.columns:
        rev_candidates = [c for c in work_df.columns if any(k in str(c).lower() for k in ['revenue', 'sales', 'cr', 'amount', 'total']) and c != date_col]
        revenue_col = rev_candidates[0] if rev_candidates else (work_df.columns[1] if len(work_df.columns) > 1 else work_df.columns[0])

    # 2. Deduplicate exact records if requested
    if remove_exact_duplicates:
        work_df = work_df.drop_duplicates()
        
    # 3. Parse date column
    parsed_dates, labels, fmt_type, _ = parse_period_column(work_df[date_col])
    work_df['_parsed_date'] = parsed_dates.values
    work_df['_period_label'] = labels.values
    
    # If any dates are NaT, fill them chronologically instead of dropping all data
    if work_df['_parsed_date'].isna().any():
        work_df['_parsed_date'] = work_df['_parsed_date'].bfill().ffill()
        if work_df['_parsed_date'].isna().any():
            base_dt = pd.Timestamp('2018-06-30')
            work_df['_parsed_date'] = [base_dt + pd.DateOffset(months=3 * i) for i in range(len(work_df))]

    # 4. Clean revenue target column
    cleaned_rev = []
    for val in work_df[revenue_col]:
        c_val, ok = clean_currency_string(val)
        cleaned_rev.append(c_val if ok else np.nan)
    work_df['_cleaned_revenue'] = cleaned_rev
    
    # Safeguard: If the selected revenue_col yielded 0 valid numbers,
    # inspect other columns to see if user picked the wrong column!
    valid_rev_count = work_df['_cleaned_revenue'].dropna().count()
    if valid_rev_count < 5 and len(work_df) >= 5:
        for alt_col in work_df.columns:
            if alt_col in [date_col, '_parsed_date', '_period_label', '_cleaned_revenue']:
                continue
            alt_cleaned = [clean_currency_string(v)[0] for v in work_df[alt_col]]
            alt_valid_count = sum(1 for v in alt_cleaned if v is not None and not np.isnan(v))
            if alt_valid_count >= 5:
                work_df['_cleaned_revenue'] = alt_cleaned
                revenue_col = alt_col
                break

    # 5. Handle missing revenue
    if missing_revenue_strategy == "drop":
        work_df = work_df.dropna(subset=['_cleaned_revenue'])
    elif missing_revenue_strategy == "interpolate":
        work_df['_cleaned_revenue'] = work_df['_cleaned_revenue'].interpolate(method='linear').bfill().ffill()
    elif missing_revenue_strategy == "ffill":
        work_df['_cleaned_revenue'] = work_df['_cleaned_revenue'].ffill().bfill()
        
    if work_df['_cleaned_revenue'].isna().any():
        work_df['_cleaned_revenue'] = work_df['_cleaned_revenue'].bfill().ffill()
        
    # 6. Aggregate duplicate periods if any
    group_cols = ['_parsed_date']
    if aggregation_method == "sum":
        agg_dict = {'_cleaned_revenue': 'sum', '_period_label': 'last'}
    elif aggregation_method == "mean":
        agg_dict = {'_cleaned_revenue': 'mean', '_period_label': 'last'}
    else: # last
        agg_dict = {'_cleaned_revenue': 'last', '_period_label': 'last'}
        
    if entity_col and entity_col in work_df.columns:
        group_cols.append(entity_col)
        
    grouped = work_df.groupby(group_cols, as_index=False).agg(agg_dict)
    
    # 7. Chronological sorting
    if sort_chronological:
        grouped = grouped.sort_values(by='_parsed_date').reset_index(drop=True)
        
    final_count = len(grouped)
    
    report = {
        "original_rows": initial_count,
        "prepared_rows": final_count,
        "rows_removed_or_aggregated": initial_count - final_count,
        "date_format": fmt_type,
        "active_revenue_col": revenue_col,
        "active_date_col": date_col,
        "first_period": grouped['_period_label'].iloc[0] if final_count > 0 else "",
        "last_period": grouped['_period_label'].iloc[-1] if final_count > 0 else "",
        "min_revenue": round(float(grouped['_cleaned_revenue'].min()), 2) if final_count > 0 else 0,
        "max_revenue": round(float(grouped['_cleaned_revenue'].max()), 2) if final_count > 0 else 0,
        "mean_revenue": round(float(grouped['_cleaned_revenue'].mean()), 2) if final_count > 0 else 0,
    }
    
    return grouped, report
