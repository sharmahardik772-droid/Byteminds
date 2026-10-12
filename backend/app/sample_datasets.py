import pandas as pd
import numpy as np
import os

# Real historical quarterly revenue data for Tata Consumer Products Ltd (TCPL)
# Values in INR Crores (Cr)
# FY runs April to March: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
TATA_CONSUMER_DATA = [
    # FY 2018-19 (Tata Global Beverages era)
    {"Quarter": "Q1 FY19", "Date": "2018-06-30", "Revenue_Cr": 1804.8, "India_Beverages": 982.1, "India_Foods": 0.0, "International_Beverages": 822.7, "EBITDA_Cr": 242.5},
    {"Quarter": "Q2 FY19", "Date": "2018-09-30", "Revenue_Cr": 1760.9, "India_Beverages": 951.3, "India_Foods": 0.0, "International_Beverages": 809.6, "EBITDA_Cr": 234.1},
    {"Quarter": "Q3 FY19", "Date": "2018-12-31", "Revenue_Cr": 1908.4, "India_Beverages": 1045.2, "India_Foods": 0.0, "International_Beverages": 863.2, "EBITDA_Cr": 258.9},
    {"Quarter": "Q4 FY19", "Date": "2019-03-31", "Revenue_Cr": 1775.5, "India_Beverages": 963.8, "India_Foods": 0.0, "International_Beverages": 811.7, "EBITDA_Cr": 229.4},
    
    # FY 2019-20 (Merger of Tata Chemicals Consumer Products business announced)
    {"Quarter": "Q1 FY20", "Date": "2019-06-30", "Revenue_Cr": 1897.1, "India_Beverages": 1032.4, "India_Foods": 0.0, "International_Beverages": 864.7, "EBITDA_Cr": 268.0},
    {"Quarter": "Q2 FY20", "Date": "2019-09-30", "Revenue_Cr": 1834.1, "India_Beverages": 998.6, "India_Foods": 0.0, "International_Beverages": 835.5, "EBITDA_Cr": 251.2},
    {"Quarter": "Q3 FY20", "Date": "2019-12-31", "Revenue_Cr": 1961.1, "India_Beverages": 1074.8, "India_Foods": 0.0, "International_Beverages": 886.3, "EBITDA_Cr": 279.8},
    {"Quarter": "Q4 FY20", "Date": "2020-03-31", "Revenue_Cr": 2405.0, "India_Beverages": 1012.3, "India_Foods": 532.0, "International_Beverages": 860.7, "EBITDA_Cr": 315.6},
    
    # FY 2020-21 (Full integration of Tata Salt, Tata Sampann; COVID pantry stocking)
    {"Quarter": "Q1 FY21", "Date": "2020-06-30", "Revenue_Cr": 2713.9, "India_Beverages": 1156.4, "India_Foods": 589.2, "International_Beverages": 968.3, "EBITDA_Cr": 482.7},
    {"Quarter": "Q2 FY21", "Date": "2020-09-30", "Revenue_Cr": 2781.3, "India_Beverages": 1218.7, "India_Foods": 612.4, "International_Beverages": 950.2, "EBITDA_Cr": 399.5},
    {"Quarter": "Q3 FY21", "Date": "2020-12-31", "Revenue_Cr": 3069.6, "India_Beverages": 1342.1, "India_Foods": 678.0, "International_Beverages": 1049.5, "EBITDA_Cr": 361.3},
    {"Quarter": "Q4 FY21", "Date": "2021-03-31", "Revenue_Cr": 3037.2, "India_Beverages": 1308.5, "India_Foods": 694.3, "International_Beverages": 1034.4, "EBITDA_Cr": 396.1},
    
    # FY 2021-22 (Post-pandemic baseline + commodity inflation management)
    {"Quarter": "Q1 FY22", "Date": "2021-06-30", "Revenue_Cr": 3008.5, "India_Beverages": 1275.2, "India_Foods": 710.8, "International_Beverages": 1022.5, "EBITDA_Cr": 399.6},
    {"Quarter": "Q2 FY22", "Date": "2021-09-30", "Revenue_Cr": 3033.1, "India_Beverages": 1290.4, "India_Foods": 743.5, "International_Beverages": 999.2, "EBITDA_Cr": 413.4},
    {"Quarter": "Q3 FY22", "Date": "2021-12-31", "Revenue_Cr": 3208.4, "India_Beverages": 1385.0, "India_Foods": 792.1, "International_Beverages": 1031.3, "EBITDA_Cr": 462.1},
    {"Quarter": "Q4 FY22", "Date": "2022-03-31", "Revenue_Cr": 3175.4, "India_Beverages": 1362.8, "India_Foods": 811.2, "International_Beverages": 1001.4, "EBITDA_Cr": 444.2},
    
    # FY 2022-23 (Tata Starbucks expansion, nourishco beverage scale-up)
    {"Quarter": "Q1 FY23", "Date": "2022-06-30", "Revenue_Cr": 3326.8, "India_Beverages": 1412.5, "India_Foods": 878.6, "International_Beverages": 1035.7, "EBITDA_Cr": 457.3},
    {"Quarter": "Q2 FY23", "Date": "2022-09-30", "Revenue_Cr": 3363.0, "India_Beverages": 1428.1, "India_Foods": 904.3, "International_Beverages": 1030.6, "EBITDA_Cr": 433.8},
    {"Quarter": "Q3 FY23", "Date": "2022-12-31", "Revenue_Cr": 3474.6, "India_Beverages": 1481.2, "India_Foods": 932.9, "International_Beverages": 1060.5, "EBITDA_Cr": 453.7},
    {"Quarter": "Q4 FY23", "Date": "2023-03-31", "Revenue_Cr": 3618.7, "India_Beverages": 1544.6, "India_Foods": 985.4, "International_Beverages": 1088.7, "EBITDA_Cr": 511.0},
    
    # FY 2023-24 (Capital Foods 'Ching's Secret' & Organic India acquisition announcements)
    {"Quarter": "Q1 FY24", "Date": "2023-06-30", "Revenue_Cr": 3741.2, "India_Beverages": 1599.3, "India_Foods": 1028.5, "International_Beverages": 1113.4, "EBITDA_Cr": 544.7},
    {"Quarter": "Q2 FY24", "Date": "2023-09-30", "Revenue_Cr": 3733.8, "India_Beverages": 1585.0, "India_Foods": 1045.2, "International_Beverages": 1103.6, "EBITDA_Cr": 537.4},
    {"Quarter": "Q3 FY24", "Date": "2023-12-31", "Revenue_Cr": 3803.9, "India_Beverages": 1622.4, "India_Foods": 1081.7, "International_Beverages": 1099.8, "EBITDA_Cr": 572.3},
    {"Quarter": "Q4 FY24", "Date": "2024-03-31", "Revenue_Cr": 3926.9, "India_Beverages": 1680.1, "India_Foods": 1123.6, "International_Beverages": 1123.2, "EBITDA_Cr": 631.0},
    
    # FY 2024-25 (Consolidation of Capital Foods and Organic India)
    {"Quarter": "Q1 FY25", "Date": "2024-06-30", "Revenue_Cr": 4352.1, "India_Beverages": 1782.3, "India_Foods": 1380.2, "International_Beverages": 1189.6, "EBITDA_Cr": 667.4},
    {"Quarter": "Q2 FY25", "Date": "2024-09-30", "Revenue_Cr": 4214.4, "India_Beverages": 1740.1, "India_Foods": 1335.5, "International_Beverages": 1138.8, "EBITDA_Cr": 628.9},
    {"Quarter": "Q3 FY25", "Date": "2024-12-31", "Revenue_Cr": 4420.8, "India_Beverages": 1825.4, "India_Foods": 1422.8, "International_Beverages": 1172.6, "EBITDA_Cr": 684.2},
    {"Quarter": "Q4 FY25", "Date": "2025-03-31", "Revenue_Cr": 4510.5, "India_Beverages": 1860.2, "India_Foods": 1461.1, "International_Beverages": 1189.2, "EBITDA_Cr": 709.8},
]

