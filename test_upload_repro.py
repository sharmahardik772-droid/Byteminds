import urllib.request
import json
import os

excel_path = r"c:\Users\lenovo\Desktop\Tata_Consumer_Products_Quarterly_Revenue.xlsx"

boundary = "----WebKitFormBoundaryRepro123"
with open(excel_path, "rb") as f:
    file_bytes = f.read()

part1 = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="Tata_Consumer_Products_Quarterly_Revenue.xlsx"\r\n'
    f"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"
).encode("utf-8")
part2 = f"\r\n--{boundary}--\r\n".encode("utf-8")
body = part1 + file_bytes + part2

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/upload",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
res = urllib.request.urlopen(req)
upload_data = json.loads(res.read().decode())
print("Upload Data:")
print("File ID:", upload_data.get("file_id"))
print("Active Sheet:", upload_data.get("active_sheet"))
print("Sheets:", upload_data.get("sheets"))
print("Column Detection:", upload_data.get("column_detection"))
print("Columns:", upload_data.get("columns"))

fc_payload = {
    "file_id": upload_data["file_id"],
    "sheet_name": upload_data["active_sheet"],
    "date_col": upload_data["column_detection"]["recommended_date"],
    "revenue_col": upload_data["column_detection"]["recommended_revenue"],
    "frequency": "Quarterly",
    "horizon": 4,
    "holdout_periods": 4,
    "preparation": {
        "remove_exact_duplicates": True,
        "aggregation_method": "sum",
        "missing_revenue_strategy": "interpolate",
        "sort_chronological": True
    }
}

req2 = urllib.request.Request(
    "http://127.0.0.1:8000/api/forecast",
    data=json.dumps(fc_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
try:
    res2 = urllib.request.urlopen(req2)
    print("Forecast Success:", res2.read().decode()[:200])
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode())
