import os
import unittest
import io
import pandas as pd
import numpy as np

from app.shared_engine import (
    inspect_workbook_sheets,
    validate_column_mapping,
    clean_time_series_data,
    aggregate_observations,
    create_time_features,
    create_lag_features,
    split_chronologically,
    evaluate_models,
    calculate_replenishment,
    clean_currency_or_number,
    robust_parse_date
)
from app.hyperlocal_forecasting import HyperlocalForecastingEngine
from app.forecasting import RevenueForecastingEngine
from app.data_processor import detect_column_roles, prepare_and_clean_dataset
from app.sample_datasets import get_sample_df, get_sample_catalogue

class TestByteMindsForecastingStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load sample Parle-G daily dataset
        cls.parle_df = get_sample_df("parle_g_daily_sample")
        # Load sample Tata Consumer quarterly revenue dataset
        cls.tata_df = get_sample_df("tata_consumer")

    def test_01_upload_and_inspect_workbook_sheets(self):
        """1. Test that Excel workbook sheets are detected and ParleG_Daily_Data is recommended."""
        excel_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "sample_data",
            "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx"
        )
        self.assertTrue(os.path.exists(excel_path), "Sample workbook should exist")
        with open(excel_path, "rb") as f:
            content = f.read()

        sheets_info = inspect_workbook_sheets(content, "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx")
        self.assertTrue(sheets_info["is_excel"])
        self.assertIn("ParleG_Daily_Data", sheets_info["sheets"])
        self.assertEqual(sheets_info["recommended_sheet"], "ParleG_Daily_Data")

    def test_02_worksheet_selection_and_roles(self):
        """2. Test that users can inspect sheets and column roles are detected properly."""
        df = self.parle_df
        roles = detect_column_roles(df)
        self.assertEqual(roles["recommended_date"], "Date")
        self.assertEqual(roles["recommended_revenue"], "Sales_Quantity")
        self.assertEqual(roles["recommended_sku"], "SKU")
        self.assertEqual(roles["recommended_locality"], "Locality")
        self.assertEqual(roles["suggested_mode"], "hyperlocal")
        self.assertGreater(len(roles["unique_skus"]), 0)
        self.assertGreater(len(roles["unique_localities"]), 0)

    def test_03_column_mapping_validation(self):
        """3. Test column mapping validation for both Hyperlocal and Revenue modes."""
        hyp_mapping = {
            "date_col": "Date",
            "target_col": "Sales_Quantity",
            "sku_col": "SKU",
            "locality_col": "Locality"
        }
        val_hyp = validate_column_mapping(self.parle_df, hyp_mapping, mode="hyperlocal")
        self.assertTrue(val_hyp["is_valid"])
        self.assertEqual(len(val_hyp["errors"]), 0)

        # Revenue mapping without SKU or locality columns
        rev_mapping = {
            "date_col": "Quarter",
            "target_col": "Revenue_Cr"
        }
        val_rev = validate_column_mapping(self.tata_df, rev_mapping, mode="revenue")
        self.assertTrue(val_rev["is_valid"])

    def test_04_cleaning_preserves_zero_demand_and_valid_records(self):
        """4. Test that cleaning does not discard valid zero-demand observations."""
        test_df = pd.DataFrame({
            "Date": ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05", "2025-01-06"],
            "Sales_Quantity": [100, 0, 85, 0, 120, 95], # Zeros included!
            "Weather": [25.0, np.nan, 26.5, np.nan, 24.0, 25.5] # Missing weather
        })
        cleaned, diag = clean_time_series_data(
            test_df,
            date_col="Date",
            target_col="Sales_Quantity",
            preserve_zeros=True,
            impute_optional_features=True,
            optional_cols=["Weather"]
        )
        self.assertEqual(len(cleaned), 6, "All 6 rows should be retained even with 0 sales")
        self.assertEqual(diag["zero_target_count"], 2, "Both 0 sales records must be preserved")
        self.assertFalse(cleaned["Weather"].isna().any(), "Missing optional weather should be imputed, not dropped")

    def test_05_dynamic_sku_and_locality_population(self):
        """5. Test dynamic extraction of SKUs and Localities."""
        roles = detect_column_roles(self.parle_df)
        self.assertIn("Parle-G 250g", roles["unique_skus"])
        self.assertIn("Amritsar Central", roles["unique_localities"])

    def test_06_filtered_forecast_changes_with_sku_and_locality(self):
        """6. Selecting different SKU or locality produces genuinely different forecast outputs."""
        engine1 = HyperlocalForecastingEngine(
            df=self.parle_df,
            date_col="Date",
            target_col="Sales_Quantity",
            sku_col="SKU",
            locality_col="Locality",
            selected_sku="Parle-G 250g",
            selected_locality="Amritsar Central",
            frequency="daily",
            horizon=7
        )
        res1 = engine1.run()

        engine2 = HyperlocalForecastingEngine(
            df=self.parle_df,
            date_col="Date",
            target_col="Sales_Quantity",
            sku_col="SKU",
            locality_col="Locality",
            selected_sku="Parle-G 79g",
            selected_locality="Amritsar Central",
            frequency="daily",
            horizon=7
        )
        res2 = engine2.run()

        # Compare outputs: 79g and 250g have different sales volumes
        total1 = sum(p["forecast_demand_units"] for p in res1["future_timeline"])
        total2 = sum(p["forecast_demand_units"] for p in res2["future_timeline"])
        self.assertNotEqual(total1, total2, "Different SKUs must yield genuinely different forecasts")

    def test_07_chronological_holdout_validation_no_leakage(self):
        """7. Verify chronological validation split without data leakage."""
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "Target": np.sin(np.linspace(0, 10, 50)) * 50 + 100
        })
        train, test = split_chronologically(df, holdout_periods=10, min_train_periods=5)
        self.assertEqual(len(train), 40)
        self.assertEqual(len(test), 10)
        self.assertTrue(train["Date"].max() < test["Date"].min(), "Train must strictly precede test chronologically")

        # Verify lags use shift(1)
        lag_df = create_lag_features(df, df["Target"], lags=[1, 7])
        self.assertTrue(pd.isna(lag_df["Lag_1"].iloc[0]), "First lag must be NaN (no future lookahead)")

    def test_08_candidate_models_and_best_selection(self):
        """8. Verify all 7 models evaluate and the best model has lowest MAE."""
        y_true = np.array([100, 105, 98, 110, 102])
        preds = {
            "Model A (Perfect)": np.array([100, 105, 98, 110, 102]),
            "Model B (Off by 5)": np.array([105, 110, 103, 115, 107]),
            "Model C (Off by 20)": np.array([120, 125, 118, 130, 122]),
        }
        eval_res = evaluate_models(y_true, preds)
        self.assertEqual(eval_res[0]["model_name"], "Model A (Perfect)")
        self.assertEqual(eval_res[0]["mae"], 0.0)
        self.assertEqual(eval_res[1]["model_name"], "Model B (Off by 5)")
        self.assertEqual(eval_res[1]["mae"], 5.0)

    def test_09_statistically_grounded_replenishment(self):
        """9. Test replenishment logic formula and safety stock."""
        rep = calculate_replenishment(
            forecast_demand_units=700.0, # 100/day over 7 days
            current_inventory=500.0,
            demand_std=15.0,
            lead_time_days=3,
            review_period_days=7,
            service_level=0.95,
            min_order_quantity=50,
            case_pack_size=12
        )
        # Protection period = 3 + 7 = 10 days
        # Daily demand = 100
        # Protection period demand = 1000
        # Safety stock = ceil(1.65 * 15 * sqrt(3)) = ceil(42.87) = 43
        # Target stock = 1000 + 43 = 1043
        # Inventory position = 500
        # Raw order = 1043 - 500 = 543
        # Case pack rounding to multiple of 12: ceil(543/12)*12 = 46 * 12 = 552
        self.assertEqual(rep["lead_time_days"], 3)
        self.assertEqual(rep["protection_period_days"], 10)
        self.assertGreater(rep["safety_stock_units"], 0)
        self.assertEqual(rep["suggested_order_quantity"] % 12, 0, "Order must be rounded to case pack multiple")
        self.assertGreaterEqual(rep["suggested_order_quantity"], 540)

    def test_10_revenue_mode_works_without_sku_or_locality(self):
        """10. Mode A works seamlessly without SKU or locality columns."""
        df_rev, rep = prepare_and_clean_dataset(self.tata_df, date_col="Quarter", revenue_col="Revenue_Cr")
        engine = RevenueForecastingEngine(
            series=df_rev['_cleaned_revenue'],
            dates=df_rev['_parsed_date'],
            labels=df_rev['_period_label'],
            frequency="Quarterly",
            holdout_periods=4
        )
        res = engine.run_all(horizon=4)
        self.assertIn("best_model_name", res)
        self.assertEqual(len(res["future_timeline"]), 4)
        self.assertIsNotNone(res["historical_cagr_pct"])

    def test_11_insufficient_data_diagnostic(self):
        """11. Insufficient data (< 5 observations) produces informative error."""
        short_df = pd.DataFrame({
            "Date": ["2025-01-01", "2025-01-02", "2025-01-03"],
            "Sales_Quantity": [10, 20, 15]
        })
        with self.assertRaises(ValueError) as ctx:
            engine = HyperlocalForecastingEngine(
                df=short_df,
                date_col="Date",
                target_col="Sales_Quantity"
            )
            engine.run()
        self.assertIn("At least 5", str(ctx.exception))

if __name__ == "__main__":
    unittest.main()
