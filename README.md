# FrontKit

FrontKit es una suite de herramientas front-end que se ejecuta en el navegador. El estado se guarda en IndexedDB. Genera CSS y clases Tailwind sin backend, cuentas, cookies ni telemetría.

## Herramientas

| Herramienta | Ruta | Estado |
| --- | --- | --- |
| Limpiador y conversor HTML | `/tools/html-cleaner` | Beta |
| Constructor de tablas HTML | `/tools/table-builder` | Beta |
| Open Graph y Meta Tags | `/tools/meta-tags` | Beta |
| Favicons e iconos PWA | `/tools/favicon` | Beta |
| Sprites de iconos SVG | `/tools/svg-sprite` | Beta |
| Optimizador SVG | `/tools/svg-optimizer` | Beta |
| Fondos y patrones | `/tools/backgrounds` | Beta |
| Recortes con clip-path | `/tools/clip-path` | Beta |
| Formas orgánicas | `/tools/blob` | Beta |
| Combinador de fuentes | `/tools/font-pairing` | Beta |
| Gradientes | `/tools/gradient` | Beta |
| Sombras | `/tools/shadow` | Beta |
| Bordes y radios | `/tools/border` | Beta |
| Playground | `/tools/playground` | Beta |
| Grid y Flexbox | `/tools/layout` | Beta |
| Paletas de color | `/tools/palette` | Beta |
| Tokens CSS | `/tools/tokens` | Beta |
| Transform | `/tools/transform` | Beta |
| Filtros CSS | `/tools/filter` | Beta |
| Animaciones CSS | `/tools/animation` | Beta |
| Minificador CSS | `/tools/css-minifier` | Beta |
| Convertidor CSS | `/tools/css-converter` | Beta |
| Convertidor BEM | `/tools/bem` | Beta |
| Organizador SMACSS | `/tools/smacss` | Beta |
| Simulador de sticky y apilamiento | `/tools/stacking` | Beta |
| Conversor de color | `/tools/color-converter` | Beta |
| Generador de CSS Reset | `/tools/css-reset` | Beta |
| Codificadores de texto | `/tools/encoders` | Beta |
| Transiciones y animaciones por scroll | `/tools/transitions` | Beta |
| Container Queries y @scope | `/tools/container-queries` | Beta |
| Optimizador de imágenes | `/tools/image-optimizer` | Beta |
| Auditor de accesibilidad HTML | `/tools/a11y-audit` | Beta |

Los generadores beta ofrecen vista previa, CSS y Tailwind, favoritos, presets y enlaces compartidos. `Ctrl/Cmd+K` abre la búsqueda global. La ilustración y el título de cada ficha abren su herramienta. El menú lateral muestra las categorías plegadas al inicio.

El Playground actualiza la vista previa al editar HTML, CSS o JavaScript, permite cambiar la disposición, plegar los paneles y ajustar el ancho de los editores vecinos, evaluar JavaScript en la consola, guardar proyectos locales y exportar HTML o JSON. El editor incluye resaltado, números de línea y sugerencias de autocompletado para HTML, CSS, JavaScript y Emmet. Pulsa Tab para expandir abreviaturas Emmet en HTML y CSS. Usa Formatear todo o el botón de cada panel para aplicar Prettier. El botón de Configuración de la cabecera permite cambiar el tema y el acento de la interfaz, su densidad, el movimiento y las opciones del editor. Hay diez temas de sintaxis, tres fuentes monoespaciadas y un control para mostrar los números de línea. Los proyectos incluyen plantillas interactivas con JavaScript y el editor se puede ampliar a pantalla completa. La integración de Monaco y sus workers sigue pendiente.

La etapa 5 incluye [JSON](./src/tools/json), el decodificador de JWT y URL, datos de prueba reproducibles, Lorem Ipsum con limpieza de texto, legibilidad, valores fluidos con `clamp()` y escalas tipográficas. El catálogo muestra el estado de cada herramienta.

Las etapas 6 y 7 incorporan fuentes, formas, SVG, favicons, metadatos y tablas. Las imágenes locales se abren en el navegador. Google Fonts y las imágenes remotas para metadatos requieren permiso antes de solicitar recursos externos.

El catálogo de fuentes versionado funciona sin API en tiempo de ejecución. Para actualizarlo, ejecuta `node scripts/google-font-catalog.mjs` con `FRONTKIT_GOOGLE_FONTS_KEY` en el entorno local.

El optimizador puede conservar perfiles ICC RGB al convertir entre PNG, JPEG y WebP. El ajuste es opcional y los datos EXIF se descartan tras aplicar la orientación.

El limpiador procesa el HTML localmente y usa DOMPurify como segunda capa. La extracción directa requiere CORS. Se puede elegir Jina Reader para recuperar el HTML renderizado, AllOrigins para recuperar el original o un proxy HTTPS propio que acepte el parámetro `url`. La dirección se envía al servicio elegido al pulsar el botón de extracción. El HTML queda en memoria por defecto y se puede recordar en este navegador desde Configuración. Los enlaces compartidos solo incluyen las opciones.

## Desarrollo

Usa Node 24.14.0 y la versión de pnpm fijada en `package.json`.

```sh
corepack enable
pnpm install
pnpm dev
```

El lockfile está versionado. Usa `pnpm install --frozen-lockfile` para reproducir la instalación de CI.

```sh
pnpm lint
pnpm typecheck
pnpm i18n:check
pnpm test --run
pnpm build
pnpm bundle:check
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

## Despliegue

El sitio se publica en [franmatias.github.io/frontkit](https://franmatias.github.io/frontkit/). El flujo de `main` publica `dist/`. Las rutas directas devuelven el documento de la aplicación con estado HTTP 404 en Pages. Para un fork puedes ajustar `VITE_BASE`.

## Privacidad y licencia

Las preferencias y los estados se pueden exportar desde Configuración. Un enlace compartido incorpora el estado en el fragmento de la URL. Compartirlo hace visible ese estado a quien reciba el enlace.

Licencia [MIT](LICENSE). Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y el [estado de las pruebas técnicas](docs/decisions/0001-etapa-0.md).

## Modo sin conexión

La versión de producción instala una caché local para abrir el catálogo y las herramientas desde su ruta. Emmet, los workers, los códecs de imagen y el motor de auditoría se guardan la primera vez que se usan. Cuando hay una nueva versión, FrontKit muestra la opción Actualizar.

El minificador usa PostCSS en un worker y conserva las cadenas, las consultas y el orden de las capas. La opción de reestructuración elimina declaraciones idénticas consecutivas.
