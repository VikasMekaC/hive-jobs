import hashlib

def make_hash(title: str, company: str, location: str) -> str:
    """
    Stable fingerprint for a job listing.
    Same job posted on LinkedIn AND Indeed will produce the same hash
    and be rejected as a duplicate on insert.
    """
    raw = f"{title.lower().strip()}|{company.lower().strip()}|{location.lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()
