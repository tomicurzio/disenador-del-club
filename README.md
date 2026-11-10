# El diseñador del club

Arma las cinco piezas del cine club (post, sinopsis, historia 1, historia 2 y A3) a partir de los datos de la función y dos fotos.

- `index.html`: la página completa.
- `api/completar.js`: función de Vercel para el botón "Completar con Claude". Necesita la variable de entorno `ANTHROPIC_API_KEY`.

## Publicar

- **Netlify:** importar el repo desde app.netlify.com ("Add new site" > "Import an existing project"). Usa `netlify.toml` y `netlify/functions/completar.mjs`.
- **Vercel:** importar el repo desde vercel.com/new. Usa `api/completar.js`.

En los dos casos hay que agregar la variable de entorno `ANTHROPIC_API_KEY`.
