import { useState, useEffect, useRef } from "react";
import { searchJobs, saveJob, unsaveJob, getSavedJobs } from "./api-client";
const MOCK_JOBS = [
  { id: 1, title: "Senior Software Engineer", company: "Shopify", location: "Remote", salary: "$140k–$180k", source: "linkedin", remote: true, type: "Full-time", level: "Senior", posted: "2h ago", logo: "S", color: "#96BF48", saved: false, tags: ["React", "Ruby", "AWS"] },
  { id: 2, title: "Backend Engineer", company: "Stripe", location: "Montreal, QC", salary: "$130k–$160k", source: "indeed", remote: false, type: "Full-time", level: "Mid", posted: "5h ago", logo: "S", color: "#635BFF", saved: false, tags: ["Go", "Kubernetes", "gRPC"] },
  { id: 3, title: "Full Stack Developer", company: "Unity", location: "Remote", salary: "$120k–$150k", source: "glassdoor", remote: true, type: "Full-time", level: "Mid", posted: "1d ago", logo: "U", color: "#222", saved: false, tags: ["C#", "TypeScript", "React"] },
  { id: 4, title: "Software Engineer II", company: "Notion", location: "Remote", salary: "$125k–$155k", source: "greenhouse", remote: true, type: "Full-time", level: "Mid", posted: "1d ago", logo: "N", color: "#000", saved: false, tags: ["TypeScript", "Node.js", "PostgreSQL"] },
  { id: 5, title: "Frontend Engineer", company: "Figma", location: "San Francisco, CA", salary: "$145k–$185k", source: "lever", remote: false, type: "Full-time", level: "Senior", posted: "2d ago", logo: "F", color: "#F24E1E", saved: false, tags: ["React", "WebGL", "CSS"] },
  { id: 6, title: "Platform Engineer", company: "Vercel", location: "Remote", salary: "$135k–$165k", source: "linkedin", remote: true, type: "Full-time", level: "Senior", posted: "2d ago", logo: "V", color: "#000", saved: false, tags: ["Rust", "Edge Functions", "AWS"] },
  { id: 7, title: "Software Engineer", company: "Linear", location: "Remote", salary: "$120k–$150k", source: "greenhouse", remote: true, type: "Full-time", level: "Mid", posted: "3d ago", logo: "L", color: "#5E6AD2", saved: false, tags: ["TypeScript", "GraphQL", "Electron"] },
  { id: 8, title: "Infrastructure Engineer", company: "Tailscale", location: "Remote", salary: "$150k–$200k", source: "lever", remote: true, type: "Full-time", level: "Senior", posted: "3d ago", logo: "T", color: "#44b4d0", saved: false, tags: ["Go", "WireGuard", "Linux"] },
  { id: 9, title: "Backend Developer", company: "Wealthsimple", location: "Toronto, ON", salary: "$110k–$140k", source: "indeed", remote: false, type: "Full-time", level: "Junior", posted: "4d ago", logo: "W", color: "#00D4A4", saved: false, tags: ["Ruby", "Rails", "PostgreSQL"] },
  { id: 10, title: "React Engineer", company: "Mercury", location: "Remote", salary: "$130k–$160k", source: "glassdoor", remote: true, type: "Full-time", level: "Mid", posted: "5d ago", logo: "M", color: "#4A90D9", saved: false, tags: ["React", "TypeScript", "Python"] },
  { id: 11, title: "ML Engineer", company: "Cohere", location: "Toronto, ON", salary: "$160k–$210k", source: "linkedin", remote: false, type: "Full-time", level: "Senior", posted: "1w ago", logo: "C", color: "#39594D", saved: false, tags: ["Python", "PyTorch", "CUDA"] },
  { id: 12, title: "DevOps Engineer", company: "Cloudflare", location: "Remote", salary: "$140k–$175k", source: "greenhouse", remote: true, type: "Full-time", level: "Mid", posted: "1w ago", logo: "C", color: "#F48120", saved: false, tags: ["Terraform", "Kubernetes", "Go"] },
];

