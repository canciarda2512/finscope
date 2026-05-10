from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.processing.data_validator import validate_anomaly_data
from app.processing.data_preprocessor import extract_anomaly_features
from app.models.zscore_detector import detect_anomalies
from app.processing.response_builder import build_anomaly_response

router = APIRouter()


class Candle(BaseModel):
    time: int | float
    open: float
    high: float
    low: float
    close: float
    volume: float


class AnomalyRequest(BaseModel):
    symbol: str
    timeframe: str = "1D"
    candles: list[Candle]


@router.post("/detect-anomalies")
def detect(req: AnomalyRequest):
    candles = [c.model_dump() for c in req.candles]

    error = validate_anomaly_data(candles)
    if error:
        raise HTTPException(status_code=422, detail=error)

    times, closes, volumes = extract_anomaly_features(candles)
    anomalies = detect_anomalies(times, closes, volumes)
    return build_anomaly_response(anomalies, req.symbol, req.timeframe)
