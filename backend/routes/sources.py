from fastapi import APIRouter, BackgroundTasks
from database import get_pool
from dedup import make_hash
from search import index_jobs_bulk
import httpx
import asyncpg

router = APIRouter()

# ─── Greenhouse ──────────────────────────────────────────────────────────────

async def fetch_greenhouse(company_slug: str) -> list[dict]:
    """
    Greenhouse has a completely public API — no auth needed.
    Example: https://boards-api.greenhouse.io/v1/boards/shopify/jobs
    """
    url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs?content=true"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for j in data.get("jobs", []):
        location = j.get("location", {}).get("name", "")
        jobs.append({
            "title":      j["title"],
            "company":    company_slug.title(),
            "location":   location,
            "source":     "greenhouse",
            "apply_url":  j.get("absolute_url", ""),
            "remote":     "remote" in location.lower(),
            "level":      _infer_level(j["title"]),
            "tags":       [],
            "salary_raw": None,
            "salary_min": None,
            "salary_max": None,
        })
    return jobs

# ─── Lever ───────────────────────────────────────────────────────────────────

async def fetch_lever(company_slug: str) -> list[dict]:
    """
    Lever also has a public postings API — no auth needed.
    Example: https://api.lever.co/v0/postings/vercel
    """
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for j in data:
        location = j.get("categories", {}).get("location", "")
        jobs.append({
            "title":      j["text"],
            "company":    company_slug.title(),
            "location":   location,
            "source":     "lever",
            "apply_url":  j.get("hostedUrl", ""),
            "remote":     "remote" in location.lower(),
            "level":      _infer_level(j["text"]),
            "tags":       _extract_tags(j.get("descriptionPlain", "")),
            "salary_raw": None,
            "salary_min": None,
            "salary_max": None,
        })
    return jobs

# ─── Ingest endpoint ─────────────────────────────────────────────────────────

GREENHOUSE_COMPANIES = [
    "figma",
    "doordashusa",
    "dropbox",
    "gemini",
    "airbnb",
    "coinbase",
    "brex",
    "robinhood",
    "asana",
    "intercom",
    "datadog",
    "mongodb",
]
LEVER_COMPANIES = [
    "netflix",
    "reddit",
    "duolingo",
    "canva",
    "notion",
    "scale-ai",
    "openai",
    "anthropic",
]

async def _ingest(jobs: list[dict]):
    pool = await get_pool()
    inserted = []
    async with pool.acquire() as conn:
        for job in jobs:
            h = make_hash(job["title"], job["company"], job.get("location") or "")
            try:
                row = await conn.fetchrow("""
                    INSERT INTO jobs
                        (title, company, location, salary_min, salary_max, salary_raw,
                         source, apply_url, remote, level, tags, hash)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    RETURNING *
                """, job["title"], job["company"], job.get("location"),
                    job.get("salary_min"), job.get("salary_max"), job.get("salary_raw"),
                    job["source"], job.get("apply_url"), job.get("remote", False),
                    job.get("level"), job.get("tags", []), h)
                d = dict(row)
                d["tags"] = list(d["tags"] or [])
                inserted.append(d)
            except asyncpg.UniqueViolationError:
                pass
    if inserted:
        index_jobs_bulk(inserted)
    return len(inserted)

@router.post("/sync")
async def sync_all_sources(background_tasks: BackgroundTasks):
    """Kick off a background sync from Greenhouse + Lever."""
    background_tasks.add_task(_run_sync)
    return {"message": "Sync started in background"}

async def _run_sync():
    all_jobs = []
    for slug in GREENHOUSE_COMPANIES:
        try:
            jobs = await fetch_greenhouse(slug)
            all_jobs.extend(jobs)
            print(f"✅ Greenhouse {slug}: {len(jobs)} jobs fetched")
        except Exception as e:
            print(f"❌ Greenhouse {slug} failed: {e}")

    for slug in LEVER_COMPANIES:
        try:
            jobs = await fetch_lever(slug)
            all_jobs.extend(jobs)
            print(f"✅ Lever {slug}: {len(jobs)} jobs fetched")
        except Exception as e:
            print(f"❌ Lever {slug} failed: {e}")

    try:
        jobs = await fetch_remotive()
        all_jobs.extend(jobs)
        print(f"✅ Remotive: {len(jobs)} jobs fetched")
    except Exception as e:
        print(f"❌ Remotive failed: {e}")

    count = await _ingest(all_jobs)
    print(f"✅ Sync complete — {count} new jobs inserted")

@router.post("/sync/greenhouse/{slug}")
async def sync_greenhouse(slug: str):
    jobs = await fetch_greenhouse(slug)
    count = await _ingest(jobs)
    return {"source": "greenhouse", "company": slug, "inserted": count}

@router.post("/sync/lever/{slug}")
async def sync_lever(slug: str):
    jobs = await fetch_lever(slug)
    count = await _ingest(jobs)
    return {"source": "lever", "company": slug, "inserted": count}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _infer_level(title: str) -> str:
    t = title.lower()
    if any(w in t for w in ["senior", "sr.", "staff", "principal", "lead"]):
        return "Senior"
    if any(w in t for w in ["junior", "jr.", "entry", "associate", "intern"]):
        return "Junior"
    return "Mid"

TECH_KEYWORDS = [
    "python","javascript","typescript","react","node","go","rust","java","ruby",
    "aws","gcp","azure","kubernetes","docker","postgresql","redis","graphql",
    "pytorch","tensorflow","fastapi","django","rails"
]

def _extract_tags(text: str) -> list[str]:
    t = text.lower()
    return [kw.title() for kw in TECH_KEYWORDS if kw in t][:6]

async def fetch_remotive() -> list[dict]:
    url = "https://remotive.com/api/remote-jobs?limit=100"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for job in data.get("jobs", []):
        jobs.append({
            "title":      job.get("title", ""),
            "company":    job.get("company_name", ""),
            "location":   "Remote",
            "remote":     True,
            "source":     "remotive",
            "apply_url":  job.get("url", ""),
            "level":      _infer_level(job.get("title", "")),
            "tags":       [t.strip() for t in job.get("tags", [])][:6],
            "salary_raw": job.get("salary", ""),
            "salary_min": None,
            "salary_max": None,
        })
    return jobs
