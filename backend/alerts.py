import resend
import os
from dotenv import load_dotenv
from pathlib import Path
from database import get_pool

load_dotenv(override=True)

async def check_and_send_alerts():
    pool = await get_pool()
    async with pool.acquire() as conn:
        alerts = await conn.fetch("SELECT * FROM alerts")
        for alert in alerts:
            jobs = await conn.fetch("""
                SELECT * FROM jobs
                WHERE created_at > $1
                AND (
                    title ILIKE $2
                    OR company ILIKE $2
                )
                ORDER BY created_at DESC
                LIMIT 10
            """, alert["last_sent"], f"%{alert['keywords']}%")

            if jobs:
                await send_alert_email(alert["email"], alert["keywords"], [dict(j) for j in jobs])
                await conn.execute(
                    "UPDATE alerts SET last_sent = NOW() WHERE id = $1",
                    alert["id"]
                )

async def send_alert_email(email: str, keywords: str, jobs: list):
    key = os.getenv("RESEND_API_KEY")
    print(f"DEBUG RESEND KEY='{key}'")
    resend.api_key = key

    job_rows = ""
    for job in jobs:
        job_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>{job['title']}</strong><br>
                <span style="color: #666;">{job['company']} · {job['location'] or 'N/A'}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <a href="{job['apply_url']}" style="background: #1a1a1a; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">Apply</a>
            </td>
        </tr>
        """

    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🐝 New jobs for "{keywords}"</h2>
        <p style="color: #666;">We found {len(jobs)} new job(s) matching your alert.</p>
        <table style="width: 100%; border-collapse: collapse;">
            {job_rows}
        </table>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
            You're receiving this because you set up a job alert on Hive Jobs.
        </p>
    </div>
    """

    resend.Emails.send({
        "from": "Hive Jobs <onboarding@resend.dev>",
        "to": email,
        "subject": f"🐝 {len(jobs)} new jobs for \"{keywords}\"",
        "html": html
    })
    print(f"✅ Alert email sent to {email} for '{keywords}'")