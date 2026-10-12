# ============================================================
# BYTEMINDS - PARLE-G HYPERLOCAL DEMAND FORECASTING
# ============================================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline


# ============================================================
# 1. LOAD EXCEL FILE
# ============================================================

print("\n==========================================")
print("   BYTEMINDS HYPERLOCAL FORECASTING")
print("==========================================\n")

# Put the Excel file in the same folder as this Python file
BASE_DIR = Path(__file__).resolve().parent

FILE_PATH = BASE_DIR / "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx"

print("Loading file:")
print(FILE_PATH)

if not FILE_PATH.exists():
    print("\nERROR: Excel file not found.")
    print("Make sure the Excel file is in the same folder as this Python file.")
    input("\nPress Enter to exit...")
    exit()

# Read data
df = pd.read_excel(
    FILE_PATH,
    sheet_name="ParleG_Daily_Data"
)

print("\nExcel file loaded successfully.")
print("Rows:", len(df))
print("Columns:", len(df.columns))


# ============================================================
# 2. BASIC DATA PREPARATION
# ============================================================

df["Date"] = pd.to_datetime(df["Date"])

df = df.sort_values(
    ["Locality", "SKU", "Date"]
).reset_index(drop=True)

print("\nAvailable SKUs:")
print(df["SKU"].unique())

print("\nAvailable Localities:")
print(df["Locality"].unique())


# ============================================================
# 3. SELECT SKU AND LOCALITY
# ============================================================

# CHANGE THESE IF REQUIRED

SELECTED_SKU = "Parle-G 250g"
SELECTED_LOCALITY = "Amritsar Central"

print("\n------------------------------------------")
print("Selected SKU      :", SELECTED_SKU)
print("Selected Locality :", SELECTED_LOCALITY)
print("------------------------------------------")


data = df[
    (df["SKU"] == SELECTED_SKU) &
    (df["Locality"] == SELECTED_LOCALITY)
].copy()

data = data.sort_values("Date").reset_index(drop=True)

if len(data) == 0:
    print("\nERROR: No data found for selected SKU/locality.")
    input("\nPress Enter to exit...")
    exit()

print("\nRecords for selected SKU/locality:", len(data))


# ============================================================
# 4. CREATE FORECASTING FEATURES
# ============================================================

# Historical demand

data["Lag_1"] = data["Sales_Quantity"].shift(1)

data["Lag_7"] = data["Sales_Quantity"].shift(7)

data["Lag_14"] = data["Sales_Quantity"].shift(14)

data["Lag_28"] = data["Sales_Quantity"].shift(28)


# Rolling averages

data["Rolling_Mean_7"] = (
    data["Sales_Quantity"]
    .shift(1)
    .rolling(7)
    .mean()
)

data["Rolling_Mean_28"] = (
    data["Sales_Quantity"]
    .shift(1)
    .rolling(28)
    .mean()
)


# Demand volatility

data["Rolling_Std_7"] = (
    data["Sales_Quantity"]
    .shift(1)
    .rolling(7)
    .std()
)


# Calendar features

data["Day_of_Week"] = data["Date"].dt.dayofweek

data["Month"] = data["Date"].dt.month

data["Quarter"] = data["Date"].dt.quarter

data["Week_of_Year"] = (
    data["Date"]
    .dt.isocalendar()
    .week
    .astype(int)
)


# Trend

data["Trend"] = np.arange(len(data))


# ============================================================
# 5. REMOVE ROWS WITH MISSING LAG VALUES
# ============================================================

data = data.dropna().reset_index(drop=True)

print("\nForecasting features created.")

print("\nFeatures used:")

FEATURES = [
    "Lag_1",
    "Lag_7",
    "Lag_14",
    "Lag_28",
    "Rolling_Mean_7",
    "Rolling_Mean_28",
    "Rolling_Std_7",
    "Promotion_Flag",
    "Discount_pct",
    "Holiday_Flag",
    "Temperature_C",
    "Rainfall_mm",
    "Competitor_Promotion_Flag",
    "Day_of_Week",
    "Month",
    "Quarter",
    "Week_of_Year",
    "Trend"
]

for feature in FEATURES:
    print("-", feature)


# ============================================================
# 6. CHRONOLOGICAL TRAIN / TEST SPLIT
# ============================================================

# Last 28 days = test data

TEST_DAYS = 28

train = data.iloc[:-TEST_DAYS].copy()

test = data.iloc[-TEST_DAYS:].copy()

