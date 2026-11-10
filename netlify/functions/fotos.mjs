// Finds stills for a film on TMDB (themoviedb.org) and proxies the chosen image,
// so the page can read its pixels for the halftone (TMDB images have no CORS headers for canvas use).
// Needs the environment variable TMDB_API_KEY (either the v3 "API Key" or the v4 "Read Access Token").
const TMDB = "https://api.themoviedb.org/3";

function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY || "";
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const headers = { accept: "application/json" };
  // v4 read tokens are long JWTs and go in a header; v3 keys go in the query string
  if (key.length > 40) headers.authorization = "Bearer " + key;
  else url.searchParams.set("api_key", key);
  return fetch(url, { headers });
}

async function handle(req) {
  const u = new URL(req.url);
  const img = u.searchParams.get("img");
  if (img) {
    // only TMDB image paths like /abc123.jpg
    if (!/^\/[A-Za-z0-9_-]+\.(jpg|png)$/.test(img)) return new Response("Bad image", { status: 400 });
    const r = await fetch("https://image.tmdb.org/t/p/original" + img);
    if (!r.ok) return new Response("Not found", { status: 404 });
    return new Response(await r.arrayBuffer(), {
      headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" },
    });
  }
  const title = (u.searchParams.get("title") || "").trim().slice(0, 120);
  const year = (u.searchParams.get("year") || "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!title) return new Response("Missing title", { status: 400 });
  let s = await tmdb("/search/movie", { query: title, year, include_adult: "false" });
  if (!s.ok) return new Response("TMDB error", { status: 502 });
  let results = (await s.json()).results || [];
  // with a year, only accept films released that year
  if (year) results = results.filter((m) => (m.release_date || "").startsWith(year));
  const film = results[0];
  if (!film) return Response.json({ notFound: true });
  const im = await tmdb(`/movie/${film.id}/images`, { include_image_language: "null" });
  if (!im.ok) return new Response("TMDB error", { status: 502 });
  const backdrops = ((await im.json()).backdrops || [])
    .sort((a, b) => b.width - a.width)
    .slice(0, 24)
    .map((b) => ({ path: b.file_path, thumb: "https://image.tmdb.org/t/p/w300" + b.file_path, w: b.width, h: b.height }));
  return Response.json({ title: film.title, year: (film.release_date || "").slice(0, 4), stills: backdrops });
}

export default handle;