# Hindustan Unilever Ltd Quarterly Revenue (INR Cr)
HUL_DATA = [
    {"Quarter": "Q1 FY20", "Date": "2019-06-30", "Revenue_Cr": 10114.0, "EBITDA_Cr": 2647.0},
    {"Quarter": "Q2 FY20", "Date": "2019-09-30", "Revenue_Cr": 9931.0, "EBITDA_Cr": 2443.0},
    {"Quarter": "Q3 FY20", "Date": "2019-12-31", "Revenue_Cr": 10013.0, "EBITDA_Cr": 2545.0},
    {"Quarter": "Q4 FY20", "Date": "2020-03-31", "Revenue_Cr": 9211.0, "EBITDA_Cr": 2169.0},
    {"Quarter": "Q1 FY21", "Date": "2020-06-30", "Revenue_Cr": 10731.0, "EBITDA_Cr": 2744.0},
    {"Quarter": "Q2 FY21", "Date": "2020-09-30", "Revenue_Cr": 11682.0, "EBITDA_Cr": 2980.0},
    {"Quarter": "Q3 FY21", "Date": "2020-12-31", "Revenue_Cr": 12181.0, "EBITDA_Cr": 2954.0},
    {"Quarter": "Q4 FY21", "Date": "2021-03-31", "Revenue_Cr": 12433.0, "EBITDA_Cr": 3084.0},
    {"Quarter": "Q1 FY22", "Date": "2021-06-30", "Revenue_Cr": 12194.0, "EBITDA_Cr": 2948.0},
    {"Quarter": "Q2 FY22", "Date": "2021-09-30", "Revenue_Cr": 13046.0, "EBITDA_Cr": 3257.0},
    {"Quarter": "Q3 FY22", "Date": "2021-12-31", "Revenue_Cr": 13439.0, "EBITDA_Cr": 3525.0},
    {"Quarter": "Q4 FY22", "Date": "2022-03-31", "Revenue_Cr": 13767.0, "EBITDA_Cr": 3376.0},
    {"Quarter": "Q1 FY23", "Date": "2022-06-30", "Revenue_Cr": 14624.0, "EBITDA_Cr": 3402.0},
    {"Quarter": "Q2 FY23", "Date": "2022-09-30", "Revenue_Cr": 15144.0, "EBITDA_Cr": 3537.0},
    {"Quarter": "Q3 FY23", "Date": "2022-12-31", "Revenue_Cr": 15597.0, "EBITDA_Cr": 3694.0},
    {"Quarter": "Q4 FY23", "Date": "2023-03-31", "Revenue_Cr": 15215.0, "EBITDA_Cr": 3574.0},
    {"Quarter": "Q1 FY24", "Date": "2023-06-30", "Revenue_Cr": 15499.0, "EBITDA_Cr": 3665.0},
    {"Quarter": "Q2 FY24", "Date": "2023-09-30", "Revenue_Cr": 15623.0, "EBITDA_Cr": 3797.0},
    {"Quarter": "Q3 FY24", "Date": "2023-12-31", "Revenue_Cr": 15567.0, "EBITDA_Cr": 3666.0},
    {"Quarter": "Q4 FY24", "Date": "2024-03-31", "Revenue_Cr": 15210.0, "EBITDA_Cr": 3535.0},
    {"Quarter": "Q1 FY25", "Date": "2024-06-30", "Revenue_Cr": 15707.0, "EBITDA_Cr": 3740.0},
    {"Quarter": "Q2 FY25", "Date": "2024-09-30", "Revenue_Cr": 15926.0, "EBITDA_Cr": 3796.0},
    {"Quarter": "Q3 FY25", "Date": "2024-12-31", "Revenue_Cr": 16245.0, "EBITDA_Cr": 3912.0},
    {"Quarter": "Q4 FY25", "Date": "2025-03-31", "Revenue_Cr": 16580.0, "EBITDA_Cr": 4025.0},
]

