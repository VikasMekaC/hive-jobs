import meilisearch
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

MEILI_URL  = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_KEY  = os.getenv("MEILI_MASTER_KEY", "")
INDEX_NAME = "jobs"

print(f"DEBUG MEILI_KEY='{MEILI_KEY}' MEILI_URL='{MEILI_URL}'")

_client: Optional[meilisearch.Client] = None

def get_client() -> meilisearch.Client:
    global _client
    if _client is None:
        if MEILI_KEY:
            _client = meilisearch.Client(MEILI_URL, MEILI_KEY)
        else:
            _client = meilisearch.Client(MEILI_URL)
    return _client

def get_index():
    client = get_client()
    try:
        index = client.get_index(INDEX_NAME)
    except Exception:
        client.create_index(INDEX_NAME, {"primaryKey": "id"})
        index = client.index(INDEX_NAME)
        index.update_searchable_attributes(["title", "company", "location", "tags"])
        index.update_filterable_attributes(["source", "remote", "level", "salary_min", "salary_max"])
        index.update_sortable_attributes(["date_posted", "salary_min", "salary_max"])
    return index

def index_job(job: dict):
    """Add or update a single job in Meilisearch."""
    index = get_index()
    index.add_documents([_prepare(job)])

def index_jobs_bulk(jobs: list[dict]):
    """Bulk index a list of jobs."""
    index = get_index()
    index.add_documents([_prepare(j) for j in jobs])

def search_jobs(
    query: str = "",
    filters: list[str] = None,
    sort: list[str] = None,
    offset: int = 0,
    limit: int = 20,
) -> dict:
    client = get_client()
    index = client.index(INDEX_NAME)
    params = {
        "offset": offset,
        "limit": limit,
        "attributesToHighlight": ["title", "company"],
    }
    if filters:
        params["filter"] = filters
    if sort:
        params["sort"] = sort

    return index.search(query, params)

def delete_job(job_id: int):
    index = get_index()
    index.delete_document(job_id)

def _prepare(job: dict) -> dict:
    """Normalize a job dict for Meilisearch (needs plain types)."""
    return {
        "id":          job["id"],
        "title":       job["title"],
        "company":     job["company"],
        "location":    job.get("location", ""),
        "salary_min":  job.get("salary_min") or 0,
        "salary_max":  job.get("salary_max") or 0,
        "salary_raw":  job.get("salary_raw", ""),
        "source":      job["source"],
        "apply_url":   job.get("apply_url", ""),
        "date_posted": str(job.get("date_posted", "")),
        "remote":      bool(job.get("remote", False)),
        "level":       job.get("level", ""),
        "tags":        job.get("tags") or [],
    }
