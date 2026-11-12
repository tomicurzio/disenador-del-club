// Vercel Function: fills in a film's credits and synopsis.
// Needs ANTHROPIC_API_KEY, and uses TMDB_API_KEY too when it is set (Project Settings > Environment Variables).
// It only accepts a title and a year and builds the prompt here, so it can't be used as a general Claude proxy.
// Credits (year, director, writer, producers) come from TMDB when TMDB_API_KEY is set: they are exact and free.
// Claude then only writes the short synopsis and its three highlights, starting from TMDB's overview.
// Without a TMDB key, or if TMDB fails, Claude does the whole lookup as before.
const MODEL = "claude-sonnet-5-5";
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

// returns null when TMDB can't be used, {notFound:true} when the film isn't there, or the film's data
async function fromTmdb(title, year) {
  if (!process.env.TMDB_API_KEY) return null;
  try {
    const s = await tmdb("/search/movie", { query: title, year, include_adult: "false", language: "es-AR" });
    if (!s.ok) return null;
    let results = (await s.json()).results || [];
    if (year) results = results.filter((m) => (m.release_date || "").startsWith(year));
    const film = results[0];
    if (!film) return { notFound: true };
    const d = await tmdb(`/movie/${film.id}`, { language: "es-AR", append_to_response: "credits" });
    if (!d.ok) return null;
    const m = await d.json();
    const crew = (m.credits && m.credits.crew) || [];
    let overview = m.overview || "";
    if (!overview) {
      const e = await tmdb(`/movie/${film.id}`, { language: "en-US" });
      if (e.ok) overview = (await e.json()).overview || "";
    }
    return {
      year: (m.release_date || "").slice(0, 4),
      director: names(crew.filter((p) => p.job === "Director")),
      writer: names(crew.filter((p) => ["Screenplay", "Writer"].includes(p.job))),
      producers: names(crew.filter((p) => p.job === "Producer")),
      overview,
    };
  } catch {
    return null;
  }
}

async function claude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "content-type": "application/json",
    },
    // low effort keeps thinking short, fallbacks reroute the rare safety decline
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      fallbacks: "default",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status === 429) throw new Response("Rate limited", { status: 429 });
  if (!res.ok) throw new Response("Upstream error", { status: 502 });
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Response("Declined", { status: 502 });
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Response("Bad answer", { status: 502 });
  try { return JSON.parse(m[0]); } catch { throw new Response("Bad answer", { status: 502 }); }
}

const SYN = `"synopsis": una sola oración en español rioplatense neutro, de 110 a 160 caracteres, sin spoilers del final, que presente la premisa,
"highlights": array con exactamente 3 frases cortas (1 a 3 palabras) copiadas TEXTUALMENTE de la sinopsis, las más evocadoras.`;

async function handle(req) {
  let body;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const title = String(body.title || "").trim().slice(0, 120);
  const year = String(body.year || "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!title) return new Response("Missing title", { status: 400 });

  try {
    const t = await fromTmdb(title, year);
    if (t && t.notFound) return Response.json({ notFound: true });
    if (t) {
      const { overview, ...credits } = t;
      let syn = {};
      try {
        syn = await claude(`Sos el equipo de comunicación de un cine club universitario de Buenos Aires. Película: "${title}" (${t.year}), de ${t.director || "director desconocido"}.${overview ? ` Resumen de TMDB: """${overview.slice(0, 1500)}"""` : ""}
Devolvé SOLO un objeto JSON con estas claves:
${SYN}
Basate en el resumen; no agregues hechos que no estén ahí.`);
      } catch (e) {
        if (e instanceof Response && e.status === 429) return e;
      }
      return Response.json({ ...credits, synopsis: syn.synopsis || "", highlights: syn.highlights || [] });
    }
    return Response.json(await claude(`Sos el equipo de comunicación de un cine club universitario de Buenos Aires. Para la película "${title}"${year ? ` estrenada en ${year}. Tiene que ser exactamente la de ese año: puede haber otras con el mismo título de otros años, ignoralas. Si no existe una película con ese título estrenada en ${year}, devolvé solo {"notFound":true}` : ""}. Devolvé SOLO un objeto JSON con estas claves:
"year": año de estreno (string),
"director": nombre completo del director/a,
"producers": productor/es principales separados por " y " (string, vacío si no lo sabés con certeza),
"writer": guionista/s separados por " y ",
${SYN}
No inventes créditos: si dudás, dejá el campo vacío.`));
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("Error", { status: 500 });
  }
}

export function POST(req) {
  return handle(req);
}
