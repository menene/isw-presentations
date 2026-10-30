# Evaluación de presentaciones · CC3091

Aplicación Vue 3/Vite para calificar las presentaciones con `Rubrica.pdf`. Un solo **Cloudflare Worker** sirve el sitio compilado, atiende `/api/*` y usa **D1 (SQLite)** para guardar las evaluaciones. El código puede mantenerse en GitHub, pero GitHub Pages ya no participa en el despliegue.

## Desarrollo local

Requiere Node.js 20 o posterior.

```sh
npm install
cp -n .env.example .env.local
npm run dev
```

Abre `http://localhost:5173`. Vite sirve la interfaz y envía `/api/*` al Worker local en `http://localhost:8787`; desde el navegador, sitio y API usan el mismo origen. `npm run dev` compila los assets para Wrangler, aplica migraciones locales pendientes y arranca ambos procesos. Si ya están corriendo, detenlos antes de reiniciar. Wrangler puede pedir confirmación al aplicar una migración.

Las páginas usan URLs limpias: `/evaluar`, `/resultados`, `/resultados/<id>`, `/stats`, `/exportar` y `/admin`. El Worker sirve la aplicación al abrir o recargar cualquiera de estas rutas directamente. Los enlaces antiguos con `#/` se convierten a la ruta nueva al abrirlos.

`npm run preview` compila y sirve el sitio y la API directamente desde Wrangler en `http://localhost:8787`, sin Vite.

Para Admin, define `ADMIN_TOKEN=<clave larga y aleatoria>` en `.env.local` y reinicia el Worker. Esta carpeta ya tiene una clave local generada en ese archivo; pégala en la página Admin. La clave permanece solo en la memoria de la pestaña.

La base local es un archivo SQLite oculto dentro de `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`. Esa carpeta se ignora en Git. La base D1 publicada es independiente de la local.

```sh
npm test
npm run build
```

## Publicación en Cloudflare

1. Inicia sesión con `npx wrangler login`. Crea la base remota con `npx wrangler d1 create grading-db`, o reutiliza la D1 existente si ya tienes datos publicados.
2. Sustituye `REPLACE_WITH_D1_DATABASE_ID` en `wrangler.jsonc` por el ID de esa base. Conserva el mismo ID en despliegues posteriores para no perder acceso a los datos.
3. Ejecuta `npm run deploy`. Este comando compila Vue, aplica las migraciones remotas pendientes y publica **el sitio y la API juntos** como un Worker. Wrangler mostrará la URL `workers.dev`. Puedes añadir un dominio propio desde Cloudflare.
4. Configura la clave de Admin con `npx wrangler secret put ADMIN_TOKEN`. Usa una clave larga y aleatoria. No la incluyas en `wrangler.jsonc`, variables `VITE_` ni archivos versionados. El comando publica una nueva versión del Worker con el secreto.
5. Para despliegues automáticos, conecta el repositorio de GitHub al Worker en **Cloudflare Workers Builds**. Configura el build como `npm run build` y el deploy como `npx wrangler deploy`. Cuando agregues una migración de D1, aplica `npm run db:remote` antes de publicar el código que la necesita.

Las evaluaciones locales **no** se transfieren automáticamente a D1 remoto. Si quieres conservarlas, después de crear y migrar la base remota ejecuta `npm run db:export-local` y luego `npx wrangler d1 execute grading-db --remote --file=.wrangler/local-evaluations.sql`. Haz esa importación una sola vez: los IDs de evaluaciones son únicos y repetirla producirá conflictos.

## Datos y cálculos

- Cualquier persona puede enviar una evaluación con nombre, grupo, ocho niveles, comentarios por criterio y comentario general. Los envíos repetidos cuentan por separado.
- Cada nivel vale 0, 25, 50, 75 o 100 % del máximo de su criterio. Los totales se guardan en centésimos de punto y los promedios se muestran con dos decimales.
- Resultados muestra promedios y cantidad de votos por grupo. El detalle público de cada grupo muestra evaluaciones individuales con nombre, fecha, puntuaciones y comentarios.
- Exportar descarga un CSV consolidado de todas las secciones o una sección, sin nombres ni comentarios.
- Stats compara secciones por el promedio de sus grupos evaluados y destaca el mejor grupo y la sección líder. Los grupos sin votos no cuentan; los empates se muestran.
- Admin requiere `ADMIN_TOKEN` para borrar una evaluación o vaciar todas las respuestas. Vaciar exige escribir `BORRAR TODO`; conserva las tablas y los grupos. Las eliminaciones no se pueden deshacer.
