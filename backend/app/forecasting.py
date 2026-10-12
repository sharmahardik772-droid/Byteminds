import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
import statsmodels.api as sm
from statsmodels.tsa.api import ExponentialSmoothing, SimpleExpSmoothing, Holt

def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> Optional[float]:
    """Calculates Mean Absolute Percentage Error (MAPE) safely."""
    mask = (y_true != 0) & (~np.isnan(y_true))
    if np.sum(mask) == 0:
        return None
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)

def generate_future_period_labels(last_label: str, last_date: pd.Timestamp, horizon: int, frequency: str = "Quarterly") -> Tuple[List[str], List[str]]:
    """
    Generates chronological future period labels (e.g. 'Q1 FY26', 'Q2 FY26') and date strings.
    """
    labels = []
    dates = []
    
    # Check if last_label is in Indian FY format: Q[1-4] FY(\d{2})
    import re
    m_fy = re.search(r'(?i)Q([1-4])\s*FY(\d{2})', last_label)
    if m_fy:
        curr_q = int(m_fy.group(1))
        curr_fy = int(m_fy.group(2))
        curr_date = last_date
        
        for _ in range(horizon):
            curr_q += 1
            if curr_q > 4:
                curr_q = 1
                curr_fy = (curr_fy + 1) % 100
            
            # Update date
            if curr_q == 1:
                # Q1 ends Jun 30
                cal_yr = 2000 + curr_fy - 1
                curr_date = pd.Timestamp(year=cal_yr, month=6, day=30)
            elif curr_q == 2:
                # Q2 ends Sep 30
                cal_yr = 2000 + curr_fy - 1
                curr_date = pd.Timestamp(year=cal_yr, month=9, day=30)
            elif curr_q == 3:
                # Q3 ends Dec 31
                cal_yr = 2000 + curr_fy - 1
                curr_date = pd.Timestamp(year=cal_yr, month=12, day=31)
            else:
                # Q4 ends Mar 31
                cal_yr = 2000 + curr_fy
                curr_date = pd.Timestamp(year=cal_yr, month=3, day=31)
                
            labels.append(f"Q{curr_q} FY{str(curr_fy).zfill(2)}")
            dates.append(curr_date.strftime('%Y-%m-%d'))
        return labels, dates
        
    # Check Calendar Quarter: Q[1-4] YYYY or YYYY-Q[1-4]
    m_cal = re.search(r'(?i)Q([1-4])\s*(\d{4})', last_label)
    if not m_cal:
        m_cal = re.search(r'(?i)(\d{4})\s*[-_]?\s*Q([1-4])', last_label)
        if m_cal:
            yr = int(m_cal.group(1))
            q = int(m_cal.group(2))
        else:
            yr, q = None, None
    else:
        q = int(m_cal.group(1))
        yr = int(m_cal.group(2))
        
    if yr is not None and q is not None:
        for _ in range(horizon):
            q += 1
            if q > 4:
                q = 1
                yr += 1
            if q == 1:
                curr_date = pd.Timestamp(year=yr, month=3, day=31)
            elif q == 2:
                curr_date = pd.Timestamp(year=yr, month=6, day=30)
            elif q == 3:
                curr_date = pd.Timestamp(year=yr, month=9, day=30)
            else:
                curr_date = pd.Timestamp(year=yr, month=12, day=31)
            labels.append(f"Q{q} {yr}")
            dates.append(curr_date.strftime('%Y-%m-%d'))
        return labels, dates

    # Fallback to date increments
    curr_date = last_date
    for i in range(1, horizon + 1):
        if frequency.lower() == "quarterly":
            curr_date = curr_date + pd.DateOffset(months=3)
            labels.append(f"Period +{i}")
        elif frequency.lower() == "monthly":
            curr_date = curr_date + pd.DateOffset(months=1)
            labels.append(f"Month +{i}")
        else:
            curr_date = curr_date + pd.DateOffset(days=90)
            labels.append(f"T+{i}")
        dates.append(curr_date.strftime('%Y-%m-%d'))
        
    return labels, dates