const SOURCE_META = {
  linkedin: { label: "LinkedIn", color: "#0A66C2", bg: "#e8f0fb" },
  indeed: { label: "Indeed", color: "#2164f3", bg: "#e8effe" },
  glassdoor: { label: "Glassdoor", color: "#0caa41", bg: "#e6f7ec" },
  greenhouse: { label: "Greenhouse", color: "#3D9B35", bg: "#e8f5e6" },
  lever: { label: "Lever", color: "#4B5AFF", bg: "#eceeff" },
};

const LEVEL_COLORS = {
  Junior: { bg: "#FFF3E0", color: "#E65100" },
  Mid: { bg: "#E3F2FD", color: "#1565C0" },
  Senior: { bg: "#F3E5F5", color: "#6A1B9A" },
};

export default function JobAggregator() {
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteFilter, setRemoteFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [view, setView] = useState("search"); // search | saved | alerts
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchFired, setSearchFired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);
  const searchRef = useRef();

  const [savedJobs, setSavedJobs] = useState([]);
  const [page, setPage] = useState(1);
const [totalJobs, setTotalJobs] = useState(0);

useEffect(() => {
  if (view === "saved") {
    getSavedJobs().then(data => setSavedJobs(data));
  }
}, [view]);

useEffect(() => {
  if (searchFired) {
    handleSearch();
  }
}, [remoteFilter, sourceFilter, levelFilter, sortBy, page]);

  const toggleSave = async (id) => {
  const job = jobs.find(j => j.id === id);
  if (job.saved) {
    await unsaveJob(id);
  } else {
    await saveJob(id);
  }
  setJobs(prev => prev.map(j => j.id === id ? { ...j, saved: !j.saved } : j));
  if (selectedJob?.id === id) setSelectedJob(prev => ({ ...prev, saved: !prev.saved }));
};

  const handleSearch = async () => {
  setLoading(true);
  setSelectedJob(null);
  setPage(1);  // ← add this line
  try {
    const data = await searchJobs({
      q: query,
      source: sourceFilter === "all" ? undefined : sourceFilter,
      remote: remoteFilter === "all" ? undefined : remoteFilter === "remote",
      level: levelFilter === "all" ? undefined : levelFilter,
      sort_by: sortBy === "newest" ? "date_posted" : sortBy,
      page: 1,  // ← change page: page to page: 1
    });
    setJobs(data.hits);
    setTotalJobs(data.total);
    setSearchFired(true);
  } catch (err) {
    console.error("Search failed:", err);
  } finally {
    setLoading(false);
  }
};

  const filtered = jobs.filter(j => {
    const q = query.toLowerCase();
    const matchQ = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.tags.some(t => t.toLowerCase().includes(q));
    const matchL = !location || j.location.toLowerCase().includes(location.toLowerCase()) || (location.toLowerCase() === "remote" && j.remote);
    const matchR = remoteFilter === "all" || (remoteFilter === "remote" && j.remote) || (remoteFilter === "onsite" && !j.remote);
    const matchS = sourceFilter === "all" || j.source === sourceFilter;
    const matchLvl = levelFilter === "all" || j.level === levelFilter;
    return matchQ && matchL && matchR && matchS && matchLvl;
  }).sort((a, b) => {
    if (sortBy === "salary") return parseInt(b.salary) - parseInt(a.salary);
    if (sortBy === "match") return b.tags.length - a.tags.length;
    return 0;
  });

  const displayJobs = view === "saved" ? savedJobs : (searchFired ? filtered : []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F7F6F2", minHeight: "100vh", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #d0cfc9; border-radius: 3px; }
        .job-card { transition: all 0.18s ease; cursor: pointer; border: 1.5px solid transparent; }
        .job-card:hover { border-color: #1a1a1a; transform: translateY(-1px); box-shadow: 3px 3px 0 #1a1a1a; }
        .job-card.active { border-color: #1a1a1a !important; box-shadow: 3px 3px 0 #1a1a1a; background: #fff; }
        .btn-primary { background: #1a1a1a; color: #fff; border: none; padding: 12px 28px; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-primary:hover { background: #333; transform: translateY(-1px); }
        .filter-pill { border: 1.5px solid #ddd; background: #fff; padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit; color: #555; }
        .filter-pill:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .filter-pill.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
        .save-btn { background: none; border: none; font-size: 18px; cursor: pointer; transition: transform 0.15s; padding: 4px; line-height: 1; }
        .save-btn:hover { transform: scale(1.2); }
        .nav-item { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; background: none; font-family: inherit; color: #777; }
        .nav-item:hover { background: #eee; color: #1a1a1a; }
        .nav-item.active { background: #1a1a1a; color: #fff; }
        input, select { font-family: inherit; outline: none; }
        input:focus { border-color: #1a1a1a !important; }
        .tag { display: inline-block; background: #F0EFEB; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; color: #555; margin: 2px; }
        .source-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .skeleton { background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200%; animation: shimmer 1.2s infinite; border-radius: 6px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .slide-in { animation: slideIn 0.25s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1.5px solid #E8E6E0", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 16 }}>⬡</span>
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, letterSpacing: "-0.3px" }}>Hive</span>
          <span style={{ background: "#F0EFEB", color: "#888", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, marginLeft: 4 }}>JOBS</span>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {["search", "saved", "alerts"].map(v => (
            <button key={v} className={`nav-item ${view === v ? "active" : ""}`} onClick={() => { setView(v); setSelectedJob(null); }}>
              {v === "search" ? "🔍 Search" : v === "saved" ? `⭐ Saved ${savedJobs.length > 0 ? `(${savedJobs.length})` : ""}` : "🔔 Alerts"}
            </button>
          ))}
        </nav>
      </header>

      {view === "search" && (
        <>
          {/* Hero Search */}
          <div style={{ background: "#fff", borderBottom: "1.5px solid #E8E6E0", padding: "32px 32px 24px" }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 400, marginBottom: 6, letterSpacing: "-0.5px" }}>
              Find jobs across <em>every</em> platform.
            </h1>
            <p style={{ color: "#888", fontSize: 15, marginBottom: 24 }}>LinkedIn · Indeed · Glassdoor · Greenhouse · Lever — searched together.</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 260px" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#aaa" }}>🔍</span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Job title, company, or skill…"
                  style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 10, border: "1.5px solid #E0DEDB", fontSize: 15, transition: "border-color 0.15s" }}
                />
              </div>
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#aaa" }}>📍</span>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="City or Remote"
                  style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 10, border: "1.5px solid #E0DEDB", fontSize: 15 }}
                />
              </div>
              <button className="btn-primary" onClick={handleSearch} style={{ minWidth: 120 }}>
                {loading ? "Searching…" : "Search Jobs"}
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#999", marginRight: 4 }}>Filter:</span>
              {["all", "remote", "onsite"].map(f => (
                <button key={f} className={`filter-pill ${remoteFilter === f ? "active" : ""}`} onClick={() => setRemoteFilter(f)}>
                  {f === "all" ? "Any location" : f === "remote" ? "🌐 Remote" : "🏢 On-site"}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: "#E0DEDB", margin: "0 4px" }} />
              {["all", "Junior", "Mid", "Senior"].map(f => (
                <button key={f} className={`filter-pill ${levelFilter === f ? "active" : ""}`} onClick={() => setLevelFilter(f)}>
                  {f === "all" ? "Any level" : f}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: "#E0DEDB", margin: "0 4px" }} />
              {["all", ...Object.keys(SOURCE_META)].map(f => (
                <button key={f} className={`filter-pill ${sourceFilter === f ? "active" : ""}`} onClick={() => setSourceFilter(f)}
                  style={sourceFilter === f && f !== "all" ? { background: SOURCE_META[f]?.color, color: "#fff", borderColor: SOURCE_META[f]?.color } : {}}>
                  {f === "all" ? "All sources" : SOURCE_META[f].label}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#999" }}>Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ border: "1.5px solid #E0DEDB", borderRadius: 8, padding: "6px 12px", fontSize: 13, background: "#fff", cursor: "pointer" }}>
                  <option value="newest">Newest</option>
                  <option value="salary">Highest salary</option>
                  <option value="match">Best match</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: "flex", height: "calc(100vh - 230px)", overflow: "hidden" }}>
            {/* List */}
            <div style={{ width: selectedJob ? 380 : "100%", overflowY: "auto", padding: "20px 24px", flexShrink: 0, transition: "width 0.2s ease" }}>
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1.5px solid #E8E6E0" }}>
                      <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 10 }} />
                      <div className="skeleton" style={{ height: 14, width: "40%", marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 14, width: "30%" }} />
                    </div>
                  ))}
                </div>
              )}

              {!loading && !searchFired && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
                  <p style={{ fontSize: 16, fontFamily: "'DM Serif Display', serif", color: "#555" }}>Search for your next role</p>
                  <p style={{ fontSize: 14, marginTop: 8 }}>We'll search LinkedIn, Indeed, Glassdoor, Greenhouse & Lever at once.</p>
                </div>
              )}

              {!loading && searchFired && displayJobs.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                  <p style={{ fontSize: 16 }}>No results found. Try different keywords.</p>
                </div>
              )}

              {!loading && displayJobs.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: "#999", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong style={{ color: "#1a1a1a" }}>{totalJobs}</strong> jobs found</span>
                    <span style={{ fontSize: 12 }}>Aggregated from {[...new Set(displayJobs.map(j => j.source))].length} sources</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {displayJobs.map((job, i) => (
                      <div key={job.id} className={`job-card fade-in ${selectedJob?.id === job.id ? "active" : ""}`}
                        style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #E8E6E0", animationDelay: `${i * 0.04}s` }}
                        onClick={() => setSelectedJob(job)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 12, flex: 1 }}>
                            <div style={{ width: 42, height: 42, background: job.color, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                              {job.logo}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, fontSize: 15 }}>{job.title}</span>
                                <span className="source-badge" style={{ background: SOURCE_META[job.source].bg, color: SOURCE_META[job.source].color }}>
                                  {SOURCE_META[job.source].label}
                                </span>
                              </div>
                              <div style={{ color: "#666", fontSize: 13, marginTop: 3 }}>{job.company} · {job.location}</div>
                              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{job.salary}</span>
                                <span style={{ ...LEVEL_COLORS[job.level], padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{job.level}</span>
                                {job.remote && <span style={{ background: "#E8F5E9", color: "#2E7D32", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Remote</span>}
                                <span style={{ color: "#aaa", fontSize: 12, marginLeft: "auto" }}>{job.posted}</span>
                              </div>
                            </div>
                          </div>
                          <button className="save-btn" onClick={e => { e.stopPropagation(); toggleSave(job.id); }}>
                            {job.saved ? "⭐" : "☆"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {searchFired && totalJobs > 20 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 0" }}>
                      <button className="filter-pill" disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}>
                        ← Prev
                      </button>
                      <span style={{ padding: "7px 16px", fontSize: 13, color: "#888" }}>
                        Page {page} of {Math.ceil(totalJobs / 20)}
                      </span>
                      <button className="filter-pill" disabled={page >= Math.ceil(totalJobs / 20)}
                        onClick={() => setPage(p => p + 1)}>
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail Panel */}
            {selectedJob && (
              <div className="slide-in" style={{ flex: 1, background: "#fff", borderLeft: "1.5px solid #E8E6E0", overflowY: "auto", padding: "28px 32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{ width: 56, height: 56, background: selectedJob.color, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>
                      {selectedJob.logo}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>{selectedJob.title}</h2>
                      <div style={{ color: "#666", fontSize: 15, marginTop: 2 }}>{selectedJob.company}</div>
                    </div>
                  </div>
                  <button style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa", padding: 4 }} onClick={() => setSelectedJob(null)}>✕</button>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                  <span className="source-badge" style={{ background: SOURCE_META[selectedJob.source].bg, color: SOURCE_META[selectedJob.source].color, padding: "5px 12px", borderRadius: 6, fontSize: 12 }}>
                    via {SOURCE_META[selectedJob.source].label}
                  </span>
                  <span style={{ ...LEVEL_COLORS[selectedJob.level], padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{selectedJob.level}</span>
                  {selectedJob.remote && <span style={{ background: "#E8F5E9", color: "#2E7D32", padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>🌐 Remote</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                  {[["📍 Location", selectedJob.location], ["💰 Salary", selectedJob.salary], ["⏱ Type", selectedJob.type], ["📅 Posted", selectedJob.posted]].map(([k, v]) => (
                    <div key={k} style={{ background: "#F7F6F2", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>{k}</div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Skills</div>
                  <div>{selectedJob.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>About the role</div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#555" }}>
                    {selectedJob.company} is looking for a {selectedJob.title} to join their team. You'll work on challenging problems at scale, collaborate with world-class engineers, and help shape the future of the product. This is a {selectedJob.level.toLowerCase()}-level role requiring strong skills in {selectedJob.tags.slice(0, 2).join(" and ")}.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <a href={selectedJob.apply_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: "block", textAlign: "center", background: "#1a1a1a", color: "#fff", padding: "14px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", transition: "background 0.15s" }}
                  onMouseEnter={e => e.target.style.background = "#333"} onMouseLeave={e => e.target.style.background = "#1a1a1a"}>
                  Apply on {SOURCE_META[selectedJob.source].label} →
                  </a>
                  <button onClick={() => toggleSave(selectedJob.id)}
                    style={{ padding: "14px 18px", borderRadius: 10, border: "1.5px solid #E0DEDB", background: selectedJob.saved ? "#FFFDE7" : "#fff", cursor: "pointer", fontSize: 20, transition: "all 0.15s" }}>
                    {selectedJob.saved ? "⭐" : "☆"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Saved Jobs View */}
      {view === "saved" && (
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px" }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 6 }}>Saved Jobs</h2>
          <p style={{ color: "#999", marginBottom: 24, fontSize: 14 }}>{savedJobs.length} job{savedJobs.length !== 1 ? "s" : ""} saved</p>
          {savedJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
              <p>No saved jobs yet. Star jobs while searching to bookmark them here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedJobs.map(job => (
                <div key={job.id} style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid #E8E6E0", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, background: job.color, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>{job.logo}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{job.title}</div>
                    <div style={{ color: "#888", fontSize: 13 }}>{job.company} · {job.location} · {job.salary}</div>
                  </div>
                  <span className="source-badge" style={{ background: SOURCE_META[job.source].bg, color: SOURCE_META[job.source].color }}>{SOURCE_META[job.source].label}</span>
                  <button className="save-btn" onClick={() => toggleSave(job.id)} title="Remove">⭐</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts View */}
      {view === "alerts" && (
        <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 6 }}>Job Alerts</h2>
          <p style={{ color: "#999", marginBottom: 32, fontSize: 14 }}>Get notified when new matching jobs appear.</p>

          {!alertSaved ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1.5px solid #E8E6E0" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Job Title / Keywords</label>
                <input defaultValue="Software Engineer" style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E0DEDB", fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Location</label>
                <input defaultValue="Remote" style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E0DEDB", fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Your Email</label>
                <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="you@email.com" style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E0DEDB", fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Frequency</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Instant", "Daily", "Weekly"].map(f => (
                    <button key={f} className={`filter-pill ${f === "Daily" ? "active" : ""}`} style={{ flex: 1, textAlign: "center" }}>{f}</button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: 14 }} onClick={async () => {
              if (!alertEmail) return;
              await fetch("http://localhost:8000/api/alerts/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: alertEmail, keywords: query || "software engineer" })
              });
              setAlertSaved(true);
}}>
  Create Alert
</button>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 16, padding: 32, border: "1.5px solid #E8E6E0", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 8 }}>Alert created!</h3>
              <p style={{ color: "#888", fontSize: 14 }}>We'll email <strong>{alertEmail}</strong> when new matching jobs appear.</p>
              <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => { setAlertSaved(false); setAlertEmail(""); }}>Create another</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