print("\n------------------------------------------")
print("TRAINING DATA")
print("------------------------------------------")

print("Training records:", len(train))

print(
    "Training period:",
    train["Date"].min().date(),
    "to",
    train["Date"].max().date()
)

print("\n------------------------------------------")
print("TEST DATA")
print("------------------------------------------")

print("Testing records:", len(test))

print(
    "Testing period:",
    test["Date"].min().date(),
    "to",
    test["Date"].max().date()
)


X_train = train[FEATURES]

y_train = train["Sales_Quantity"]

X_test = test[FEATURES]

y_test = test["Sales_Quantity"]


# ============================================================
# 7. MODEL 1 - RANDOM FOREST
# ============================================================

print("\nTraining Random Forest...")

rf_model = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)

rf_model.fit(
    X_train,
    y_train
)

rf_predictions = rf_model.predict(X_test)


rf_mae = mean_absolute_error(
    y_test,
    rf_predictions
)

rf_rmse = np.sqrt(
    mean_squared_error(
        y_test,
        rf_predictions
    )
)


# ============================================================
# 8. MODEL 2 - GRADIENT BOOSTING
# ============================================================

print("Training Gradient Boosting...")

gb_model = GradientBoostingRegressor(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=3,
    random_state=42
)

gb_model.fit(
    X_train,
    y_train
)

gb_predictions = gb_model.predict(X_test)


gb_mae = mean_absolute_error(
    y_test,
    gb_predictions
)

gb_rmse = np.sqrt(
    mean_squared_error(
        y_test,
        gb_predictions
    )
)


# ============================================================
# 9. MODEL 3 - SEASONAL NAIVE BASELINE
# ============================================================

print("Calculating Seasonal Naive baseline...")

naive_predictions = test["Lag_7"]

naive_mae = mean_absolute_error(
    y_test,
    naive_predictions
)

naive_rmse = np.sqrt(
    mean_squared_error(
        y_test,
        naive_predictions
    )
)


# ============================================================
# 10. MODEL COMPARISON
# ============================================================

results = pd.DataFrame({

    "Model": [
        "7-Day Seasonal Naive",
        "Random Forest",
        "Gradient Boosting"
    ],

    "MAE": [
        naive_mae,
        rf_mae,
        gb_mae
    ],

    "RMSE": [
        naive_rmse,
        rf_rmse,
        gb_rmse
    ]

})

results = results.sort_values(
    "MAE"
).reset_index(drop=True)

print("\n==========================================")
print("             MODEL COMPARISON")
print("==========================================")

print(
    results.to_string(
        index=False
    )
)


# ============================================================
# 11. SELECT BEST MODEL
# ============================================================

best_model_name = results.iloc[0]["Model"]

print("\nBest model:")
print(best_model_name)


if best_model_name == "Random Forest":

    best_model = rf_model

elif best_model_name == "Gradient Boosting":

    best_model = gb_model

else:

    best_model = None


# ============================================================
# 12. TEST SET FORECAST TABLE
# ============================================================

test_results = test[
    [
        "Date",
        "Sales_Quantity"
    ]
].copy()

test_results["Seasonal_Naive"] = naive_predictions.values

test_results["Random_Forest"] = rf_predictions

test_results["Gradient_Boosting"] = gb_predictions

test_results = test_results.rename(
    columns={
        "Sales_Quantity": "Actual_Demand"
    }
)

print("\n==========================================")
print("          TEST FORECAST RESULTS")
print("==========================================")

print(
    test_results.tail(15).to_string(
        index=False
    )
)


# ============================================================
# 13. PREPARE DATA FOR FUTURE FORECAST
# ============================================================

print("\nPreparing next 7-day forecast...")


# Train final model using all historical data

FINAL_FEATURES = FEATURES

X_all = data[FINAL_FEATURES]

y_all = data["Sales_Quantity"]


if best_model_name == "Random Forest":

    final_model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )

    final_model.fit(
        X_all,
        y_all
    )


elif best_model_name == "Gradient Boosting":

    final_model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42
    )

    final_model.fit(
        X_all,
        y_all
    )


else:

    final_model = None


# ============================================================
# 14. RECURSIVE 7-DAY FORECAST
# ============================================================

history = data[
    [
        "Date",
        "Sales_Quantity"
    ]
].copy()

future_rows = []

last_date = history["Date"].max()


