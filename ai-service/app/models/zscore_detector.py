import numpy as np
from app.config import ZSCORE_THRESHOLD, PRICE_GAP_PERCENT


BB_PERIOD = 20
BB_DEVIATIONS = 2


def detect_anomalies(times: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> list[dict]:

    anomalies = []

    # ── Volume spike detection ──
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

    # ── Price gap detection ──
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

    # ── Bollinger Band breakout detection ──
    if len(closes) >= BB_PERIOD:
        for i in range(BB_PERIOD - 1, len(closes)):
            window = closes[i - BB_PERIOD + 1 : i + 1]
            mean = window.mean()
            std = window.std()
            if std == 0:
                continue
            upper = mean + BB_DEVIATIONS * std
            lower = mean - BB_DEVIATIONS * std
            price = closes[i]

            if price > upper:
                pct_above = round(((price - upper) / upper) * 100, 2)
                anomalies.append({
                    "time": int(times[i]),
                    "type": "bb_breakout_upper",
                    "severity": "HIGH" if pct_above > 1.5 else "MEDIUM",
                    "details": f"Price {pct_above}% above upper BB ({round(float(upper), 2)})",
                })
            elif price < lower:
                pct_below = round(((lower - price) / lower) * 100, 2)
                anomalies.append({
                    "time": int(times[i]),
                    "type": "bb_breakout_lower",
                    "severity": "HIGH" if pct_below > 1.5 else "MEDIUM",
                    "details": f"Price {pct_below}% below lower BB ({round(float(lower), 2)})",
                })

    anomalies.sort(key=lambda a: a["time"])
    return anomalies
