import numpy as np
from sklearn.linear_model import LinearRegression
from app.config import PREDICTION_HORIZON


def predict_trend(X: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> dict:
    
    
    vol_norm = (volumes - volumes.mean()) / (volumes.std() + 1e-9)
    features = np.column_stack([X.flatten(), vol_norm])

    model = LinearRegression()
    model.fit(features, closes)

    r_squared = model.score(features, closes)
    confidence = max(0.0, min(round(float(r_squared) * 100, 2), 100.0))

    
    last_idx = int(X[-1][0])
    future_indices = np.arange(last_idx + 1, last_idx + 1 + PREDICTION_HORIZON)
    
    future_vol = np.zeros(PREDICTION_HORIZON)
    future_features = np.column_stack([future_indices, future_vol])

    predicted_values = model.predict(future_features).tolist()

    
    slope = float(model.coef_[0])
    direction = "UP" if slope > 0 else "DOWN"

    return {
        "direction": direction,
        "confidence": confidence,
        "predictedValues": [round(v, 2) for v in predicted_values],
    }
