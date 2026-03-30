from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class JobCreate(BaseModel):
    title:       str
    company:     str
    location:    Optional[str] = None
    salary_min:  Optional[int] = None
    salary_max:  Optional[int] = None
    salary_raw:  Optional[str] = None
    source:      str
    apply_url:   Optional[str] = None
    remote:      bool = False
    level:       Optional[str] = None
    tags:        list[str] = []

class JobOut(JobCreate):
    id:          int
    hash:        str
    date_posted: datetime
    created_at:  datetime
    saved:       bool = False

    class Config:
        from_attributes = True

class SearchParams(BaseModel):
    q:       str = ""
    source:  Optional[str] = None
    remote:  Optional[bool] = None
    level:   Optional[str] = None
    min_sal: Optional[int] = None
    sort_by: str = "date_posted"   # date_posted | salary_min | salary_max
    order:   str = "desc"
    page:    int = 1
    limit:   int = 20
