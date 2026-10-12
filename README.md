# ByteMinds Revenue Forecasting Studio

> **AI-Powered Revenue Intelligence & Econometric Forecasting**  
> *Engineered for MBA Project Presentation & Faculty Evaluation*

---

## 1. Executive Summary

**ByteMinds Revenue Forecasting Studio** is a full-stack financial analytics and econometric forecasting platform. Built for corporate revenue intelligence and executive planning, it addresses the core challenges of quarterly corporate revenue forecasting—exemplified by Fast Moving Consumer Goods (FMCG) titan **Tata Consumer Products Ltd**, as well as benchmark datasets for **Hindustan Unilever Ltd (HUL)** and **Titan Company Ltd**.

Unlike static mockups or simulated dashboards, ByteMinds runs **genuine Python econometric and machine learning pipelines** powered by `scikit-learn` and `statsmodels`. It enforces **strict chronological holdout validation** (preventing temporal look-ahead data leakage), provides interactive data quality audits, detects quarterly seasonality multipliers, and supports multi-sheet Excel (`.xlsx`, `.xls`) and CSV ingestion.

---

## 2. Technology Stack

- **Frontend Application**:
  - React 19 with TypeScript and Vite
  - Tailwind CSS (v4) with polished enterprise styling (Dark Navy sidebar `#0F172A`, Slate-50 background, Indigo/Emerald accents)
  - Recharts for multi-series time-series visualization, confidence corridors, and vertical bar comparisons
  - Lucide React for consistent financial iconography
  - Axios for typed REST communication
- **Backend Machine Learning Engine**:
  - Python 3.14 with FastAPI and Uvicorn
  - Data Processing: `pandas` and `numpy`
  - Statistical & Econometric Forecasting: `statsmodels` (`ExponentialSmoothing`, `Holt`, `SimpleExpSmoothing`)
  - Machine Learning: `scikit-learn` (`Ridge`, `RandomForestRegressor`, `GradientBoostingRegressor`, metrics)
  - Spreadsheet Engine: `openpyxl` (multi-sheet parsing, styling, and streaming exports)
  - Schema Validation: `pydantic`

---

## 3. Core Modules & Navigation Layout

The application features a persistent left navigation sidebar with 8 distinct analytical stages:

1. **Overview**: Executive briefing, top 4 KPI cards (Last Observed Revenue, Next Quarter Projection, Projected YoY Growth, Winning Model Holdout MAE), and mini trajectory corridor preview.
2. **Upload Dataset**: Drag-and-drop file ingestion (`.xlsx`, `.xls`, `.csv`), multi-sheet Excel selector, column detection, raw data preview, and 1-click loading of benchmark corporate datasets (Tata Consumer, HUL, Titan).
3. **Data Explorer**: Configuration panel for series mapping, frequency (`Quarterly`, `Monthly`, `Daily`), horizon slider (1–12 periods), chronological validation split (2–8 periods), data preparation policies (deduplication, aggregation: sum/mean/last, missing value imputation), and interactive Data Health Audit (health score 0–100, outlier alert with FMCG festive surge commentary).
4. **Revenue Forecast**: Main forecasting studio featuring an interactive Recharts timeline (Historical Actuals, Validation Predictions, Forward Predictions, 95% Confidence Corridor, and ±8% Scenario Bands) with model switcher and detailed quarterly forecast schedule table.
5. **Model Comparison**: Econometric leaderboard evaluating all 7 models. Includes side-by-side **Horizontal Bar Charts for MAE and RMSE**, overfitting warnings, and manual model override capability.
6. **Forecast Insights**: Automated AI Executive Narrative, FMCG quarterly seasonality multipliers (Q1–Q4), YoY/QoQ growth velocity bar charts, and strategic C-suite recommendations (raw material hedging, festive inventory buffer planning).
7. **Download Reports**: Export forecast timeline as CSV, export complete styled multi-sheet Excel workbook (`.xlsx`), and clean print-ready Executive MBA Summary Memo with faculty signature block.
8. **About the Model**: Comprehensive academic documentation detailing the mathematical formulations of all 7 models, the justification for chronological validation over k-fold shuffling, and metric definitions.

---

## 4. The 7 Forecasting Architectures

