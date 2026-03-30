import asyncpg
import os
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/hivejobs")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL)
    return _pool

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id          SERIAL PRIMARY KEY,
                title       TEXT NOT NULL,
                company     TEXT NOT NULL,
                location    TEXT,
                salary_min  INTEGER,
                salary_max  INTEGER,
                salary_raw  TEXT,
                source      TEXT NOT NULL,
                apply_url   TEXT,
                date_posted TIMESTAMPTZ DEFAULT NOW(),
                remote      BOOLEAN DEFAULT FALSE,
                level       TEXT,
                tags        TEXT[],
                hash        TEXT UNIQUE,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_source   ON jobs(source);
            CREATE INDEX IF NOT EXISTS idx_jobs_remote   ON jobs(remote);
            CREATE INDEX IF NOT EXISTS idx_jobs_level    ON jobs(level);
            CREATE INDEX IF NOT EXISTS idx_jobs_hash     ON jobs(hash);

            CREATE TABLE IF NOT EXISTS saved_jobs (
                id         SERIAL PRIMARY KEY,
                job_id     INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(job_id)
            );

                           CREATE TABLE IF NOT EXISTS alerts (
    id         SERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    keywords   TEXT NOT NULL,
    location   TEXT,
    frequency  TEXT DEFAULT 'daily',
    last_sent  TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
        """)
    print("✅ Database initialized")
