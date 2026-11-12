// Vercel Function.
// Fills in a film's data from TMDB (themoviedb.org): year, director, writer, producers and its Spanish overview.
// Needs the environment variable TMDB_API_KEY (the v3 "API Key" or the v4 "Read Access Token").
const TMDB = "https://api.themoviedb.org/3";

function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY || "";
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const headers = { accept: "application/json" };
  if (key.length > 40) headers.authorization = "Bearer " + key;
  else url.searchParams.set("api_key", key);
  return fetch(url, { headers });
}

const names = (list) => {
  const u = [...new Set(list.map((p) => p.name))].slice(0, 3);
  return u.length > 1 ? u.slice(0, -1).join(", ") + " y " + u[u.length - 1] : u[0] || "";
};

// TMDB overviews are often long: keep whole sentences up to ~220 characters (at least the first one)
function shorten(text) {
  const parts = (text || "").replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) || [];
  let out = "";
  for (const p of parts) {
    if (out && (out + p).trim().length > 220) break;
    out += p;
  }
  return out.trim();
}

async function handle(req) {
  if (!process.env.TMDB_API_KEY) return new Response("Missing TMDB_API_KEY", { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const title = String(body.title || "").trim().slice(0, 120);
  const year = String(body.year || "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!title) return new Response("Missing title", { status: 400 });
  try {
    const s = await tmdb("/search/movie", { query: title, year, include_adult: "false", language: "es-AR" });
    if (!s.ok) return new Response("TMDB error", { status: 502 });
    let results = (await s.json()).results || [];
    if (year) results = results.filter((m) => (m.release_date || "").startsWith(year));
    const film = results[0];
    if (!film) return Response.json({ notFound: true });
    const d = await tmdb(`/movie/${film.id}`, { language: "es-AR", append_to_response: "credits" });
    if (!d.ok) return new Response("TMDB error", { status: 502 });
    const m = await d.json();
    let overview = m.overview || "";
    if (!overview) { // no Argentine text: try Spain's
      const e = await tmdb(`/movie/${film.id}`, { language: "es-ES" });
      if (e.ok) overview = (await e.json()).overview || "";
    }
    const crew = (m.credits && m.credits.crew) || [];
    return Response.json({
      year: (m.release_date || "").slice(0, 4),
      director: names(crew.filter((p) => p.job === "Director")),
      writer: names(crew.filter((p) => ["Screenplay", "Writer"].includes(p.job))),
      producers: names(crew.filter((p) => p.job === "Producer")),
      synopsis: shorten(overview),
      highlights: [],
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}

export function POST(req) {
  return handle(req);
}