| ID | Model Name | Category | Theoretical Formulation & Key Feature |
|---|---|---|---|
| **Model A** | Naive Forecast | Baseline | $\hat{y}_{T+h} = y_T$. Projects future revenue equal to the last observed historical value. Lower-bound benchmark. |
| **Model B** | Seasonal Naive | Baseline | $\hat{y}_{T+h} = y_{T+h-m}$ ($m=4$ for quarterly). Projects revenue from the corresponding quarter in the previous year. |
| **Model C** | Moving Average | Statistical | Rolling arithmetic mean of recent $k$ quarters ($k=4$). Smooths transient volatility. |
| **Model D** | Exponential Smoothing (Holt-Winters) | Statistical / statsmodels | State-of-the-art econometric smoothing modeling level, additive trend, and quarterly seasonal indices via `statsmodels.tsa.api.ExponentialSmoothing`. |
| **Model E** | Ridge Regression (L2) | Machine Learning | Autoregressive lag features ($\text{Lag}_1, \text{Lag}_2, \text{Lag}_4$, trend index, seasonal quarter indicator) with L2 Tikhonov regularization ($\alpha=1.0$). |
| **Model F** | Random Forest Regressor | Machine Learning | Ensemble of 100 decision trees utilizing lagged revenue and calendar features. Constrained depth ($\text{max\_depth}=3$) to control variance. |
| **Model G** | Gradient Boosting Regressor | Machine Learning | Sequential boosting of pseudo-residuals via `scikit-learn GradientBoostingRegressor` ($\text{learning\_rate}=0.08$). |

---

## 5. Strict Chronological Validation Protocol

Standard $k$-fold cross-validation is **statistically invalid** for time-series forecasting because randomly shuffling observations introduces catastrophic look-ahead bias (using future sales to predict the past) and violates autocorrelation independence.

ByteMinds strictly enforces **Chronological Holdout Validation**:
1. Sort records strictly by chronological period.
2. Withhold the latest $N$ observations ($N=4$ quarters) as the out-of-sample holdout test window.
3. Train all eligible models strictly on earlier historical observations.
4. Predict the holdout test window and calculate genuine out-of-sample metrics:
   - **MAE (Mean Absolute Error)**: Expected linear deviation in INR Crores (primary ranking criterion).
   - **RMSE (Root Mean Squared Error)**: Penalizes severe quarterly misses.
   - **MAPE (%)**: Mean Absolute Percentage Error (computed when actuals $> 0$).
   - **$R^2$ Score**: Proportion of variance explained (flagged when negative on small holdouts).
5. Refit models on the complete history to forecast $h$ future quarters into the future.

---

## 6. How to Run Locally

### Prerequisites
- Python 3.10+ (Installed on system with `pandas`, `scikit-learn`, `statsmodels`, `openpyxl`, `fastapi`, `uvicorn`)
- Node.js v20+ / v22+

### Running the Python Backend
```powershell
cd c:\Users\lenovo\Desktop\byteminds-studio\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI server will be active at `http://127.0.0.1:8000` (Swagger docs available at `http://127.0.0.1:8000/docs`).

### Running the React Frontend
```powershell
cd c:\Users\lenovo\Desktop\byteminds-studio\frontend
$env:PATH = "C:\Users\lenovo\node-v22;" + $env:PATH
npm run dev -- --host 127.0.0.1 --port 5173
```
Open your browser at `http://127.0.0.1:5173/` to interact with the full dashboard.

---

## 7. Sample Datasets Included

Located in `c:\Users\lenovo\Desktop\byteminds-studio\sample_data/`:
1. `Tata_Consumer_Products_Quarterly.xlsx` (Multi-sheet workbook: `Quarterly_Financials`, `Segment_Breakdown`, `Metadata_Notes`)
2. `Tata_Consumer_Products_Quarterly.csv` (28 consecutive quarters from Q1 FY19 through Q4 FY25)
3. `HUL_Quarterly_Revenue.csv` (Hindustan Unilever Ltd quarterly financials)
4. `Titan_Quarterly_Revenue.csv` (Titan Company Ltd quarterly retail figures)

Users can also drag and drop any custom `.xlsx` or `.csv` dataset. The engine automatically inspects sheets, detects period and revenue columns, audits data quality, and trains the models dynamically.
