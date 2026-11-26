# FrontKit

FrontKit es una suite de herramientas front-end que se ejecuta en el navegador. El estado se guarda en IndexedDB. Genera CSS y clases Tailwind sin backend, cuentas, cookies ni telemetría.

## Herramientas

| Herramienta | Ruta | Estado |
| --- | --- | --- |
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

Los generadores beta ofrecen vista previa, CSS y Tailwind, favoritos, presets y enlaces compartidos. `Ctrl/Cmd+K` abre la búsqueda global.

El Playground actualiza la vista previa al editar HTML, CSS o JavaScript, permite cambiar la disposición, plegar los paneles y ajustar el ancho de los editores vecinos, evaluar JavaScript en la consola, guardar proyectos locales y exportar HTML o JSON. El editor incluye resaltado, números de línea y sugerencias de autocompletado para HTML, CSS, JavaScript y Emmet. Pulsa Tab para expandir abreviaturas Emmet en HTML y CSS. La integración de Monaco y sus workers sigue pendiente.

La etapa 5 incluye [JSON](./src/tools/json), el decodificador de JWT y URL, datos de prueba reproducibles, Lorem Ipsum con limpieza de texto, legibilidad, valores fluidos con `clamp()` y escalas tipográficas. Las etapas 6 a 11 aparecen como TODO.

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

La versión de producción instala una caché local para abrir el catálogo y las herramientas desde su ruta. Emmet y los workers se guardan la primera vez que se usan. Cuando hay una nueva versión, FrontKit muestra la opción Actualizar.

El minificador usa PostCSS en un worker y conserva las cadenas, las consultas y el orden de las capas. La opción de reestructuración elimina declaraciones idénticas consecutivas.
