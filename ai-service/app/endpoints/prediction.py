from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.processing.data_validator import validate_prediction_data
from app.processing.data_preprocessor import extract_prediction_features
from app.models.regression_model import predict_trend
from app.processing.response_builder import build_prediction_response

router = APIRouter()


class Candle(BaseModel):
    time: int | float
    open: float
    high: float
    low: float
    close: float
    volume: float


class PredictRequest(BaseModel):
    symbol: str
    timeframe: str = "1D"
    candles: list[Candle]


@router.post("/predict")
def predict(req: PredictRequest):
    candles = [c.model_dump() for c in req.candles]

    error = validate_prediction_data(candles)
    if error:
        raise HTTPException(status_code=422, detail=error)

    X, closes, volumes = extract_prediction_features(candles)
    result = predict_trend(X, closes, volumes)
    return build_prediction_response(result, req.symbol, req.timeframe)

