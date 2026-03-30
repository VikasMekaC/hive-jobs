from fastapi import APIRouter
from database import get_pool
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class AlertCreate(BaseModel):
    email: str
    keywords: str
    location: Optional[str] = None
    frequency: str = "daily"

@router.post("/", status_code=201)
async def create_alert(alert: AlertCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO alerts (email, keywords, location, frequency)
            VALUES ($1, $2, $3, $4)
        """, alert.email, alert.keywords, alert.location, alert.frequency)
    return {"message": "Alert created"}

@router.get("/")
async def get_alerts():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM alerts ORDER BY created_at DESC")
    return [dict(r) for r in rows]

@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM alerts WHERE id = $1", alert_id)

@router.post("/test-email")
async def test_email():
    from alerts import check_and_send_alerts
    await check_and_send_alerts()
    return {"message": "Alert check complete"}