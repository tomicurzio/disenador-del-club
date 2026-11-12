# El diseñador del club

Arma las cinco piezas del cine club (post, sinopsis, historia 1, historia 2 y A3) a partir de los datos de la función y dos fotos.

- `index.html`: la página completa.
- `api/completar.js` y `netlify/functions/completar.mjs`: botón "Completar datos", busca la película en TMDB. Necesita la variable de entorno `TMDB_API_KEY`.

## Publicar

- **Netlify:** importar el repo desde app.netlify.com ("Add new site" > "Import an existing project"). Usa `netlify.toml` y `netlify/functions/completar.mjs`.
- **Vercel:** importar el repo desde vercel.com/new. Usa `api/completar.js`.

En los dos casos hay que agregar la variable de entorno `TMDB_API_KEY`.

## Buscar fotos

El botón "Buscar fotos" usa TMDB (themoviedb.org). Necesita la variable de entorno `TMDB_API_KEY` (la "API Key" o el "Read Access Token" de themoviedb.org > Settings > API).
