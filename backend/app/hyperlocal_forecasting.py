import math
import datetime
from typing import Dict, Any, List, Optional, Tuple, Union
import pandas as pd
import numpy as np

from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from statsmodels.tsa.api import SimpleExpSmoothing, Holt

from app.shared_engine import (
    clean_time_series_data,
    aggregate_observations,
    create_time_features,
    create_lag_features,
    split_chronologically,
    evaluate_models,
    calculate_replenishment,
    clean_currency_or_number
)

class HyperlocalForecastingEngine:
    """
    Enterprise Hyperlocal Demand Forecasting Engine for product-level (SKU)
    demand forecasting across localities, pack sizes, and outlets.
    Implements:
    - 7 distinct benchmarked models (Seasonal Naive, Naive, Moving Avg, Exp Smoothing, Ridge, Random Forest, Gradient Boosting)
    - Strict chronological train/validation holdout (no future data leakage)
    - Recursive multi-step future forecasting
    - Dynamically extracted SKU & Locality comparisons
    - Statistically grounded safety stock and inventory replenishment recommendations
    """
    def __init__(
        self,
        df: pd.DataFrame,
        date_col: str,
        target_col: str,
        sku_col: Optional[str] = None,
        locality_col: Optional[str] = None,
        brand_col: Optional[str] = None,
        pack_size_col: Optional[str] = None,
        outlet_col: Optional[str] = None,
        inventory_col: Optional[str] = None,
        price_col: Optional[str] = None,
        promotion_col: Optional[str] = None,
        competitor_col: Optional[str] = None,
        holiday_col: Optional[str] = None,
        temperature_col: Optional[str] = None,
        rainfall_col: Optional[str] = None,
        selected_sku: Optional[str] = None,
        selected_locality: Optional[str] = None,
        frequency: str = "daily",
        horizon: int = 7,
        holdout_periods: Optional[int] = None
    ):
        self.raw_df = df.copy()
        self.date_col = date_col
        self.target_col = target_col
        self.sku_col = sku_col
        self.locality_col = locality_col
        self.brand_col = brand_col
        self.pack_size_col = pack_size_col
        self.outlet_col = outlet_col
        self.inventory_col = inventory_col
        self.price_col = price_col
        self.promotion_col = promotion_col
        self.competitor_col = competitor_col
        self.holiday_col = holiday_col
        self.temperature_col = temperature_col
        self.rainfall_col = rainfall_col
        
        self.frequency = frequency.lower()
        self.is_daily = "day" in self.frequency or self.frequency == "daily"
        self.horizon = max(1, min(60 if self.is_daily else 24, horizon))
        
        # Discover all available SKUs, Localities, Brands
        self.available_skus = []
        if sku_col and sku_col in self.raw_df.columns:
            self.available_skus = sorted([str(x) for x in self.raw_df[sku_col].dropna().unique()])
            
        self.available_localities = []
        if locality_col and locality_col in self.raw_df.columns:
            self.available_localities = sorted([str(x) for x in self.raw_df[locality_col].dropna().unique()])
            
        self.available_brands = []
        if brand_col and brand_col in self.raw_df.columns:
            self.available_brands = sorted([str(x) for x in self.raw_df[brand_col].dropna().unique()])

        # Set selection or pick defaults
        self.selected_sku = selected_sku if selected_sku in self.available_skus else (self.available_skus[0] if self.available_skus else None)
        self.selected_locality = selected_locality if selected_locality in self.available_localities else (self.available_localities[0] if self.available_localities else None)

        # Set holdout length
        if holdout_periods is not None:
            self.holdout_len = max(1, holdout_periods)
        else:
            self.holdout_len = 28 if self.is_daily else 4

    def run(
        self,
        lead_time_days: int = 3,
        review_period_days: int = 7,
        service_level: float = 0.95,
        min_order_quantity: int = 0,
        case_pack_size: int = 1,
        existing_incoming_orders: float = 0.0,
        current_inventory_override: Optional[float] = None,
        user_model_choice: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes full hyperlocal forecasting pipeline.
        """
        # 1. Filter raw dataset to the selected SKU and Locality
        filtered_df = self.raw_df.copy()
        if self.sku_col and self.selected_sku and self.sku_col in filtered_df.columns:
            filtered_df = filtered_df[filtered_df[self.sku_col].astype(str) == str(self.selected_sku)]
            
        if self.locality_col and self.selected_locality and self.locality_col in filtered_df.columns:
            filtered_df = filtered_df[filtered_df[self.locality_col].astype(str) == str(self.selected_locality)]

        if len(filtered_df) == 0:
            raise ValueError(
                f"No records found for SKU '{self.selected_sku}' in Locality '{self.selected_locality}'. "
                "Please verify selection filters."
            )

        # 2. Clean Time Series Data
        optional_numeric = [
            c for c in [
                self.price_col, self.promotion_col, self.competitor_col,
                self.holiday_col, self.temperature_col, self.rainfall_col,
                self.inventory_col
            ] if c and c in filtered_df.columns
        ]

        cleaned_df, diag_report = clean_time_series_data(
            df=filtered_df,
            date_col=self.date_col,
            target_col=self.target_col,
            preserve_zeros=True,
            impute_optional_features=True,
            optional_cols=optional_numeric
        )

        if len(cleaned_df) < 5:
            raise ValueError(
                f"Only {len(cleaned_df)} valid observations remain after cleaning for {self.selected_sku} in {self.selected_locality}. "
                "At least 5 valid observations are required to train time-series models."
            )

        # 3. Aggregate to consistent grain
        grain_cols = []
        if self.sku_col and self.sku_col in cleaned_df.columns:
            grain_cols.append(self.sku_col)
        if self.locality_col and self.locality_col in cleaned_df.columns:
            grain_cols.append(self.locality_col)

        agg_df = aggregate_observations(
            df=cleaned_df,
            date_col=self.date_col,
            grain_cols=grain_cols,
            target_col=self.target_col,
            inventory_col=self.inventory_col,
            frequency=self.frequency
        )

        n_records = len(agg_df)
        if n_records < 5:
            raise ValueError(
                f"Only {n_records} distinct time periods found for selected SKU-Locality combination. "
                "At least 5 observations are required."
            )

        # 4. Feature Engineering (Strictly preventing data leakage)
        # Determine lag and rolling settings based on frequency
        if self.is_daily:
            lags = [1, 7, 14, 28]
            rolling_windows = [7, 14, 28]
            seasonal_lag_col = "Lag_7"
            seasonal_m = 7
        else:
            lags = [1, 2, 4, 8]
            rolling_windows = [2, 4, 8]
            seasonal_lag_col = "Lag_1"
            seasonal_m = 4

        # Add calendar time features
        feat_df = create_time_features(agg_df)
        
        # Add lag & rolling features (computed from past observations using shift(1))
        feat_df = create_lag_features(
            df=feat_df,
            target_series=feat_df['_cleaned_target'],
            lags=lags,
            rolling_windows=rolling_windows
        )

        # Feature column selection:
        # Candidate features from engineered lags and calendar
        candidate_feature_cols = [
            f'Lag_{l}' for l in lags
        ] + [
            f'Rolling_Mean_{w}' for w in rolling_windows
        ] + [
            'Rolling_Std_7', 'Day_of_Week', 'Month', 'Quarter', 'Week_of_Year', 'Trend'
        ]

        # Optional external columns if present
        for col_cand in [
            self.promotion_col, self.price_col, self.competitor_col,
            self.holiday_col, self.temperature_col, self.rainfall_col
        ]:
            if col_cand and col_cand in feat_df.columns and col_cand not in candidate_feature_cols:
                # Exclude target or latent columns
                if col_cand.lower() not in ['true_demand_units', 'sales_quantity', self.target_col.lower()]:
                    candidate_feature_cols.append(col_cand)

        # Drop synthetic or target leaks
        leak_names = ['true_demand_units', 'forecast_split', 'seasonal_naive_7d_forecast', self.target_col.lower()]
        features = [
            c for c in candidate_feature_cols
            if c in feat_df.columns and c.lower() not in leak_names
        ]

        # Drop initial rows where maximum lag is NaN
        max_lag = max(lags)
        if len(feat_df) > max_lag + 5:
            model_df = feat_df.iloc[max_lag:].copy().reset_index(drop=True)
        else:
            # If limited history, fill missing lag with target mean
            model_df = feat_df.copy()
            for c in features:
                if model_df[c].isna().any():
                    model_df[c] = model_df[c].bfill().fillna(model_df['_cleaned_target'].mean())

        # 5. Chronological Train / Test Validation Split
        effective_holdout = min(self.holdout_len, max(2, len(model_df) // 4))
        train_df, test_df = split_chronologically(
            df=model_df,
            holdout_periods=effective_holdout,
            min_train_periods=4
        )

        X_train = train_df[features].fillna(0)
        y_train = train_df['_cleaned_target'].values.astype(float)
        X_test = test_df[features].fillna(0)
        y_test = test_df['_cleaned_target'].values.astype(float)

        # 6. Fit & Evaluate 7 Benchmark Models
        test_preds: Dict[str, np.ndarray] = {}
        fitted_models: Dict[str, Any] = {}

        # Model 1: Seasonal Naive Baseline
        if seasonal_lag_col in test_df.columns:
            s_naive_pred = test_df[seasonal_lag_col].fillna(y_train[-1]).values
        else:
            s_naive_pred = np.full(len(y_test), y_train[-1])
        test_preds["Seasonal Naive Baseline"] = s_naive_pred

        # Model 2: Naive Baseline (Lag 1)
        if "Lag_1" in test_df.columns:
            naive_pred = test_df["Lag_1"].fillna(y_train[-1]).values
        else:
            naive_pred = np.full(len(y_test), y_train[-1])
        test_preds["Naive Baseline"] = naive_pred

        # Model 3: Moving Average (Rolling 7d / 4w)
        roll_col = "Rolling_Mean_7" if "Rolling_Mean_7" in test_df.columns else features[0]
        ma_pred = test_df[roll_col].fillna(np.mean(y_train[-7:])).values
        test_preds["Moving Average"] = ma_pred

        # Model 4: Exponential Smoothing
        try:
            if len(y_train) >= 8:
                es_fit = Holt(y_train, initialization_method="estimated").fit(optimized=True)
                es_pred = es_fit.forecast(len(y_test))
            else:
                es_fit = SimpleExpSmoothing(y_train, initialization_method="estimated").fit(optimized=True)
                es_pred = es_fit.forecast(len(y_test))
            test_preds["Exponential Smoothing"] = np.array(es_pred)
            fitted_models["Exponential Smoothing"] = es_fit
        except Exception:
            test_preds["Exponential Smoothing"] = np.full(len(y_test), np.mean(y_train[-7:]))

        # Model 5: Ridge Regression
        try:
            ridge_m = Ridge(alpha=1.0)
            ridge_m.fit(X_train, y_train)
            test_preds["Ridge Regression"] = ridge_m.predict(X_test)
            fitted_models["Ridge Regression"] = ridge_m
        except Exception:
            test_preds["Ridge Regression"] = naive_pred

        # Model 6: Random Forest Regressor
        try:
            rf_m = RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                min_samples_split=4,
                random_state=42,
                n_jobs=-1
            )
            rf_m.fit(X_train, y_train)
            test_preds["Random Forest"] = rf_m.predict(X_test)
            fitted_models["Random Forest"] = rf_m
        except Exception:
            test_preds["Random Forest"] = ma_pred

        # Model 7: Gradient Boosting Regressor
        try:
            gb_m = GradientBoostingRegressor(
                n_estimators=150,
                learning_rate=0.05,
                max_depth=3,
                random_state=42
            )
            gb_m.fit(X_train, y_train)
            test_preds["Gradient Boosting"] = gb_m.predict(X_test)
            fitted_models["Gradient Boosting"] = gb_m
        except Exception:
            test_preds["Gradient Boosting"] = naive_pred

        # Ensure all test predictions are non-negative
        for m_name in test_preds:
            test_preds[m_name] = np.maximum(0, np.round(test_preds[m_name], 1))

        # 7. Model Evaluation & Best Model Selection
        model_eval_list = evaluate_models(y_test, test_preds)
        best_model_name = model_eval_list[0]["model_name"]
        if user_model_choice and user_model_choice in test_preds:
            best_model_name = user_model_choice

        # Calculate residual standard error for confidence intervals
        best_val_preds = test_preds[best_model_name]
        residuals = y_test - best_val_preds
        residual_std = float(np.std(residuals)) if len(residuals) > 1 else max(1.0, float(np.mean(y_test) * 0.15))

        # 8. Train Final Model on All Available Data for Future Forecasting
        X_all = model_df[features].fillna(0)
        y_all = model_df['_cleaned_target'].values.astype(float)

        final_model = None
        if best_model_name == "Random Forest":
            final_model = RandomForestRegressor(n_estimators=200, max_depth=10, min_samples_split=4, random_state=42, n_jobs=-1)
            final_model.fit(X_all, y_all)
        elif best_model_name == "Gradient Boosting":
            final_model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.05, max_depth=3, random_state=42)
            final_model.fit(X_all, y_all)
        elif best_model_name == "Ridge Regression":
            final_model = Ridge(alpha=1.0)
            final_model.fit(X_all, y_all)
        elif best_model_name == "Exponential Smoothing":
            try:
                final_model = Holt(y_all, initialization_method="estimated").fit(optimized=True)
            except Exception:
                final_model = SimpleExpSmoothing(y_all, initialization_method="estimated").fit(optimized=True)

        # 9. Multi-Step Recursive Future Forecasting
        future_timeline = []
        history_series = list(y_all)
        last_date = model_df['_parsed_date'].max()
        recent_window = model_df.tail(28)

        # Approximate future exogenous values from recent historical means
        future_exog_defaults = {}
        for f in features:
            if f not in candidate_feature_cols[:len(lags) + len(rolling_windows) + 6]:
                if pd.api.types.is_numeric_dtype(recent_window[f]):
                    future_exog_defaults[f] = float(recent_window[f].mean())
                else:
                    future_exog_defaults[f] = 0.0

        for step in range(1, self.horizon + 1):
            if self.is_daily:
                future_date = last_date + pd.Timedelta(days=step)
            else:
                future_date = last_date + pd.Timedelta(weeks=step)

            # Recursive lag values
            lag_1 = history_series[-1]
            lag_7 = history_series[-7] if len(history_series) >= 7 else history_series[-1]
            lag_14 = history_series[-14] if len(history_series) >= 14 else lag_7
            lag_28 = history_series[-28] if len(history_series) >= 28 else lag_14

            rolling_mean_7 = float(np.mean(history_series[-7:]))
            rolling_mean_14 = float(np.mean(history_series[-14:])) if len(history_series) >= 14 else rolling_mean_7
            rolling_mean_28 = float(np.mean(history_series[-28:])) if len(history_series) >= 28 else rolling_mean_14
            rolling_std_7 = float(np.std(history_series[-7:], ddof=1)) if len(history_series) >= 7 else 0.0

            # Future calendar features
            day_of_week = future_date.dayofweek
            month = future_date.month
            quarter = future_date.quarter
            week_of_year = int(future_date.isocalendar().week)
            is_weekend = 1 if day_of_week in [5, 6] else 0
            trend = len(history_series) + 1

            # Build feature vector for step
            step_features: Dict[str, Any] = {
                "Lag_1": lag_1,
                "Lag_7": lag_7,
                "Lag_14": lag_14,
                "Lag_28": lag_28,
                "Lag_2": history_series[-2] if len(history_series) >= 2 else lag_1,
                "Lag_4": history_series[-4] if len(history_series) >= 4 else lag_1,
                "Lag_8": history_series[-8] if len(history_series) >= 8 else lag_1,
                "Rolling_Mean_2": float(np.mean(history_series[-2:])),
                "Rolling_Mean_4": float(np.mean(history_series[-4:])) if len(history_series) >= 4 else lag_1,
                "Rolling_Mean_7": rolling_mean_7,
                "Rolling_Mean_8": float(np.mean(history_series[-8:])) if len(history_series) >= 8 else rolling_mean_7,
                "Rolling_Mean_14": rolling_mean_14,
                "Rolling_Mean_28": rolling_mean_28,
                "Rolling_Std_7": rolling_std_7,
                "Demand_Trend": rolling_mean_7 - rolling_mean_28,
                "Day_of_Week": day_of_week,
                "Month": month,
                "Quarter": quarter,
                "Week_of_Year": week_of_year,
                "Is_Weekend": is_weekend,
                "Trend": trend
            }
            # Populate exogenous inputs
            for ex_k, ex_v in future_exog_defaults.items():
                step_features[ex_k] = ex_v

            # Generate prediction
            if best_model_name == "Seasonal Naive Baseline":
                pred = lag_7 if self.is_daily else lag_1
            elif best_model_name == "Naive Baseline":
                pred = lag_1
            elif best_model_name == "Moving Average":
                pred = rolling_mean_7
            elif best_model_name == "Exponential Smoothing":
                try:
                    pred = final_model.forecast(step)[-1]
                except Exception:
                    pred = rolling_mean_7
            else:
                x_step = pd.DataFrame([step_features])[features].fillna(0)
                pred = final_model.predict(x_step)[0]

            pred_val = max(0.0, round(float(pred), 1))
            history_series.append(pred_val)

            # Uncertainty intervals (95% CI expands with forecast horizon)
            ci_multiplier = 1.96 * math.sqrt(1 + (step * 0.05))
            lower_b = max(0.0, round(pred_val - ci_multiplier * residual_std, 1))
            upper_b = round(pred_val + ci_multiplier * residual_std, 1)

            future_timeline.append({
                "date": future_date.strftime('%Y-%m-%d'),
                "forecast_demand_units": int(round(pred_val)),
                "lower_bound": int(round(lower_b)),
                "upper_bound": int(round(upper_b)),
                "lag_reference": int(round(lag_7 if self.is_daily else lag_1)),
                "rolling_mean": round(rolling_mean_7, 1),
                "rolling_std": round(rolling_std_7, 1),
                "is_future": True
            })

        # 10. Inventory Position & Replenishment Logic
        latest_inv = 0.0
        if current_inventory_override is not None:
            latest_inv = float(current_inventory_override)
        elif self.inventory_col and self.inventory_col in model_df.columns:
            last_inv_val = model_df[self.inventory_col].iloc[-1]
            c_inv, _ = clean_currency_or_number(last_inv_val)
            latest_inv = float(c_inv) if c_inv is not None else 0.0

        total_future_demand = sum(item["forecast_demand_units"] for item in future_timeline)
        avg_demand_std = float(np.mean([item["rolling_std"] for item in future_timeline]))
        if avg_demand_std <= 0:
            avg_demand_std = max(1.0, float(np.std(y_all[-14:])))

        replenishment_report = calculate_replenishment(
            forecast_demand_units=total_future_demand,
            current_inventory=latest_inv,
            demand_std=avg_demand_std,
            lead_time_days=lead_time_days,
            review_period_days=review_period_days,
            service_level=service_level,
            min_order_quantity=min_order_quantity,
            case_pack_size=case_pack_size,
            incoming_orders=existing_incoming_orders
        )

        # Attach daily replenishment view to future timeline
        for item in future_timeline:
            daily_fc = item["forecast_demand_units"]
            item["estimated_lead_time_demand"] = round(daily_fc * lead_time_days, 1)
            item["safety_stock_units"] = int(np.ceil(1.65 * max(1.0, item["rolling_std"]) * math.sqrt(lead_time_days)))
            item["current_inventory"] = int(latest_inv)
            item["stock_cover_days"] = round(latest_inv / max(1.0, daily_fc), 1)

        # 11. Historical & Holdout Validation Timeline
        historical_timeline = []
        for idx, row in model_df.iterrows():
            d_str = row['_parsed_date'].strftime('%Y-%m-%d')
            actual_val = float(row['_cleaned_target'])
            is_holdout = idx >= len(train_df)
            holdout_idx = idx - len(train_df) if is_holdout else None

            best_pred_val = float(best_val_preds[holdout_idx]) if (is_holdout and holdout_idx is not None and holdout_idx < len(best_val_preds)) else None
            naive_pred_val = float(test_preds["Seasonal Naive Baseline"][holdout_idx]) if (is_holdout and holdout_idx is not None and holdout_idx < len(test_preds["Seasonal Naive Baseline"])) else None

            historical_timeline.append({
                "date": d_str,
                "actual_demand": int(round(actual_val)),
                "is_validation": is_holdout,
                "best_model_predicted": int(round(best_pred_val)) if best_pred_val is not None else None,
                "naive_predicted": int(round(naive_pred_val)) if naive_pred_val is not None else None,
                "residual_error": round(actual_val - best_pred_val, 1) if best_pred_val is not None else None,
                "inventory": int(row[self.inventory_col]) if (self.inventory_col and self.inventory_col in row and pd.notna(row[self.inventory_col])) else None
            })

        # 12. Cross-SKU and Cross-Locality Comparison Aggregates
        sku_comparison_data = []
        if self.sku_col and self.sku_col in self.raw_df.columns:
            sku_grp = self.raw_df.groupby(self.sku_col)[self.target_col].agg(['sum', 'mean', 'count']).reset_index()
            for _, s_row in sku_grp.iterrows():
                sku_comparison_data.append({
                    "sku": str(s_row[self.sku_col]),
                    "total_sales": float(s_row['sum']),
                    "average_daily_sales": round(float(s_row['mean']), 1),
                    "records_count": int(s_row['count']),
                    "is_selected": str(s_row[self.sku_col]) == str(self.selected_sku)
                })

        locality_comparison_data = []
        if self.locality_col and self.locality_col in self.raw_df.columns:
            loc_grp = self.raw_df.groupby(self.locality_col)[self.target_col].agg(['sum', 'mean', 'count']).reset_index()
            for _, l_row in loc_grp.iterrows():
                locality_comparison_data.append({
                    "locality": str(l_row[self.locality_col]),
                    "total_sales": float(l_row['sum']),
                    "average_daily_sales": round(float(l_row['mean']), 1),
                    "records_count": int(l_row['count']),
                    "is_selected": str(l_row[self.locality_col]) == str(self.selected_locality)
                })

        # 13. Brand & Pack size resolution for metadata
        brand_val = None
        if self.brand_col and self.brand_col in filtered_df.columns:
            brand_val = str(filtered_df[self.brand_col].dropna().iloc[0]) if len(filtered_df[self.brand_col].dropna()) > 0 else "Parle-G"
        pack_size_val = None
        if self.pack_size_col and self.pack_size_col in filtered_df.columns:
            pack_size_val = str(filtered_df[self.pack_size_col].dropna().iloc[0]) if len(filtered_df[self.pack_size_col].dropna()) > 0 else None

        # 14. Feature Availability Summary
        feature_report = []
        for f in features:
            f_report = {
                "feature_name": f,
                "category": "Historical Demand" if "Lag" in f or "Rolling" in f else ("Calendar" if f in ['Day_of_Week', 'Month', 'Quarter', 'Week_of_Year', 'Trend', 'Is_Weekend'] else "External Factor"),
                "non_null_count": int(model_df[f].notna().sum()),
                "sample_value": round(float(model_df[f].iloc[-1]), 2) if pd.api.types.is_numeric_dtype(model_df[f]) else str(model_df[f].iloc[-1])
            }
            feature_report.append(f_report)

        best_model_metrics = next((m for m in model_eval_list if m["model_name"] == best_model_name), model_eval_list[0])

        return {
            "status": "success",
            "metadata": {
                "selected_sku": self.selected_sku,
                "selected_locality": self.selected_locality,
                "brand": brand_val,
                "pack_size": pack_size_val,
                "frequency": self.frequency.capitalize(),
                "horizon": self.horizon,
                "holdout_periods": effective_holdout,
                "training_periods": len(train_df),
                "total_valid_observations": len(model_df),
                "best_model": best_model_name,
                "best_model_metrics": best_model_metrics,
                "available_skus": self.available_skus,
                "available_localities": self.available_localities,
                "available_brands": self.available_brands
            },
            "historical_timeline": historical_timeline,
            "future_timeline": future_timeline,
            "model_evaluations": model_eval_list,
            "replenishment": replenishment_report,
            "sku_comparison": sku_comparison_data,
            "locality_comparison": locality_comparison_data,
            "feature_availability": feature_report,
            "cleaning_diagnostics": diag_report
        }
