from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class LoadSampleRequest(BaseModel):
    sample_id: str = "tata_consumer"

class InspectSheetRequest(BaseModel):
    file_id: str
    sheet_name: str

class ColumnMappingRequest(BaseModel):
    date_col: str
    target_col: str
    sku_col: Optional[str] = None
    locality_col: Optional[str] = None
    brand_col: Optional[str] = None
    pack_size_col: Optional[str] = None
    outlet_col: Optional[str] = None
    inventory_col: Optional[str] = None
    mode: str = "revenue"

class AuditRequest(BaseModel):
    file_id: Optional[str] = None
    sample_id: Optional[str] = None
    sheet_name: Optional[str] = None
    date_col: str
    revenue_col: str
    frequency: str = "Quarterly"

class PreparationOptions(BaseModel):
    remove_exact_duplicates: bool = True
    aggregation_method: str = "sum"  # "sum", "mean", "last"
    missing_revenue_strategy: str = "interpolate"  # "interpolate", "drop", "ffill"
    sort_chronological: bool = True
    entity_col: Optional[str] = None

class ForecastRequest(BaseModel):
    file_id: Optional[str] = None
    sample_id: Optional[str] = None
    sheet_name: Optional[str] = None
    date_col: str
    revenue_col: str
    frequency: str = "Quarterly"
    horizon: int = 4
    holdout_periods: Optional[int] = 4
    preparation: PreparationOptions = Field(default_factory=PreparationOptions)
    selected_model_id: Optional[str] = None

class ReplenishmentParams(BaseModel):
    lead_time_days: int = 3
    review_period_days: int = 7
    service_level: float = 0.95
    min_order_quantity: int = 0
    case_pack_size: int = 1
    existing_incoming_orders: float = 0.0
    current_inventory_override: Optional[float] = None

class HyperlocalForecastRequest(BaseModel):
    file_id: Optional[str] = None
    sample_id: Optional[str] = None
    sheet_name: Optional[str] = None
    date_col: str
    target_col: str = "Sales_Quantity"
    sku_col: Optional[str] = "SKU"
    locality_col: Optional[str] = "Locality"
    brand_col: Optional[str] = "Brand"
    pack_size_col: Optional[str] = "Pack_Size_g"
    outlet_col: Optional[str] = None
    inventory_col: Optional[str] = "Ending_Inventory_Units"
    price_col: Optional[str] = "Selling_Price_INR"
    promotion_col: Optional[str] = "Promotion_Flag"
    competitor_col: Optional[str] = "Competitor_Promotion_Flag"
    holiday_col: Optional[str] = "Holiday_Flag"
    temperature_col: Optional[str] = "Temperature_C"
    rainfall_col: Optional[str] = "Rainfall_mm"
    selected_sku: Optional[str] = None
    selected_locality: Optional[str] = None
    frequency: str = "daily"
    horizon: int = 7
    holdout_periods: Optional[int] = 28
    selected_model: Optional[str] = None
    replenishment: ReplenishmentParams = Field(default_factory=ReplenishmentParams)

class ExportForecastRequest(BaseModel):
    forecast_data: Dict[str, Any]
    company_name: Optional[str] = "Company"
    mode: str = "revenue"