for i in range(1, 8):

    future_date = (
        last_date +
        pd.Timedelta(days=i)
    )

    demand_history = (
        history["Sales_Quantity"]
        .tolist()
    )

    lag_1 = demand_history[-1]

    lag_7 = demand_history[-7]

    lag_14 = demand_history[-14]

    lag_28 = demand_history[-28:]

    rolling_mean_7 = np.mean(
        demand_history[-7:]
    )

    rolling_mean_28 = np.mean(
        demand_history[-28:]
    )

    rolling_std_7 = np.std(
        demand_history[-7:],
        ddof=1
    )

    day_of_week = future_date.dayofweek

    month = future_date.month

    quarter = future_date.quarter

    week_of_year = (
        future_date.isocalendar().week
    )

    trend = len(history) + 1

    # For future unknown variables,
    # use recent historical averages.

    recent = data.tail(28)

    promotion = round(
        recent["Promotion_Flag"].mean()
    )

    discount = (
        recent["Discount_pct"].mean()
    )

    holiday = 0

    temperature = (
        recent["Temperature_C"].mean()
    )

    rainfall = (
        recent["Rainfall_mm"].mean()
    )

    competitor = round(
        recent[
            "Competitor_Promotion_Flag"
        ].mean()
    )

    future_features = pd.DataFrame([{

        "Lag_1": lag_1,

        "Lag_7": lag_7,

        "Lag_14": lag_14,

        "Lag_28": lag_28[-1],

        "Rolling_Mean_7":
            rolling_mean_7,

        "Rolling_Mean_28":
            rolling_mean_28,

        "Rolling_Std_7":
            rolling_std_7,

        "Promotion_Flag":
            promotion,

        "Discount_pct":
            discount,

        "Holiday_Flag":
            holiday,

        "Temperature_C":
            temperature,

        "Rainfall_mm":
            rainfall,

        "Competitor_Promotion_Flag":
            competitor,

        "Day_of_Week":
            day_of_week,

        "Month":
            month,

        "Quarter":
            quarter,

        "Week_of_Year":
            week_of_year,

        "Trend":
            trend

    }])


    if best_model_name == "7-Day Seasonal Naive":

        prediction = lag_7

    else:

        prediction = final_model.predict(
            future_features[FEATURES]
        )[0]


    prediction = max(
        0,
        round(prediction)
    )


    future_rows.append({

        "Date":
            future_date,

        "Forecast_Demand_Units":
            prediction,

        "Lag_7":
            lag_7,

        "Rolling_Mean_7":
            rolling_mean_7,

        "Rolling_Std_7":
            rolling_std_7

    })


    # Add predicted demand to history
    # for recursive forecasting

    history = pd.concat(
        [
            history,
            pd.DataFrame({
                "Date": [future_date],
                "Sales_Quantity": [prediction]
            })
        ],
        ignore_index=True
    )


future_forecast = pd.DataFrame(
    future_rows
)


# ============================================================
# 15. CALCULATE SAFETY STOCK
# ============================================================

# 95% service-level z-value

Z = 1.65

future_forecast[
    "Safety_Stock_Units"
] = np.ceil(
    Z *
    future_forecast[
        "Rolling_Std_7"
    ].fillna(0)
)


# ============================================================
# 16. INVENTORY POSITION
# ============================================================

latest_inventory = int(
    data.iloc[-1][
        "Ending_Inventory_Units"
    ]
)

print("\nCurrent inventory:")
print(latest_inventory)


# Total 7-day forecast

total_forecast = (
    future_forecast[
        "Forecast_Demand_Units"
    ].sum()
)


# Average safety stock

safety_stock = int(
    np.ceil(
        future_forecast[
            "Safety_Stock_Units"
        ].mean()
    )
)


# Recommended order

recommended_order = max(
    0,
    int(
        np.ceil(
            total_forecast
            + safety_stock
            - latest_inventory
        )
    )
)


future_forecast[
    "Current_Inventory_Units"
] = latest_inventory

future_forecast[
    "Recommended_Order_Units"
] = recommended_order


# ============================================================
# 17. DISPLAY FINAL FORECAST
# ============================================================

print("\n")
print("==========================================")
print("       7-DAY HYPERLOCAL FORECAST")
print("==========================================")

print(
    future_forecast[
        [
            "Date",
            "Forecast_Demand_Units",
            "Safety_Stock_Units"
        ]
    ].to_string(
        index=False
    )
)


print("\n==========================================")
print("        REPLENISHMENT RECOMMENDATION")
print("==========================================")

print(
    "SKU              :",
    SELECTED_SKU
)

