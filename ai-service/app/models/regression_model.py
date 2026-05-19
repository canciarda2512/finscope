import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from app.config import PREDICTION_HORIZON


def _linear_predict(X: np.ndarray, closes: np.ndarray, vol_norm: np.ndarray, last_idx: int):
    features = np.column_stack([X.flatten(), vol_norm])
    model = LinearRegression()
    model.fit(features, closes)
    r2 = max(0.0, float(model.score(features, closes)))

    future_indices = np.arange(last_idx + 1, last_idx + 1 + PREDICTION_HORIZON)
    future_features = np.column_stack([future_indices, np.zeros(PREDICTION_HORIZON)])
    preds = model.predict(future_features)
    return preds, r2


def _poly_predict(X: np.ndarray, closes: np.ndarray, vol_norm: np.ndarray, last_idx: int, degree: int = 2):
    poly = PolynomialFeatures(degree=degree, include_bias=False)
    raw_features = np.column_stack([X.flatten(), vol_norm])
    features = poly.fit_transform(raw_features)

    model = LinearRegression()
    model.fit(features, closes)
    r2 = max(0.0, float(model.score(features, closes)))

    future_indices = np.arange(last_idx + 1, last_idx + 1 + PREDICTION_HORIZON)
    future_raw = np.column_stack([future_indices, np.zeros(PREDICTION_HORIZON)])
    future_features = poly.transform(future_raw)
    preds = model.predict(future_features)
    return preds, r2


def predict_trend(X: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> dict:
    vol_norm = (volumes - volumes.mean()) / (volumes.std() + 1e-9)
    last_idx = int(X[-1][0])

    lin_preds, lin_r2 = _linear_predict(X, closes, vol_norm, last_idx)
    poly_preds, poly_r2 = _poly_predict(X, closes, vol_norm, last_idx, degree=2)

    # Weighted ensemble — each model's contribution is proportional to its R²
    total_w = lin_r2 + poly_r2 + 1e-9
    ensemble_preds = (lin_r2 * lin_preds + poly_r2 * poly_preds) / total_w

    # Confidence = weighted average of both R² scores, expressed as a percentage
    confidence = max(0.0, min(round(((lin_r2 * lin_r2 + poly_r2 * poly_r2) / total_w) * 100, 2), 100.0))

    # Direction from first → last predicted value of the ensemble
    direction = "UP" if ensemble_preds[-1] > ensemble_preds[0] else "DOWN"

    return {
        "direction": direction,
        "confidence": confidence,
        "predictedValues": [round(float(v), 2) for v in ensemble_preds],
        "models": {
            "linear_r2": round(lin_r2, 4),
            "poly_r2": round(poly_r2, 4),
            "linear_values": [round(float(v), 2) for v in lin_preds],
            "poly_values": [round(float(v), 2) for v in poly_preds],
        },
    }