# Titan Company Ltd Quarterly Financials (INR Cr)
TITAN_DATA = [
    {"Quarter": "Q1 FY20", "Date": "2019-06-30", "Revenue_Cr": 5151.0, "EBITDA_Cr": 578.0},
    {"Quarter": "Q2 FY20", "Date": "2019-09-30", "Revenue_Cr": 4658.0, "EBITDA_Cr": 521.0},
    {"Quarter": "Q3 FY20", "Date": "2019-12-31", "Revenue_Cr": 6527.0, "EBITDA_Cr": 765.0},
    {"Quarter": "Q4 FY20", "Date": "2020-03-31", "Revenue_Cr": 4753.0, "EBITDA_Cr": 604.0},
    {"Quarter": "Q1 FY21", "Date": "2020-06-30", "Revenue_Cr": 2020.0, "EBITDA_Cr": -246.0},
    {"Quarter": "Q2 FY21", "Date": "2020-09-30", "Revenue_Cr": 4553.0, "EBITDA_Cr": 483.0},
    {"Quarter": "Q3 FY21", "Date": "2020-12-31", "Revenue_Cr": 7619.0, "EBITDA_Cr": 870.0},
    {"Quarter": "Q4 FY21", "Date": "2021-03-31", "Revenue_Cr": 7492.0, "EBITDA_Cr": 817.0},
    {"Quarter": "Q1 FY22", "Date": "2021-06-30", "Revenue_Cr": 3473.0, "EBITDA_Cr": 144.0},
    {"Quarter": "Q2 FY22", "Date": "2021-09-30", "Revenue_Cr": 7493.0, "EBITDA_Cr": 968.0},
    {"Quarter": "Q3 FY22", "Date": "2021-12-31", "Revenue_Cr": 10037.0, "EBITDA_Cr": 1442.0},
    {"Quarter": "Q4 FY22", "Date": "2022-03-31", "Revenue_Cr": 7796.0, "EBITDA_Cr": 857.0},
    {"Quarter": "Q1 FY23", "Date": "2022-06-30", "Revenue_Cr": 9487.0, "EBITDA_Cr": 1196.0},
    {"Quarter": "Q2 FY23", "Date": "2022-09-30", "Revenue_Cr": 9163.0, "EBITDA_Cr": 1247.0},
    {"Quarter": "Q3 FY23", "Date": "2022-12-31", "Revenue_Cr": 11609.0, "EBITDA_Cr": 1330.0},
    {"Quarter": "Q4 FY23", "Date": "2023-03-31", "Revenue_Cr": 10360.0, "EBITDA_Cr": 1089.0},
    {"Quarter": "Q1 FY24", "Date": "2023-06-30", "Revenue_Cr": 11897.0, "EBITDA_Cr": 1101.0},
    {"Quarter": "Q2 FY24", "Date": "2023-09-30", "Revenue_Cr": 12529.0, "EBITDA_Cr": 1355.0},
    {"Quarter": "Q3 FY24", "Date": "2023-12-31", "Revenue_Cr": 14163.0, "EBITDA_Cr": 1568.0},
    {"Quarter": "Q4 FY24", "Date": "2024-03-31", "Revenue_Cr": 12494.0, "EBITDA_Cr": 1191.0},
    {"Quarter": "Q1 FY25", "Date": "2024-06-30", "Revenue_Cr": 13266.0, "EBITDA_Cr": 1202.0},
    {"Quarter": "Q2 FY25", "Date": "2024-09-30", "Revenue_Cr": 14534.0, "EBITDA_Cr": 1445.0},
    {"Quarter": "Q3 FY25", "Date": "2024-12-31", "Revenue_Cr": 16420.0, "EBITDA_Cr": 1780.0},
    {"Quarter": "Q4 FY25", "Date": "2025-03-31", "Revenue_Cr": 15100.0, "EBITDA_Cr": 1520.0},
]

