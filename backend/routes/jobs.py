from fastapi import APIRouter, HTTPException, Query, Depends
from database import get_pool
from models import JobCreate, JobOut, SearchParams
from dedup import make_hash
from search import search_jobs, index_job, index_jobs_bulk, delete_job
from typing import Optional
import asyncpg

router = APIRouter()

# ─── Search (Meilisearch) ────────────────────────────────────────────────────

@router.get("/search")
async def search(
    q:       str  = Query(""),
    source:  Optional[str]  = Query(None),
    remote:  Optional[bool] = Query(None),
    level:   Optional[str]  = Query(None),
    min_sal: Optional[int]  = Query(None),
    sort_by: str  = Query("date_posted"),
    order:   str  = Query("desc"),
    page:    int  = Query(1, ge=1),
    limit:   int  = Query(20, le=100),
):
    filters = []
    if source:  filters.append(f"source = {source}")
    if remote is not None: filters.append(f"remote = {str(remote).lower()}")
    if level:   filters.append(f"level = {level}")
    if min_sal: filters.append(f"salary_min >= {min_sal}")

    sort = [f"{sort_by}:{order}"]
    offset = (page - 1) * limit

    results = search_jobs(
        query=q,
        filters=filters if filters else None,
        sort=sort,
        offset=offset,
        limit=limit,
    )
    return {
        "hits":        results["hits"],
        "total":       results.get("estimatedTotalHits", 0),
        "page":        page,
        "limit":       limit,
    }

# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=dict, status_code=201)
async def create_job(job: JobCreate):
    pool = await get_pool()
    h = make_hash(job.title, job.company, job.location or "")

    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("""
                INSERT INTO jobs
                    (title, company, location, salary_min, salary_max, salary_raw,
                     source, apply_url, remote, level, tags, hash)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING *
            """, job.title, job.company, job.location,
                job.salary_min, job.salary_max, job.salary_raw,
                job.source, job.apply_url, job.remote, job.level,
                job.tags, h)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Duplicate job listing")

    job_dict = dict(row)
    job_dict["tags"] = list(job_dict["tags"] or [])
    index_job(job_dict)
    return {"id": job_dict["id"], "hash": h}

@router.post("/bulk", status_code=201)
async def bulk_create(jobs: list[JobCreate]):
    pool = await get_pool()
    inserted, skipped = [], 0

    async with pool.acquire() as conn:
        for job in jobs:
            h = make_hash(job.title, job.company, job.location or "")
            try:
                row = await conn.fetchrow("""
                    INSERT INTO jobs
                        (title, company, location, salary_min, salary_max, salary_raw,
                         source, apply_url, remote, level, tags, hash)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    RETURNING *
                """, job.title, job.company, job.location,
                    job.salary_min, job.salary_max, job.salary_raw,
                    job.source, job.apply_url, job.remote, job.level,
                    job.tags, h)
                d = dict(row)
                d["tags"] = list(d["tags"] or [])
                inserted.append(d)
            except asyncpg.UniqueViolationError:
                skipped += 1

    if inserted:
        index_jobs_bulk(inserted)

    return {"inserted": len(inserted), "skipped": skipped}

@router.get("/{job_id}")
async def get_job(job_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM jobs WHERE id = $1", job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return dict(row)

@router.delete("/{job_id}", status_code=204)
async def delete_job_endpoint(job_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM jobs WHERE id = $1", job_id)
    delete_job(job_id)

# ─── Saved Jobs ──────────────────────────────────────────────────────────────

@router.post("/{job_id}/save", status_code=201)
async def save_job(job_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO saved_jobs (job_id) VALUES ($1)", job_id)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Already saved")
    return {"saved": True}

@router.delete("/{job_id}/save", status_code=204)
async def unsave_job(job_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM saved_jobs WHERE job_id = $1", job_id)

@router.get("/saved/all")
async def get_saved_jobs():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT j.* FROM jobs j
            JOIN saved_jobs s ON s.job_id = j.id
            ORDER BY s.created_at DESC
        """)
    return [dict(r) for r in rows]

@router.post("/reindex")
async def reindex_all():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM jobs")
    jobs = [dict(r) for r in rows]
    for j in jobs:
        j["tags"] = list(j["tags"] or [])
    index_jobs_bulk(jobs)
    return {"reindexed": len(jobs)}

@router.post("/setup-index")
async def setup_index():
    from search import get_client
    client = get_client()
    index = client.index("jobs")
    index.update_searchable_attributes(["title", "company", "location", "tags"])
    index.update_filterable_attributes(["source", "remote", "level", "salary_min", "salary_max"])
    index.update_sortable_attributes(["date_posted", "salary_min", "salary_max"])
    return {"status": "index configured"}