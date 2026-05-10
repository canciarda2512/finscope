import numpy as np
from app.config import ZSCORE_THRESHOLD, PRICE_GAP_PERCENT


def detect_anomalies(times: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> list[dict]:
    
    anomalies = []

    vol_mean = volumes.mean()
    vol_std = volumes.std()
    if vol_std > 0:
        z_scores = (volumes - vol_mean) / vol_std
        for i, z in enumerate(z_scores):
            if abs(z) > ZSCORE_THRESHOLD:
                anomalies.append({
                    "time": int(times[i]),
                    "type": "volume_spike",
                    "severity": "HIGH" if abs(z) > ZSCORE_THRESHOLD * 1.5 else "MEDIUM",
                    "details": f"Volume Z-score: {round(float(z), 2)}",
                })

    for i in range(1, len(closes)):
        prev_close = closes[i - 1]
        if prev_close == 0:
            continue
        pct_change = abs((closes[i] - prev_close) / prev_close) * 100
        if pct_change >= PRICE_GAP_PERCENT:
            anomalies.append({
                "time": int(times[i]),
                "type": "price_gap",
                "severity": "HIGH" if pct_change >= PRICE_GAP_PERCENT * 2 else "MEDIUM",
                "details": f"Price gap: {round(pct_change, 2)}%",
            })

    anomalies.sort(key=lambda a: a["time"])
    return anomalies