class RevenueForecastingEngine:
    """
    Engine executing real time-series and ML revenue forecasting models:
    - Model A: Naive Forecast
    - Model B: Seasonal Naive
    - Model C: Moving Average
    - Model D: Exponential Smoothing (statsmodels)
    - Model E: Ridge Regression (engineered lags)
    - Model F: Random Forest Regressor
    - Model G: Gradient Boosting Regressor
    """
    def __init__(
        self,
        series: pd.Series,
        dates: pd.Series,
        labels: pd.Series,
        frequency: str = "Quarterly",
        holdout_periods: Optional[int] = None
    ):
        self.y_all = series.values.astype(float)
        self.dates = pd.to_datetime(dates)
        self.labels = labels.values
        self.frequency = frequency
        self.n_total = len(self.y_all)
        
        # Determine seasonal period m
        if "quarter" in frequency.lower():
            self.m = 4
        elif "month" in frequency.lower():
            self.m = 12
        else:
            self.m = 4
            
        # Determine chronological validation holdout
        if holdout_periods is not None:
            self.holdout_len = max(1, min(holdout_periods, self.n_total - 4))
        else:
            # Default to 4 quarters or ~15-20% of data, minimum 2
            if self.n_total >= 16:
                self.holdout_len = 4
            elif self.n_total >= 8:
                self.holdout_len = min(self.m, max(2, self.n_total // 4))
            else:
                self.holdout_len = 2
                
        self.train_len = self.n_total - self.holdout_len
        self.y_train = self.y_all[:self.train_len]
        self.y_val = self.y_all[self.train_len:]
        
    def _create_ml_features(self, y: np.ndarray, max_lags: int = 4) -> Tuple[np.ndarray, np.ndarray]:
        """Creates chronological lag features and trend index for ML models."""
        X, targets = [], []
        for i in range(max_lags, len(y)):
            lags = [y[i - lag] for lag in range(1, max_lags + 1)]
            rolling_avg = np.mean(y[i - min(3, i):i])
            trend_idx = float(i)
            # Seasonal quarter indicator (1 to 4)
            q_indicator = float((i % self.m) + 1)
            X.append(lags + [rolling_avg, trend_idx, q_indicator])
            targets.append(y[i])
        return np.array(X), np.array(targets)

    def _recursive_ml_forecast(self, model, hist_y: np.ndarray, horizon: int, max_lags: int = 4) -> np.ndarray:
        """Forecasts multi-step ahead recursively using lagged features."""
        preds = []
        curr_hist = list(hist_y)
        for step in range(horizon):
            idx = len(curr_hist)
            lags = [curr_hist[-lag] for lag in range(1, max_lags + 1)]
            rolling_avg = np.mean(curr_hist[-min(3, len(curr_hist)):])
            trend_idx = float(idx)
            q_indicator = float((idx % self.m) + 1)
            x_step = np.array([lags + [rolling_avg, trend_idx, q_indicator]])
            pred_val = float(model.predict(x_step)[0])
            preds.append(pred_val)
            curr_hist.append(pred_val)
        return np.array(preds)

    # ----------------------------------------------------
    # Model A: Naive Forecast
    # ----------------------------------------------------
    def train_model_a_naive(self, horizon: int) -> Dict[str, Any]:
        name = "Model A: Naive Forecast"
        last_train_val = self.y_train[-1]
        val_preds = np.full(shape=(self.holdout_len,), fill_value=last_train_val)
        
        # Future forecast from full dataset
        last_actual = self.y_all[-1]
        future_preds = np.full(shape=(horizon,), fill_value=last_actual)
        
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_a_naive",
            "name": name,
            "category": "Baseline",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": "Predicts future revenue equal to the last observed historical value. Serves as the fundamental baseline for time-series benchmarking.",
            "warnings": ["Assumes no trend or seasonality; quickly deviates in high-growth companies."]
        }

    # ----------------------------------------------------
    # Model B: Seasonal Naive
    # ----------------------------------------------------
    def train_model_b_seasonal_naive(self, horizon: int) -> Dict[str, Any]:
        name = "Model B: Seasonal Naive"
        if self.train_len < self.m:
            return {
                "id": "model_b_seasonal_naive",
                "name": name,
                "category": "Baseline",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": f"Predicts future revenue equal to the same period in the previous seasonal cycle (m={self.m}).",
                "warnings": [f"Insufficient historical observations for seasonal baseline. Requires at least {self.m} periods."]
            }
            
        # Validation forecast
        val_preds = []
        for h in range(self.holdout_len):
            idx = self.train_len + h
            ref_idx = idx - self.m
            if ref_idx < self.train_len:
                val_preds.append(self.y_train[ref_idx])
            else:
                val_preds.append(val_preds[ref_idx - self.train_len])
        val_preds = np.array(val_preds)
        
        # Future forecast using full series
        future_preds = []
        full_hist = list(self.y_all)
        for h in range(horizon):
            idx = len(full_hist)
            val = full_hist[idx - self.m]
            future_preds.append(val)
            full_hist.append(val)
        future_preds = np.array(future_preds)
        
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_b_seasonal_naive",
            "name": name,
            "category": "Baseline",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": f"Projects revenue from the corresponding quarter in the previous year (Lag-{self.m}). Captures repeating festival/calendar surges.",
            "warnings": ["Does not incorporate multi-year secular compounding trend."]
        }

    # ----------------------------------------------------
    # Model C: Moving Average
    # ----------------------------------------------------
    def train_model_c_moving_average(self, horizon: int, window: int = 4) -> Dict[str, Any]:
        name = f"Model C: Moving Average (Window={window})"
        w = min(window, max(2, self.train_len - 1))
        
        # Validation predictions (recursive)
        val_preds = []
        curr_train = list(self.y_train)
        for _ in range(self.holdout_len):
            p = float(np.mean(curr_train[-w:]))
            val_preds.append(p)
            curr_train.append(p)
        val_preds = np.array(val_preds)
        
        # Future forecast
        future_preds = []
        curr_all = list(self.y_all)
        for _ in range(horizon):
            p = float(np.mean(curr_all[-w:]))
            future_preds.append(p)
            curr_all.append(p)
        future_preds = np.array(future_preds)
        
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_c_moving_average",
            "name": name,
            "category": "Statistical",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": f"Forecasts using the rolling mean of the {w} most recent quarters. Smooths out temporary volatility.",
            "warnings": ["Tends to lag behind sharp inflection points or rapid revenue acceleration."]
        }

    # ----------------------------------------------------
    # Model D: Exponential Smoothing (statsmodels)
    # ----------------------------------------------------
    def train_model_d_exponential_smoothing(self, horizon: int) -> Dict[str, Any]:
        name = "Model D: Exponential Smoothing"
        warnings = []
        has_seasonal = False
        
        # Need at least 2*m periods to fit seasonal Holt-Winters
        if self.train_len >= 2 * self.m:
            try:
                fit_val = ExponentialSmoothing(
                    self.y_train, 
                    trend="add", 
                    seasonal="add", 
                    seasonal_periods=self.m, 
                    initialization_method="estimated"
                ).fit()
                val_preds = fit_val.forecast(self.holdout_len)
                has_seasonal = True
            except Exception:
                has_seasonal = False
                
        if not has_seasonal:
            try:
                # Holt linear trend
                fit_val = Holt(self.y_train, initialization_method="estimated").fit()
                val_preds = fit_val.forecast(self.holdout_len)
                warnings.append("Fitted Holt linear trend model (seasonal components skipped due to sample length).")
            except Exception:
                # Simple exponential smoothing fallback
                fit_val = SimpleExpSmoothing(self.y_train, initialization_method="estimated").fit()
                val_preds = fit_val.forecast(self.holdout_len)
                warnings.append("Fallback to Simple Exponential Smoothing.")
                
        # Full future forecast
        if has_seasonal and self.n_total >= 2 * self.m:
            try:
                fit_full = ExponentialSmoothing(
                    self.y_all, 
                    trend="add", 
                    seasonal="add", 
                    seasonal_periods=self.m, 
                    initialization_method="estimated"
                ).fit()
                future_preds = fit_full.forecast(horizon)
            except Exception:
                fit_full = Holt(self.y_all, initialization_method="estimated").fit()
                future_preds = fit_full.forecast(horizon)
        else:
            try:
                fit_full = Holt(self.y_all, initialization_method="estimated").fit()
                future_preds = fit_full.forecast(horizon)
            except Exception:
                fit_full = SimpleExpSmoothing(self.y_all, initialization_method="estimated").fit()
                future_preds = fit_full.forecast(horizon)
                
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        model_label = "Holt-Winters (Trend + Seasonal)" if has_seasonal else "Holt Linear Trend"
        
        return {
            "id": "model_d_exponential_smoothing",
            "name": f"Model D: Exponential Smoothing ({model_label})",
            "category": "Statistical",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": f"Real statsmodels {model_label}. Adapts weighting to recent observations while capturing systemic trend trajectory.",
            "warnings": warnings
        }

    # ----------------------------------------------------
    # Model E: Ridge Regression (L2 regularized lag model)
    # ----------------------------------------------------
    def train_model_e_ridge(self, horizon: int) -> Dict[str, Any]:
        name = "Model E: Ridge Regression (L2)"
        warnings = []
        max_lags = min(4, self.train_len - 2)
        if max_lags < 2:
            return {
                "id": "model_e_ridge",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "L2-regularized linear model trained on chronological revenue lags and time trend.",
                "warnings": ["Too few observations to construct autoregressive feature matrix."]
            }
            
        X_train, y_train_ml = self._create_ml_features(self.y_train, max_lags=max_lags)
        if len(X_train) < 3:
            return {
                "id": "model_e_ridge",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "L2 Ridge Regression on lags.",
                "warnings": ["Insufficient degrees of freedom for regression training."]
            }
            
        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train_ml)
        val_preds = self._recursive_ml_forecast(model, self.y_train, self.holdout_len, max_lags=max_lags)
        
        # Fit on full data for future
        X_full, y_full_ml = self._create_ml_features(self.y_all, max_lags=max_lags)
        model_full = Ridge(alpha=1.0)
        model_full.fit(X_full, y_full_ml)
        future_preds = self._recursive_ml_forecast(model_full, self.y_all, horizon, max_lags=max_lags)
        
        if self.train_len < 16:
            warnings.append("Small sample size: Regularization helps curb variance, but small degrees of freedom remain.")
            
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_e_ridge",
            "name": name,
            "category": "Machine Learning",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": "Linear autoregressive model with L2 Tikhonov regularization. Balances secular quarterly trends against seasonal lag coefficients.",
            "warnings": warnings
        }

    # ----------------------------------------------------
    # Model F: Random Forest Regressor
    # ----------------------------------------------------
    def train_model_f_random_forest(self, horizon: int) -> Dict[str, Any]:
        name = "Model F: Random Forest Regressor"
        warnings = []
        max_lags = min(4, self.train_len - 2)
        if max_lags < 2 or self.train_len < 8:
            return {
                "id": "model_f_random_forest",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "Ensemble of decision trees trained on lagged revenue and calendar features.",
                "warnings": ["Requires at least 8 observations to prevent severe decision tree degeneracy."]
            }
            
        X_train, y_train_ml = self._create_ml_features(self.y_train, max_lags=max_lags)
        if len(X_train) < 4:
            return {
                "id": "model_f_random_forest",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "Random Forest Regressor.",
                "warnings": ["Insufficient training samples for ensemble trees."]
            }
            
        # Constrain tree depth to avoid extreme overfitting on small time series
        rf = RandomForestRegressor(n_estimators=100, max_depth=3, min_samples_leaf=1, random_state=42)
        rf.fit(X_train, y_train_ml)
        val_preds = self._recursive_ml_forecast(rf, self.y_train, self.holdout_len, max_lags=max_lags)
        
        # Fit on full series
        X_full, y_full_ml = self._create_ml_features(self.y_all, max_lags=max_lags)
        rf_full = RandomForestRegressor(n_estimators=100, max_depth=3, min_samples_leaf=1, random_state=42)
        rf_full.fit(X_full, y_full_ml)
        future_preds = self._recursive_ml_forecast(rf_full, self.y_all, horizon, max_lags=max_lags)
        
        if self.train_len < 20:
            warnings.append("High Overfitting Alert: Tree models cannot extrapolate beyond historical max revenue without explicit trend features.")
            
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_f_random_forest",
            "name": name,
            "category": "Machine Learning",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": "Nonlinear decision tree ensemble capturing intricate quarterly interactions. Subject to boundary constraints on secular trends.",
            "warnings": warnings
        }

    # ----------------------------------------------------
    # Model G: Gradient Boosting Regressor
    # ----------------------------------------------------
    def train_model_g_gradient_boosting(self, horizon: int) -> Dict[str, Any]:
        name = "Model G: Gradient Boosting Regressor"
        warnings = []
        max_lags = min(4, self.train_len - 2)
        if max_lags < 2 or self.train_len < 8:
            return {
                "id": "model_g_gradient_boosting",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "Sequential boosted decision trees optimizing pseudo-residuals.",
                "warnings": ["Insufficient historical observations for gradient boosting."]
            }
            
        X_train, y_train_ml = self._create_ml_features(self.y_train, max_lags=max_lags)
        if len(X_train) < 4:
            return {
                "id": "model_g_gradient_boosting",
                "name": name,
                "category": "Machine Learning",
                "status": "Ineligible",
                "metrics": None,
                "val_predictions": [],
                "future_predictions": [],
                "description": "Gradient Boosting Regressor.",
                "warnings": ["Insufficient feature rows."]
            }
            
        gbr = GradientBoostingRegressor(n_estimators=60, max_depth=2, learning_rate=0.08, random_state=42)
        gbr.fit(X_train, y_train_ml)
        val_preds = self._recursive_ml_forecast(gbr, self.y_train, self.holdout_len, max_lags=max_lags)
        
        # Fit on full
        X_full, y_full_ml = self._create_ml_features(self.y_all, max_lags=max_lags)
        gbr_full = GradientBoostingRegressor(n_estimators=60, max_depth=2, learning_rate=0.08, random_state=42)
        gbr_full.fit(X_full, y_full_ml)
        future_preds = self._recursive_ml_forecast(gbr_full, self.y_all, horizon, max_lags=max_lags)
        
        if self.train_len < 20:
            warnings.append("Overfitting Alert: Gradient boosting is prone to chasing noise in short quarterly financial series.")
            
        metrics = self._evaluate_predictions(self.y_val, val_preds)
        return {
            "id": "model_g_gradient_boosting",
            "name": name,
            "category": "Machine Learning",
            "status": "Trained",
            "metrics": metrics,
            "val_predictions": [round(float(v), 2) for v in val_preds],
            "future_predictions": [round(float(v), 2) for v in future_preds],
            "description": "Sequential boosting model focusing iteratively on residual forecast errors.",
            "warnings": warnings
        }

    # ----------------------------------------------------
    # Evaluation Helper
    # ----------------------------------------------------
    def _evaluate_predictions(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
        """Calculates chronological holdout metrics."""
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        
        # R2 calculation
        # If variance of y_true is 0 or len < 2, R2 is not meaningful
        if len(y_true) >= 2 and np.var(y_true) > 1e-6:
            r2 = float(r2_score(y_true, y_pred))
            r2_meaningful = True
        else:
            r2 = None
            r2_meaningful = False
            
        mape = calculate_mape(y_true, y_pred)
        
        return {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 2) if mape is not None else None,
            "r2": round(r2, 3) if (r2 is not None and not math.isnan(r2)) else None,
            "r2_meaningful": r2_meaningful,
            "validation_periods": len(y_true)
        }

    # ----------------------------------------------------
    # Run All Models and Rank
    # ----------------------------------------------------
    def run_all(self, horizon: int = 4) -> Dict[str, Any]:
        models = [
            self.train_model_a_naive(horizon),
            self.train_model_b_seasonal_naive(horizon),
            self.train_model_c_moving_average(horizon),
            self.train_model_d_exponential_smoothing(horizon),
            self.train_model_e_ridge(horizon),
            self.train_model_f_random_forest(horizon),
            self.train_model_g_gradient_boosting(horizon)
        ]
        
        # Determine best eligible model based on lowest MAE
        eligible_models = [m for m in models if m["status"] == "Trained" and m["metrics"] is not None]
        if eligible_models:
            eligible_models.sort(key=lambda m: (m["metrics"]["mae"], m["metrics"]["rmse"]))
            best_model_id = eligible_models[0]["id"]
            best_model_name = eligible_models[0]["name"]
        else:
            best_model_id = "model_a_naive"
            best_model_name = "Model A: Naive Forecast"
            
        # Generate future labels
        last_label = str(self.labels[-1])
        last_date = self.dates.iloc[-1]
        future_labels, future_dates = generate_future_period_labels(last_label, last_date, horizon, self.frequency)
        
        # Build timeline breakdown for charts:
        # 1. Historical Actuals (train period)
        # 2. Validation Holdout Actuals + Validation Predictions for each model
        # 3. Future Periods + Future Predictions for each model
        historical_timeline = []
        for i in range(self.n_total):
            item = {
                "index": i,
                "label": str(self.labels[i]),
                "date": self.dates.iloc[i].strftime('%Y-%m-%d'),
                "actual": round(float(self.y_all[i]), 2),
                "is_validation": bool(i >= self.train_len),
                "is_future": False
            }
            if i >= self.train_len:
                val_idx = i - self.train_len
                for m in models:
                    if m["status"] == "Trained" and val_idx < len(m["val_predictions"]):
                        item[f"pred_{m['id']}"] = m["val_predictions"][val_idx]
            historical_timeline.append(item)
            
        future_timeline = []
        # Calculate standard deviation of residuals for best model to build confidence intervals
        best_obj = next((m for m in eligible_models if m["id"] == best_model_id), eligible_models[0] if eligible_models else None)
        residual_std = 0.0
        if best_obj and best_obj["metrics"]:
            residual_std = best_obj["metrics"]["rmse"]
            
        for h in range(horizon):
            item = {
                "index": self.n_total + h,
                "label": future_labels[h],
                "date": future_dates[h],
                "actual": None,
                "is_validation": False,
                "is_future": True
            }
            for m in models:
                if m["status"] == "Trained" and h < len(m["future_predictions"]):
                    item[f"pred_{m['id']}"] = m["future_predictions"][h]
                    
            # Confidence corridor for the best model (95% approx 1.96 * residual_std)
            if best_obj and h < len(best_obj["future_predictions"]):
                best_val = best_obj["future_predictions"][h]
                ci_margin = max(best_val * 0.05, 1.96 * residual_std * math.sqrt(1 + 0.1 * h))
                item["best_pred"] = best_val
                item["lower_bound"] = round(max(0.0, best_val - ci_margin), 2)
                item["upper_bound"] = round(best_val + ci_margin, 2)
                item["scenario_optimistic"] = round(best_val * 1.08, 2) # +8% growth booster
                item["scenario_pessimistic"] = round(best_val * 0.92, 2) # -8% slowdown
                
            future_timeline.append(item)
            
        # Calculate YoY and QoQ growth for future best forecast
        future_growth_insights = []
        for h in range(horizon):
            cur_p = future_timeline[h]["best_pred"]
            # QoQ growth
            if h == 0:
                prev_p = self.y_all[-1]
            else:
                prev_p = future_timeline[h - 1]["best_pred"]
            qoq = ((cur_p - prev_p) / prev_p) * 100 if prev_p else 0.0
            
            # YoY growth (compare to same quarter 1 year ago)
            yoy = None
            ref_hist_idx = self.n_total - self.m + h
            if ref_hist_idx >= 0 and ref_hist_idx < self.n_total:
                past_y = self.y_all[ref_hist_idx]
                yoy = ((cur_p - past_y) / past_y) * 100
            elif h >= self.m:
                past_pred = future_timeline[h - self.m]["best_pred"]
                yoy = ((cur_p - past_pred) / past_pred) * 100
                
            future_growth_insights.append({
                "period": future_labels[h],
                "date": future_dates[h],
                "forecast_revenue": cur_p,
                "qoq_growth_pct": round(qoq, 2),
                "yoy_growth_pct": round(yoy, 2) if yoy is not None else None,
                "lower_bound": future_timeline[h]["lower_bound"],
                "upper_bound": future_timeline[h]["upper_bound"]
            })

        # Calculate Seasonality Indices (Quarterly average vs Grand average)
        seasonal_index = {}
        if self.m == 4:
            q_buckets = {1: [], 2: [], 3: [], 4: []}
            for i in range(self.n_total):
                q_num = (i % 4) + 1
                q_buckets[q_num].append(self.y_all[i])
            grand_mean = np.mean(self.y_all)
            for q in range(1, 5):
                q_mean = np.mean(q_buckets[q]) if q_buckets[q] else grand_mean
                idx_ratio = (q_mean / grand_mean) if grand_mean > 0 else 1.0
                seasonal_index[f"Q{q}"] = {
                    "quarter": f"Q{q}",
                    "average_revenue": round(float(q_mean), 2),
                    "seasonal_index": round(float(idx_ratio), 3),
                    "interpretation": f"{round((idx_ratio - 1.0) * 100, 1)}% vs FY Mean"
                }

        # Historical CAGR
        cagr = None
        if self.n_total >= self.m:
            years = self.n_total / self.m
            cagr = ((self.y_all[-1] / self.y_all[0]) ** (1.0 / years) - 1.0) * 100

        return {
            "best_model_id": best_model_id,
            "best_model_name": best_model_name,
            "models": models,
            "validation_holdout_size": self.holdout_len,
            "training_size": self.train_len,
            "total_observations": self.n_total,
            "frequency": self.frequency,
            "horizon": horizon,
            "historical_timeline": historical_timeline,
            "future_timeline": future_timeline,
            "future_growth_insights": future_growth_insights,
            "seasonal_indices": list(seasonal_index.values()),
            "historical_cagr_pct": round(cagr, 2) if cagr is not None else None,
            "validation_note": "Chronological holdout validation: Latest periods were strictly withheld during model training to estimate real-world out-of-sample forecast accuracy. Holdout metrics are realistic estimates of generalization, not absolute guarantees."
        }
