import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from app.config import PREDICTION_HORIZON


def _compute_features(closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    """Build a rich feature matrix from price and volume data."""
    n = len(closes)
    X_idx = np.arange(n, dtype=np.float64)

    # Price returns (% change)
    returns = np.zeros(n)
    returns[1:] = (closes[1:] - closes[:-1]) / (closes[:-1] + 1e-9)

    # Normalized volume
    vol_norm = (volumes - volumes.mean()) / (volumes.std() + 1e-9)

    # Simple Moving Average ratios (price / SMA)
    def sma_ratio(period):
        ratio = np.ones(n)
        for i in range(period, n):
            sma = closes[i - period:i].mean()
            ratio[i] = closes[i] / (sma + 1e-9)
        return ratio

    sma7_ratio = sma_ratio(7)
    sma20_ratio = sma_ratio(20)

    # RSI (14-period)
    rsi = np.full(n, 50.0)
    for i in range(14, n):
        window = closes[i - 14:i + 1]
        deltas = np.diff(window)
        gains = np.maximum(deltas, 0).mean()
        losses = np.maximum(-deltas, 0).mean()
        rs = gains / (losses + 1e-9)
        rsi[i] = 100 - (100 / (1 + rs))

    # Momentum (rate of change over 10 periods)
    momentum = np.zeros(n)
    for i in range(10, n):
        momentum[i] = (closes[i] - closes[i - 10]) / (closes[i - 10] + 1e-9)

    # Volatility (rolling 14-period std of returns)
    volatility = np.zeros(n)
    for i in range(14, n):
        volatility[i] = returns[i - 14:i].std()

    features = np.column_stack([
        X_idx,
        returns,
        vol_norm,
        sma7_ratio,
        sma20_ratio,
        rsi / 100.0,  # normalize to 0-1
        momentum,
        volatility,
    ])

    return features


def _linear_predict(features: np.ndarray, closes: np.ndarray, last_idx: int, last_features: np.ndarray):
    model = LinearRegression()
    model.fit(features, closes)
    r2 = max(0.0, float(model.score(features, closes)))

    future = _build_future_features(last_idx, last_features)
    preds = model.predict(future)
    return preds, r2


def _poly_predict(features: np.ndarray, closes: np.ndarray, last_idx: int, last_features: np.ndarray, degree: int = 2):
    poly = PolynomialFeatures(degree=degree, include_bias=False)
    poly_features = poly.fit_transform(features)

    model = LinearRegression()
    model.fit(poly_features, closes)
    r2 = max(0.0, float(model.score(poly_features, closes)))

    future = poly.transform(_build_future_features(last_idx, last_features))
    preds = model.predict(future)
    return preds, r2


def _rf_predict(features: np.ndarray, closes: np.ndarray, last_idx: int, last_features: np.ndarray):
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    model.fit(features, closes)

    # Cross-validated R² for honest scoring
    cv_scores = cross_val_score(model, features, closes, cv=min(5, len(closes) // 10 or 2), scoring='r2')
    r2 = max(0.0, float(cv_scores.mean()))

    future = _build_future_features(last_idx, last_features)
    preds = model.predict(future)
    return preds, r2


def _build_future_features(last_idx: int, last_features: np.ndarray) -> np.ndarray:
    """Project features forward for PREDICTION_HORIZON steps using the last known values."""
    future_rows = []
    for i in range(1, PREDICTION_HORIZON + 1):
        row = last_features.copy()
        row[0] = last_idx + i  # index feature
        future_rows.append(row)
    return np.array(future_rows)


def predict_trend(X: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> dict:
    features = _compute_features(closes, volumes)
    last_idx = int(X[-1][0])
    last_features = features[-1]

    lin_preds, lin_r2 = _linear_predict(features, closes, last_idx, last_features)
    poly_preds, poly_r2 = _poly_predict(features, closes, last_idx, last_features, degree=2)
    rf_preds, rf_r2 = _rf_predict(features, closes, last_idx, last_features)

    # Weighted ensemble — each model contributes proportional to its R²
    weights = np.array([lin_r2, poly_r2, rf_r2])
    total_w = weights.sum() + 1e-9
    ensemble_preds = (lin_r2 * lin_preds + poly_r2 * poly_preds + rf_r2 * rf_preds) / total_w

    # Confidence = weighted average R², capped at 100
    confidence = max(0.0, min(round(float((weights ** 2).sum() / total_w) * 100, 2), 100.0))

    # Direction from ensemble trend
    direction = "UP" if ensemble_preds[-1] > closes[-1] else "DOWN"

    return {
        "direction": direction,
        "confidence": confidence,
        "predictedValues": [round(float(v), 2) for v in ensemble_preds],
        "models": {
            "linear_r2": round(lin_r2, 4),
            "poly_r2": round(poly_r2, 4),
            "rf_r2": round(rf_r2, 4),
            "linear_values": [round(float(v), 2) for v in lin_preds],
            "poly_values": [round(float(v), 2) for v in poly_preds],
            "rf_values": [round(float(v), 2) for v in rf_preds],
        },
    }
