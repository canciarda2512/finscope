import numpy as np


def extract_prediction_features(candles: list[dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    
    closes = np.array([c["close"] for c in candles], dtype=np.float64)
    volumes = np.array([c["volume"] for c in candles], dtype=np.float64)
    X = np.arange(len(closes)).reshape(-1, 1)
    return X, closes, volumes


def extract_anomaly_features(candles: list[dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    
    times = np.array([c["time"] for c in candles], dtype=np.int64)
    closes = np.array([c["close"] for c in candles], dtype=np.float64)
    volumes = np.array([c["volume"] for c in candles], dtype=np.float64)
    return times, closes, volumes