def get_sample_catalogue():
    return [
        {
            "id": "parle_g_daily_sample",
            "name": "Parle-G Multi-SKU Hyperlocal Demand (Amritsar, Jalandhar & Ludhiana)",
            "industry": "FMCG Hyperlocal Demand & Replenishment",
            "frequency": "Daily",
            "periods": 365,
            "date_range": "Daily retail demand across 4 SKUs & 8 Localities",
            "description": "Multi-SKU daily FMCG retail demand dataset with 4 Pack Sizes (79g, 250g, 500g, 800g) across Amritsar, Jalandhar, and Ludhiana. Features: Date, SKU, Locality, Sales_Quantity, Inventory, Price, Discount, Promotion, Weather, Replenishment.",
            "recommended_target": "Sales_Quantity",
            "recommended_date": "Date",
            "sku": "Parle-G 250g",
            "locality": "Amritsar Central",
            "is_hyperlocal": True,
            "sheet_name": "ParleG_Daily_Data"
        },
        {
            "id": "parle_g_hyperlocal",
            "name": "Parle-G 250g Hyperlocal SKU Demand (Vadodara East)",
            "industry": "FMCG Hyperlocal Demand & Replenishment",
            "frequency": "Weekly",
            "periods": 104,
            "date_range": "Jan 2024 to Dec 2025 (104 Weeks)",
            "description": "Hyperlocal weekly retail dataset answering: 'How many units of Parle-G 250g should be stocked in Vadodara East next week?' Features: Date, SKU, Locality, Sales_Quantity, Inventory, Price, Promotion, Holiday.",
            "recommended_target": "Sales_Quantity",
            "recommended_date": "Date",
            "sku": "Parle-G 250g",
            "locality": "Vadodara East",
            "is_hyperlocal": True,
            "sheet_name": "Default"
        },
        {
            "id": "tata_consumer",
            "name": "Tata Consumer Products Ltd (Quarterly Revenue)",
            "industry": "Fast Moving Consumer Goods (FMCG)",
            "frequency": "Quarterly",
            "periods": len(TATA_CONSUMER_DATA),
            "date_range": f"{TATA_CONSUMER_DATA[0]['Quarter']} to {TATA_CONSUMER_DATA[-1]['Quarter']}",
            "description": "Historical quarterly financials in INR Crores for Tata Consumer Products (Tata Tea, Tetley, Tata Salt, Sampann, Capital Foods). Demonstrates strong festive Q3/Q4 seasonality and post-merger growth.",
            "recommended_target": "Revenue_Cr",
            "recommended_date": "Quarter",
            "is_hyperlocal": False,
            "sheet_name": "Quarterly_Financials"
        },
        {
            "id": "hul_fmcg",
            "name": "Hindustan Unilever Ltd (HUL) Quarterly Revenue",
            "industry": "FMCG / Personal Care & Foods",
            "frequency": "Quarterly",
            "periods": len(HUL_DATA),
            "date_range": f"{HUL_DATA[0]['Quarter']} to {HUL_DATA[-1]['Quarter']}",
            "description": "Historical quarterly revenue for India's largest FMCG titan (INR Cr). Consistent secular brand growth with seasonal variation.",
            "recommended_target": "Revenue_Cr",
            "recommended_date": "Quarter",
            "is_hyperlocal": False,
            "sheet_name": "Default"
        },
        {
            "id": "titan_retail",
            "name": "Titan Company Ltd (Quarterly Revenue)",
            "industry": "Consumer Retail / Jewellery & Watches",
            "frequency": "Quarterly",
            "periods": len(TITAN_DATA),
            "date_range": f"{TITAN_DATA[0]['Quarter']} to {TITAN_DATA[-1]['Quarter']}",
            "description": "Quarterly consumer retail figures with intense Diwali / festive Q3 surges, ideal for testing seasonal time-series models.",
            "recommended_target": "Revenue_Cr",
            "recommended_date": "Quarter",
            "is_hyperlocal": False,
            "sheet_name": "Default"
        }
    ]

