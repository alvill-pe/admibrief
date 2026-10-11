# Pulso Empresarial — Negocios, economía y política

App gratuita (PWA) con las noticias más relevantes de Perú y el mundo sobre política, economía
y gestión, **resumidas dentro de la app** para líderes de negocio y estudiantes. Funciona en el
celular (instalable como app) y en la PC.

## Cómo funciona
- `.github/workflows/actualizar-noticias.yml` corre **cada hora** en GitHub Actions (gratis):
  1. `scripts/build-news.mjs` lee los RSS de El Comercio, Gestión, La República, Infobae, Andina, RPP, BBC Mundo y Mercado Negro.
  2. Toma el texto de cada nota y arma un **resumen amplio** (las ideas principales, en párrafos), **datos clave** y la
     **«Clave de negocio»** (área de la empresa, factor PESTEL, concepto y pregunta).
  3. Si están disponibles los modelos gratuitos de GitHub Models, redacta con IA los resúmenes de las noticias más relevantes.
  4. Publica la app + `news.json` en GitHub Pages.
- La app (`app/`) solo lee `news.json`: abre rápido, guarda noticias y funciona sin conexión.

## Actualizar a mano
Pestaña **Actions** → «Actualizar noticias y publicar» → **Run workflow**.

## Agregar o quitar fuentes
Edita `scripts/feeds.mjs`. Las reglas de la «Clave de negocio» están en `scripts/insights.js`.
