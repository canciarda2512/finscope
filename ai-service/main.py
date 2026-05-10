from fastapi import FastAPI
from app.endpoints.prediction import router as prediction_router
from app.endpoints.anomaly import router as anomaly_router

app = FastAPI(title="FinScope AI Service", version="1.0.0")

app.include_router(prediction_router)
app.include_router(anomaly_router)


@app.get("/health")
def health():
    return {"status": "healthy"}
