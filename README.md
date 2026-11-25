# FrontKit

FrontKit es una suite de herramientas front-end que se ejecuta en el navegador. El estado se guarda en IndexedDB. Genera CSS y clases Tailwind sin backend, cuentas, cookies ni telemetría.

## Herramientas

| Herramienta | Ruta | Estado |
| --- | --- | --- |
| Gradientes | `/tools/gradient` | Beta |
| Sombras | `/tools/shadow` | Beta |
| Bordes y radios | `/tools/border` | Beta |
| Playground, Layout, Paleta, Tokens, Transform, Filter, Animation y CSS Minifier | Catálogo | Planificadas |

Los generadores beta ofrecen vista previa, CSS y Tailwind, favoritos, presets y enlaces compartidos. `Ctrl/Cmd+K` abre la búsqueda global.

## Desarrollo

Usa Node 24.14.0 y la versión de pnpm fijada en `package.json`.

```sh
corepack enable
pnpm install
pnpm dev
```

La primera instalación debe generar `pnpm-lock.yaml`. Incorpóralo al repositorio para que la CI y los clones puedan usar `pnpm install --frozen-lockfile`.

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

El destino previsto es [franmatias.github.io/frontkit](https://franmatias.github.io/frontkit/). Selecciona **GitHub Actions** en la configuración de Pages. El flujo de `main` publica `dist/`. Las rutas directas devuelven el documento de la aplicación con estado HTTP 404 en Pages. Para un fork puedes ajustar `VITE_BASE`.

## Privacidad y licencia

Las preferencias y los estados se pueden exportar desde Configuración. Un enlace compartido incorpora el estado en el fragmento de la URL. Compartirlo hace visible ese estado a quien reciba el enlace.

Licencia [MIT](LICENSE). Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y el [estado de las pruebas técnicas](docs/decisions/0001-etapa-0.md).
