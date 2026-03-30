from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import init_db
from routes import jobs, sources, alerts
from alerts import check_and_send_alerts

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    scheduler.add_job(sources._run_sync, "interval", minutes=30)
    scheduler.add_job(check_and_send_alerts, "interval", minutes=30)
    scheduler.start()
    print("✅ Scheduler started — syncing every 30 minutes")
    yield
    scheduler.shutdown()

app = FastAPI(title="Hive Jobs API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(sources.router, prefix="/api/sources", tags=["sources"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])

@app.get("/health")
def health():
    return {"status": "ok"}