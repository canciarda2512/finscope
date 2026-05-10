from app.config import MIN_CANDLES_PREDICT, MIN_CANDLES_ANOMALY


def validate_prediction_data(candles: list[dict]) -> str | None:
    
    if not candles:
        return "No candle data provided."
    if len(candles) < MIN_CANDLES_PREDICT:
        return f"At least {MIN_CANDLES_PREDICT} candles required for prediction (received {len(candles)})."
    return None


def validate_anomaly_data(candles: list[dict]) -> str | None:
    """Returns an error message if data is insufficient, else None."""
    if not candles:
        return "No candle data provided."
    if len(candles) < MIN_CANDLES_ANOMALY:
        return f"At least {MIN_CANDLES_ANOMALY} candles required for anomaly detection (received {len(candles)})."
    return None