print(
    "Locality         :",
    SELECTED_LOCALITY
)

print(
    "Current Inventory:",
    latest_inventory,
    "units"
)

print(
    "7-Day Forecast   :",
    int(total_forecast),
    "units"
)

print(
    "Safety Stock     :",
    safety_stock,
    "units"
)

print(
    "Recommended Order:",
    recommended_order,
    "units"
)


# ============================================================
# 18. SAVE FORECAST TO EXCEL
# ============================================================

output_file = (
    BASE_DIR /
    "ParleG_Hyperlocal_Forecast_Output.xlsx"
)

with pd.ExcelWriter(
    output_file,
    engine="openpyxl"
) as writer:

    data.to_excel(
        writer,
        sheet_name="Model_Data",
        index=False
    )

    results.to_excel(
        writer,
        sheet_name="Model_Comparison",
        index=False
    )

    test_results.to_excel(
        writer,
        sheet_name="Test_Forecast",
        index=False
    )

    future_forecast.to_excel(
        writer,
        sheet_name="7_Day_Forecast",
        index=False
    )


# ============================================================
# 19. GRAPH 1 - HISTORICAL DEMAND
# ============================================================

plt.figure(
    figsize=(14, 6)
)

plt.plot(
    data["Date"],
    data["Sales_Quantity"],
    label="Actual Demand"
)

plt.title(
    f"{SELECTED_SKU} - {SELECTED_LOCALITY} Historical Demand"
)

plt.xlabel("Date")

plt.ylabel("Sales Quantity (Units)")

plt.legend()

plt.grid(True)

plt.tight_layout()

plt.show()


# ============================================================
# 20. GRAPH 2 - ACTUAL VS MODEL FORECAST
# ============================================================

plt.figure(
    figsize=(14, 6)
)

plt.plot(
    test_results["Date"],
    test_results["Actual_Demand"],
    label="Actual"
)

plt.plot(
    test_results["Date"],
    test_results["Random_Forest"],
    label="Random Forest"
)

plt.plot(
    test_results["Date"],
    test_results["Gradient_Boosting"],
    label="Gradient Boosting"
)

plt.plot(
    test_results["Date"],
    test_results["Seasonal_Naive"],
    label="7-Day Seasonal Naive"
)

plt.title(
    "Actual vs Forecast Demand"
)

plt.xlabel("Date")

plt.ylabel("Units")

plt.legend()

plt.grid(True)

plt.tight_layout()

plt.show()


# ============================================================
# 21. GRAPH 3 - NEXT 7 DAYS
# ============================================================

plt.figure(
    figsize=(12, 6)
)

plt.bar(
    future_forecast["Date"].dt.strftime("%d-%b"),
    future_forecast[
        "Forecast_Demand_Units"
    ]
)

plt.title(
    f"Next 7 Days Forecast - {SELECTED_SKU} - {SELECTED_LOCALITY}"
)

plt.xlabel("Forecast Date")

plt.ylabel("Forecast Demand (Units)")

plt.xticks(rotation=45)

plt.tight_layout()

plt.show()


# ============================================================
# 22. FEATURE IMPORTANCE
# ============================================================

if best_model_name == "Random Forest":

    importance = final_model.feature_importances_

    feature_importance = pd.DataFrame({

        "Feature": FEATURES,

        "Importance": importance

    }).sort_values(
        "Importance",
        ascending=False
    )

    print("\n==========================================")
    print("          FEATURE IMPORTANCE")
    print("==========================================")

    print(
        feature_importance.to_string(
            index=False
        )
    )

    plt.figure(
        figsize=(10, 7)
    )

    plt.barh(
        feature_importance[
            "Feature"
        ].head(10)[::-1],

        feature_importance[
            "Importance"
        ].head(10)[::-1]
    )

    plt.title(
        "Top 10 Forecasting Features"
    )

    plt.xlabel(
        "Importance"
    )

    plt.tight_layout()

    plt.show()


# ============================================================
# 23. FINAL MESSAGE
# ============================================================

print("\n==========================================")
print("             COMPLETED")
print("==========================================")

print(
    "\nForecast Excel saved at:"
)

print(
    output_file
)

print(
    "\nOpen the generated Excel file to see:"
)

print(
    "1. Model comparison"
)

print(
    "2. Test forecasts"
)

print(
    "3. 7-day future forecast"
)

print(
    "4. Replenishment recommendation"
)

print(
    "\nHyperlocal forecasting completed successfully."
)

input("\nPress Enter to exit...")
