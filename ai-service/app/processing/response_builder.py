def build_prediction_response(result: dict, symbol: str, timeframe: str) -> dict:
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": result["direction"],
        "confidence": result["confidence"],
        "predictedValues": result["predictedValues"],
        "models": result.get("models", {}),
    }


def build_anomaly_response(anomalies: list[dict], symbol: str, timeframe: str) -> dict:
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "anomalies": anomalies,
    }