def get_sample_df(sample_id: str) -> pd.DataFrame:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sample_dir = os.path.join(base_dir, "sample_data")

    if sample_id == "parle_g_daily_sample":
        excel_path = os.path.join(sample_dir, "ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx")
        if not os.path.exists(excel_path):
            excel_path = r"C:\Users\lenovo\Downloads\ByteMinds_ParleG_SKU_Hyperlocal_Forecasting_Sample.xlsx"
        if os.path.exists(excel_path):
            df = pd.read_excel(excel_path, sheet_name="ParleG_Daily_Data")
            df["Company"] = "Parle Products Pvt Ltd (Daily Hyperlocal)"
            return df
        # Fallback to CSV if xlsx not found
        csv_path = os.path.join(sample_dir, "ByteMinds_Hyperlocal_ParleG_Vadodara.csv")
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            df["Company"] = "Parle Products Pvt Ltd (Daily Hyperlocal)"
            return df
        return pd.DataFrame(TATA_CONSUMER_DATA)

    elif sample_id == "parle_g_hyperlocal":
        csv_path = os.path.join(sample_dir, "ByteMinds_Hyperlocal_ParleG_Vadodara.csv")
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            df["Company"] = "ByteMinds Hyperlocal: Parle-G (Vadodara East)"
            return df
        desktop_csv = r"c:\Users\lenovo\Desktop\ByteMinds_Hyperlocal_ParleG_Vadodara.csv"
        if os.path.exists(desktop_csv):
            df = pd.read_csv(desktop_csv)
            df["Company"] = "ByteMinds Hyperlocal: Parle-G (Vadodara East)"
            return df
        df = pd.DataFrame(TATA_CONSUMER_DATA)
        df["Company"] = "Tata Consumer Products Ltd"
        return df
    elif sample_id == "tata_consumer":
        df = pd.DataFrame(TATA_CONSUMER_DATA)
        df["Company"] = "Tata Consumer Products Ltd"
        return df
    elif sample_id == "hul_fmcg":
        df = pd.DataFrame(HUL_DATA)
        df["Company"] = "Hindustan Unilever Ltd"
        return df
    elif sample_id == "titan_retail":
        df = pd.DataFrame(TITAN_DATA)
        df["Company"] = "Titan Company Ltd"
        return df
    else:
        return get_sample_df("parle_g_daily_sample")


