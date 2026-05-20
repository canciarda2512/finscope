from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.endpoints.prediction import router as prediction_router
from app.endpoints.anomaly import router as anomaly_router

app = FastAPI(title="FinScope AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prediction_router)
app.include_router(anomaly_router)


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
