// Vercel Function: fills in a film's credits and synopsis with Claude.
// Needs the environment variable ANTHROPIC_API_KEY (Project Settings > Environment Variables).
// It only accepts a title and a year and builds the prompt here, so it can't be used as a general Claude proxy.
const MODEL = "claude-sonnet-5-5";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const title = String(body.title || "").trim().slice(0, 120);
  const year = String(body.year || "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!title) return new Response("Missing title", { status: 400 });

  const prompt = `Sos el equipo de comunicación de un cine club universitario de Buenos Aires. Para la película "${title}"${year ? ` estrenada en ${year}. Tiene que ser exactamente la de ese año: puede haber otras con el mismo título de otros años, ignoralas. Si no existe una película con ese título estrenada en ${year}, devolvé solo {"notFound":true}` : ""}. Devolvé SOLO un objeto JSON con estas claves:
"year": año de estreno (string),
"director": nombre completo del director/a,
"producers": productor/es principales separados por " y " (string, vacío si no lo sabés con certeza),
"writer": guionista/s separados por " y ",
"synopsis": una sola oración en español rioplatense neutro, de 110 a 160 caracteres, sin spoilers del final, que presente la premisa,
"highlights": array con exactamente 3 frases cortas (1 a 3 palabras) copiadas TEXTUALMENTE de la sinopsis, las más evocadoras.
No inventes créditos: si dudás, dejá el campo vacío.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (res.status === 429) return new Response("Rate limited", { status: 429 });
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return new Response("Bad answer", { status: 502 });
  try {
    return Response.json(JSON.parse(m[0]));
  } catch {
    return new Response("Bad answer", { status: 502 });
  }
}
