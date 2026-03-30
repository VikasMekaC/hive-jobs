const BASE = "http://localhost:8000/api";

export async function searchJobs({ q = "", source, remote, level, min_sal, sort_by = "date_posted", page = 1 } = {}) {
  const params = new URLSearchParams({ q, sort_by, page, limit: 20 });
  if (source)           params.set("source", source);
  if (remote !== null && remote !== undefined) params.set("remote", remote);
  if (level)            params.set("level", level);
  if (min_sal)          params.set("min_sal", min_sal);

  const res = await fetch(`${BASE}/jobs/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json(); // { hits, total, page, limit }
}

export async function saveJob(id)   {
  await fetch(`${BASE}/jobs/${id}/save`, { method: "POST" });
}

export async function unsaveJob(id) {
  await fetch(`${BASE}/jobs/${id}/save`, { method: "DELETE" });
}

export async function getSavedJobs() {
  const res = await fetch(`${BASE}/jobs/saved/all`);
  return res.json();
}

export async function syncSources() {
  const res = await fetch(`${BASE}/sources/sync`, { method: "POST" });
  return res.json();
}