def generate_sample_files(target_dir: str):
    os.makedirs(target_dir, exist_ok=True)
    
    # 1. Tata Consumer CSV
    df_tata = get_sample_df("tata_consumer")
    tata_csv = os.path.join(target_dir, "Tata_Consumer_Products_Quarterly.csv")
    df_tata.to_csv(tata_csv, index=False)
    
    # 2. Tata Consumer Excel with multiple sheets
    tata_xlsx = os.path.join(target_dir, "Tata_Consumer_Products_Quarterly.xlsx")
    with pd.ExcelWriter(tata_xlsx, engine='openpyxl') as writer:
        df_tata.to_excel(writer, sheet_name="Quarterly_Financials", index=False)
        
        # Sheet 2: Segment Breakdown
        segment_df = df_tata[["Quarter", "India_Beverages", "India_Foods", "International_Beverages"]].copy()
        segment_df.to_excel(writer, sheet_name="Segment_Breakdown", index=False)
        
        # Sheet 3: Metadata
        meta_df = pd.DataFrame([
            {"Parameter": "Entity Name", "Value": "Tata Consumer Products Ltd"},
            {"Parameter": "Ticker", "Value": "NSE: TATACONSUM"},
            {"Parameter": "Currency", "Value": "INR Crores (Cr)"},
            {"Parameter": "Reporting Frequency", "Value": "Quarterly"},
            {"Parameter": "Fiscal Year Convention", "Value": "April 1 - March 31"},
            {"Parameter": "Prepared For", "Value": "ByteMinds Revenue Forecasting Studio"}
        ])
        meta_df.to_excel(writer, sheet_name="Metadata_Notes", index=False)
        
    # 3. HUL CSV
    df_hul = get_sample_df("hul_fmcg")
    hul_csv = os.path.join(target_dir, "HUL_Quarterly_Revenue.csv")
    df_hul.to_csv(hul_csv, index=False)
    
    # 4. Titan CSV
    df_titan = get_sample_df("titan_retail")
    titan_csv = os.path.join(target_dir, "Titan_Quarterly_Revenue.csv")
    df_titan.to_csv(titan_csv, index=False)
    
    return [tata_xlsx, tata_csv, hul_csv, titan_csv]

if __name__ == "__main__":
    import sys
    dest = sys.argv[1] if len(sys.argv) > 1 else "./sample_data"
    files = generate_sample_files(dest)
    print(f"Generated sample files in {dest}: {files}")
