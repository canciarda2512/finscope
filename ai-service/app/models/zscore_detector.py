import numpy as np
from app.config import ZSCORE_THRESHOLD, PRICE_GAP_PERCENT


BB_PERIOD = 20
BB_DEVIATIONS = 2
ROLLING_WINDOW = 50
RSI_PERIOD = 14
RSI_OVERBOUGHT = 80
RSI_OVERSOLD = 20
STREAK_THRESHOLD = 5
DIVERGENCE_WINDOW = 14


def detect_anomalies(times: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> list[dict]:

    anomalies = []

    # ── 1. Volume spike detection (rolling window Z-score) ──
    for i in range(ROLLING_WINDOW, len(volumes)):
        window = volumes[i - ROLLING_WINDOW:i]
        mean = window.mean()
        std = window.std()
        if std == 0:
            continue
        z = (volumes[i] - mean) / std
        if abs(z) > ZSCORE_THRESHOLD:
            anomalies.append({
                "time": int(times[i]),
                "type": "volume_spike",
                "severity": "HIGH" if abs(z) > ZSCORE_THRESHOLD * 1.5 else "MEDIUM",
                "details": f"Volume Z-score: {round(float(z), 2)} (rolling {ROLLING_WINDOW}-period)",
            })

    # ── 2. Price gap detection ──
    for i in range(1, len(closes)):
        prev_close = closes[i - 1]
        if prev_close == 0:
            continue
        pct_change = abs((closes[i] - prev_close) / prev_close) * 100
        if pct_change >= PRICE_GAP_PERCENT:
            direction = "up" if closes[i] > prev_close else "down"
            anomalies.append({
                "time": int(times[i]),
                "type": "price_gap",
                "severity": "HIGH" if pct_change >= PRICE_GAP_PERCENT * 2 else "MEDIUM",
                "details": f"Price gap {direction}: {round(pct_change, 2)}%",
            })

    # ── 3. Bollinger Band breakout detection ──
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

    # ── 4. RSI extremes ──
    if len(closes) > RSI_PERIOD:
        for i in range(RSI_PERIOD, len(closes)):
            window = closes[i - RSI_PERIOD:i + 1]
            deltas = np.diff(window)
            gains = np.maximum(deltas, 0).mean()
            losses = np.maximum(-deltas, 0).mean()
            rs = gains / (losses + 1e-9)
            rsi = 100 - (100 / (1 + rs))

            if rsi >= RSI_OVERBOUGHT:
                anomalies.append({
                    "time": int(times[i]),
                    "type": "rsi_overbought",
                    "severity": "HIGH" if rsi >= 90 else "MEDIUM",
                    "details": f"RSI: {round(rsi, 1)} (overbought > {RSI_OVERBOUGHT})",
                })
            elif rsi <= RSI_OVERSOLD:
                anomalies.append({
                    "time": int(times[i]),
                    "type": "rsi_oversold",
                    "severity": "HIGH" if rsi <= 10 else "MEDIUM",
                    "details": f"RSI: {round(rsi, 1)} (oversold < {RSI_OVERSOLD})",
                })

    # ── 5. Volume-price divergence ──
    if len(closes) > DIVERGENCE_WINDOW:
        for i in range(DIVERGENCE_WINDOW, len(closes)):
            price_change = (closes[i] - closes[i - DIVERGENCE_WINDOW]) / (closes[i - DIVERGENCE_WINDOW] + 1e-9)
            vol_change = (volumes[i] - volumes[i - DIVERGENCE_WINDOW]) / (volumes[i - DIVERGENCE_WINDOW] + 1e-9)

            # Price rising but volume falling significantly (bearish divergence)
            if price_change > 0.02 and vol_change < -0.3:
                anomalies.append({
                    "time": int(times[i]),
                    "type": "divergence_bearish",
                    "severity": "MEDIUM",
                    "details": f"Price +{round(price_change * 100, 1)}% but volume -{round(abs(vol_change) * 100, 1)}%",
                })
            # Price falling but volume falling significantly (bullish divergence)
            elif price_change < -0.02 and vol_change < -0.3:
                anomalies.append({
                    "time": int(times[i]),
                    "type": "divergence_bullish",
                    "severity": "MEDIUM",
                    "details": f"Price {round(price_change * 100, 1)}% but volume -{round(abs(vol_change) * 100, 1)}%",
                })

    # ── 6. Consecutive candle streaks (momentum exhaustion) ──
    if len(closes) > STREAK_THRESHOLD:
        streak = 0
        streak_dir = 0  # 1 = green, -1 = red
        for i in range(1, len(closes)):
            if closes[i] > closes[i - 1]:
                if streak_dir == 1:
                    streak += 1
                else:
                    streak = 1
                    streak_dir = 1
            elif closes[i] < closes[i - 1]:
                if streak_dir == -1:
                    streak += 1
                else:
                    streak = 1
                    streak_dir = -1
            else:
                streak = 0
                streak_dir = 0

            if streak >= STREAK_THRESHOLD:
                direction = "bullish" if streak_dir == 1 else "bearish"
                anomalies.append({
                    "time": int(times[i]),
                    "type": f"streak_{direction}",
                    "severity": "HIGH" if streak >= 7 else "MEDIUM",
                    "details": f"{streak} consecutive {direction} candles",
                })

    anomalies.sort(key=lambda a: a["time"])
    return anomalies
