# FrontKit — Especificación Técnica y Funcional v2

*Suite modular de herramientas front-end, 100 % client-side, gratuita y de código abierto (MIT). Versión 2.0 — 25 de noviembre de 2026.*

- **Repositorio:** https://github.com/franmatias/frontkit
- **Despliegue:** https://franmatias.github.io/frontkit/ (único dominio previsto)
- **Idioma inicial:** español (es-ES), con i18n preparada desde el día 1
- **Modelo:** sin backend, sin telemetría, sin cookies; persistencia local en IndexedDB

## 0. Cómo leer este documento

- ⚠️ marca puntos escritos de memoria que deben verificarse contra la versión exacta fijada de cada dependencia durante los *spikes* de la Etapa 0 (sección 19).
- Las decisiones de la sección 1 son vinculantes; el resto desarrolla su implementación.
- «Definition of Done» (DoD) por herramienta en la sección 21.

## 1. Decisiones cerradas

| Tema | Decisión |
| --- | --- |
| Editor de código | **Monaco** (obligatorio) + `emmet-monaco-es`, carga diferida |
| Persistencia | **IndexedDB** (librería `idb`) para todo el estado de usuario; `localStorage` solo para un espejo mínimo del tema (anti-FOUC) |
| Rutas | **Inglés**, un patrón único: `/tools/<id>`, `/settings`, `/about` |
| Idiomas | **vue-i18n** desde el inicio; solo `es-ES` ahora, arquitectura lista para más |
| Linter/formatter | **Biome para todo**, incluidos `.vue` (con fallback documentado, sin ESLint) |
| Tailwind | **v4.x**, versión mínima fijada en **4.1** (necesaria para `text-shadow-*`) |
| Licencia | **MIT**; se aceptan contribuciones externas |
| Dominio | Solo `franmatias.github.io/frontkit/` |
| Móvil | Totalmente responsive; soporte «suficiente» (usable, no optimizado) |
| Compartir playground | Por fragmento `#s=` si cabe (límite 8.000 caracteres comprimidos); si no, exportar/importar archivo |
| Alcance ampliado | Entran `grid-template-areas`, salida responsive en Layout y APCA en Paleta |
| Sugerencias del análisis previo | Todas aceptadas e integradas en este documento |

## 2. Stack tecnológico

| Área | Tecnología | Notas |
| --- | --- | --- |
| Gestor de paquetes | pnpm | Campo `packageManager` en `package.json`, `pnpm/action-setup` en CI, lockfile estricto |
| Runtime | Node LTS vigente | `.nvmrc` y `engines` |
| Framework | Vue 3 (`<script setup lang='ts'>`) | Composition API exclusivamente |
| Lenguaje | TypeScript `strict: true` | `vue-tsc --noEmit` |
| Estado | Pinia | Stores tipados |
| Router | Vue Router 4 | `createWebHistory(import.meta.env.BASE_URL)` |
| i18n | vue-i18n (Composition API, `legacy: false`) | Locales cargados bajo demanda |
| Estilos | Tailwind CSS ≥ 4.1 (`@tailwindcss/vite`) | Tema claro/oscuro/sistema |
| Bundler | Vite | Code-splitting por herramienta |
| Calidad | Biome | Fijar versión exacta (sin `^`) |
| Tests unitarios | Vitest + `@vue/test-utils` + happy-dom + `fake-indexeddb` |  |
| Tests e2e | Playwright | Chromium (obligatorio) + WebKit/Firefox (smoke) |
| Editor | `monaco-editor` + `emmet-monaco-es` | Solo workers necesarios |
| Persistencia | `idb` | Wrapper tipado sobre IndexedDB |
| Validación | `valibot` | Esquemas de estado, URL, import y migraciones |
| Color | `culori` | Parseo, conversión HEX/RGB/HSL/OKLCH, interpolación, gamut, contraste |
| Resaltado de código | `highlight.js/core` | Registrar solo css, xml, javascript, json, scss; presupuesto ≤ 25 KB gzip ⚠️ |
| Minificación CSS | `csso` + `css-tree` | Ver 14.1; en Web Worker |
| Iconos | `lucide-vue-next` | Import explícito por icono, nunca por nombre dinámico |
| Compartir | `lz-string` | `compressToEncodedURIComponent` |
| Protección de bucles | `acorn` | Instrumentación del JS del playground |
| PWA (Etapa 4) | `vite-plugin-pwa` | Monaco fuera del precache |
| Actualización de deps | Dependabot (npm + GitHub Actions) | Agrupado semanalmente |

### 2.1 Biome y archivos `.vue` ⚠️

- El soporte de Vue en Biome es parcial y sus claves de configuración cambian entre versiones. **Spike obligatorio en Etapa 0** con la versión exacta fijada.
- Configuración objetivo: soporte HTML/Vue experimental activado, directivas de Tailwind v4 admitidas en el parser CSS y dominio Vue del linter activo.
- **Fallback aprobado:** un `override` para `**/*.vue` que desactive únicamente `noUnusedVariables` y `noUnusedImports`, delegando esas comprobaciones en `vue-tsc`. Si el formateo de `.vue` fuese inestable, excluir `.vue` del *formatter* y mantenerlo en el *linter*.
- No se introduce ESLint. Si el spike fallara por completo, se reabre la decisión (única excepción).

### 2.2 Tailwind v4: puntos de configuración

- `@import 'tailwindcss';` y `@custom-variant dark (&:where(.dark, .dark *));` para el modo oscuro por clase.
- Tokens de la propia app en `@theme`, con variables que cambian bajo `.dark`.
- Versión fijada con mínimo 4.1; las salidas Tailwind generadas por las herramientas se documentan como «Tailwind ≥ 4.1».

### 2.3 Reproducibilidad y repositorio

- Archivos obligatorios: `LICENSE` (MIT), `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, plantillas de issue/PR, `.nvmrc`, `.editorconfig`, `dependabot.yml`.
- Página `/about` con licencias y atribuciones de dependencias (generada en build con un script que lee el lockfile).

## 3. Arquitectura del core

### 3.1 Convención de identificadores

Un único `id` en kebab-case rige carpeta, ruta, clave de persistencia y clave i18n.

| id | Ruta | Carpeta |
| --- | --- | --- |
| `playground` | `/tools/playground` | `src/tools/playground/` |
| `gradient` | `/tools/gradient` | `src/tools/gradient/` |
| `shadow` | `/tools/shadow` | `src/tools/shadow/` |
| `border` | `/tools/border` | `src/tools/border/` |
| `layout` | `/tools/layout` | `src/tools/layout/` |
| `palette` | `/tools/palette` | `src/tools/palette/` |
| `tokens` | `/tools/tokens` | `src/tools/tokens/` |
| `transform` | `/tools/transform` | `src/tools/transform/` |
| `filter` | `/tools/filter` | `src/tools/filter/` |
| `animation` | `/tools/animation` | `src/tools/animation/` |
| `css-minifier` | `/tools/css-minifier` | `src/tools/css-minifier/` |

Otras rutas: `/` (catálogo), `/settings`, `/about`, y catch-all `/:pathMatch(.*)*` → vista 404.

### 3.2 Registro de herramientas (`src/core/registry.ts`)

Única fuente de verdad para sidebar, catálogo, Command Palette y rutas. Los textos **no** viven aquí: se referencian por clave i18n.

```ts
export type ToolCategory = 'code' | 'color-tokens' | 'layout' | 'effects' | 'animation' | 'optimization';
export type ToolStatus = 'available' | 'beta' | 'coming-soon';

export interface ToolDefinition {
  id: string;                      // 'gradient' (ver 3.1)
  category: ToolCategory;
  tags: string[];                  // claves i18n: tools.gradient.tags.*
  icon: Component;                 // import explícito de lucide-vue-next
  phase: '1a' | '1b' | 2 | 3 | 4;
  status: ToolStatus;
  featured: boolean;
  supportsTailwind: boolean;
  supportsShareUrl: boolean;       // playground: true con límite de tamaño (3.6)
  minViewport: 'mobile' | 'tablet' | 'desktop';  // aviso de usabilidad (sección 16.3)
  component: () => Promise<Component>;           // import() obligatorio
}
```

- Nombre, descripción y etiquetas se resuelven con `t('tools.<id>.name')`, `t('tools.<id>.description')`, etc.
- Test que verifica: ids únicos, ruta derivada del id, claves i18n existentes para todos los locales.
- Añadir una herramienta = carpeta en `src/tools/<id>/` + entrada en el registro + claves i18n.

### 3.3 Contrato de herramienta (`ToolLogic<S>`)

Todas las herramientas con generador exponen la misma interfaz, de modo que `ToolWorkspace`, el *share*, la persistencia, los presets y el historial sean genéricos.

```ts
export interface ToolLogic<S> {
  id: string;
  schemaVersion: number;
  defaultState: () => S;
  schema: GenericSchema<S>;                 // valibot
  migrate: (raw: unknown, fromVersion: number) => S;
  outputs: Record<string, (s: S) => string>; // { css, tailwind, html, json... }
  presets: Preset<S>[];
  random?: () => S;
}

export interface Preset<S> {
  id: string;
  nameKey?: string;   // presets incluidos (i18n)
  name?: string;      // presets del usuario
  state: S;
  builtin: boolean;
}
```

- `logic.ts` es **puro** (sin Vue, sin DOM) y es la unidad principal de test.
- Presets del usuario: guardables, renombrables, eliminables y exportables (se persisten por herramienta en IndexedDB).
- `useHistory<S>()`: deshacer/rehacer por herramienta (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), con *coalescing* de cambios continuos (arrastrar un slider = una entrada), 100 pasos como máximo.

### 3.4 Librerías internas transversales (desde Etapa 0)

- `src/lib/color/`: envoltorio sobre `culori`. Parseo, formateo (HEX/RGB/HSL/OKLCH), interpolación en distintos espacios, mapeo a gamut sRGB, luminancia, contraste **WCAG 2.1** y **APCA**, matrices de simulación de daltonismo y generación de escalas tonales. Tests *property-based* (ida y vuelta, rangos, idempotencia).
- `src/lib/tailwind/`: escape de valores arbitrarios (espacios → `_`, comas, paréntesis, colores con alfa, `%`, `/`), detección de utilidades estándar y *formatters* comunes. Es el mayor foco de bugs: cobertura completa.
- `src/lib/css/`: serialización común (formateo por capas, redondeo de decimales, colapso de valores iguales).
- `src/lib/a11y/`: utilidades de teclado/ARIA para controles personalizados.

### 3.5 Stores de Pinia (`src/stores/`)

- `useSettingsStore`: `theme` (`light` | `dark` | `system`), `locale`, `editor` (`fontSize`, `tabSize`, `wordWrap`, `minimap`, `autoRun`, `autoRunDelayMs`), `preferences` (`defaultColorFormat`, `defaultUnit`, `autoCopyOnClick`, `showTailwindByDefault`, `colorContrastMethod: 'wcag' | 'apca'`).
- `useToolsStore`: `favorites`, `recentTools` (últimas 8), `searchQuery`, `activeCategory`; getters `filteredTools`, `favoriteTools`, `featuredTools`, `availableTools`.
- `useNotificationsStore`: cola de toasts (el nombre del store, archivo y composable coinciden: `notifications`).
- **Hidratación:** `main.ts` hace `await hydrateStores()` (lectura de IndexedDB) antes de montar la app; si IndexedDB no está disponible, la app funciona en memoria y muestra un aviso persistente (modo navegación privada/bloqueo).

### 3.6 Capa de persistencia (`src/core/storage/`)

**Base de datos:** `frontkit` (IndexedDB) con `idb`, versión de esquema de BD con migraciones en `onupgradeneeded`.

| Object store | Clave | Contenido |
| --- | --- | --- |
| `kv` | `settings`, `favorites`, `recent` | Configuración y listas pequeñas |
| `toolStates` | `<tool-id>` | `{ schemaVersion, state, updatedAt }` último estado de cada generador |
| `userPresets` | `<tool-id>:<preset-id>` | Presets del usuario |
| `projects` | `<project-id>` | Proyectos del playground (`{ id, name, html, css, js, layout, createdAt, updatedAt, schemaVersion }`) |
| `handoff` | `inbox` | Datos enviados entre herramientas (Paleta → Tokens/Gradiente) |
| `meta` | `dbInfo` | Versión, fecha de última copia de seguridad, flag `playgroundRunning` |

Reglas:

- **Versionado:** cada registro lleva `schemaVersion`; `migrate()` de la herramienta lo actualiza al leer. Estado inválido o ilegible → valores por defecto + toast informativo (nunca romper la app).
- **Escrituras con *debounce*** (300 ms) y transacciones únicas por operación; cola de escritura serializada.
- **Errores:** capturar `QuotaExceededError` y fallos de apertura; avisar y ofrecer exportar datos. Solicitar `navigator.storage.persist()` al primer guardado relevante (con explicación en Configuración).
- **Sincronización entre pestañas:** `BroadcastChannel('frontkit')` notifica cambios; los stores se refrescan. Conflicto = *last write wins*, con aviso si la pestaña tiene cambios sin guardar en el playground.
- **Uso de almacenamiento:** `navigator.storage.estimate()` para la barra de Configuración, con desglose por store.
- **Exportar/Importar:** archivo `frontkit-backup-YYYY-MM-DD.json` con `{ app, backupVersion, exportedAt, data }`; importación con validación valibot, vista previa de lo que se va a sobrescribir y modo «combinar» o «reemplazar».
- **Prioridad de estado al abrir una herramienta:** URL compartida (`#s=`) > último estado guardado > valores por defecto. Un estado cargado desde enlace **no sobrescribe** el guardado hasta que el usuario edite; se muestra un banner «Estado cargado desde un enlace» con acciones *Conservar* / *Descartar*.
- **Espejo en `localStorage`:** únicamente `frontkit:theme` (valor del tema) para que el script anti-FOUC lo lea de forma síncrona; IndexedDB sigue siendo la fuente de verdad.
- Tests con `fake-indexeddb`: migraciones, JSON corrupto, cuota excedida simulada, import/export idempotente.

### 3.7 Compartir por URL sin backend (`useShareState.ts`)

- Formato: `…/tools/<id>#s=<payload>`. Se usa el **fragmento** (no se envía al servidor y admite más longitud). Vue Router lo expone en `route.hash`.
- Payload: JSON `{ v: <versión de payload>, t: <tool-id>, s: <estado> }` → `lz-string` `compressToEncodedURIComponent`.
- Al montar: descomprimir, validar con el esquema valibot de la herramienta, migrar si `v` es antiguo; si falla, estado por defecto + toast de error (nunca excepción).
- **Seguridad:** parseo con `JSON.parse` + eliminación de claves `__proto__`, `constructor` y `prototype` en cualquier *merge*; el esquema rechaza propiedades desconocidas.
- **Exclusiones:** datos no serializables o voluminosos (imagen local de Filter, archivos de Minifier).
- El enlace se genera **solo al pulsar «Compartir enlace»** (no se actualiza el hash en cada cambio, para no contaminar el historial). Se copia al portapapeles con toast.
- **Playground:** comparte HTML+CSS+JS+layout si el payload comprimido ≤ **8.000 caracteres**. Si lo supera, el diálogo explica el límite y ofrece **Exportar .html autocontenido** o **Exportar proyecto .json** (importable desde el gestor de proyectos).
- Tests: compresión/descompresión idempotente, enlaces truncados o dañados, versión desconocida, claves peligrosas.

### 3.8 Internacionalización (`vue-i18n`)

- Composition API (`useI18n`), `legacy: false`, locale por defecto y de *fallback* `es-ES`.
- Mensajes modulares: `src/i18n/locales/es-ES/common.json` + un archivo por herramienta `src/tools/<id>/locales/es-ES.json`, ensamblados con `import.meta.glob` y cargados bajo demanda por locale y por herramienta.
- **Reglas:** ninguna cadena visible hardcodeada en plantillas o stores; claves jerárquicas (`tools.gradient.controls.angle`); pluralización y formato numérico/fecha vía `Intl`/vue-i18n; los códigos generados (CSS, Tailwind, HTML) **nunca** se traducen.
- `<html lang>` y `document.title` se actualizan al cambiar de locale.
- Script `pnpm i18n:check` (en CI): detecta claves faltantes, huérfanas o inconsistentes entre locales, y llamadas `t()` con claves inexistentes.
- El selector de idioma aparece en Configuración, deshabilitado mientras solo exista `es-ES`.
- Monaco: la UI de Monaco se mantiene en inglés en v1 (los mensajes de Monaco requieren paquetes de idioma aparte); documentado como limitación conocida.

### 3.9 Enrutamiento, 404 y despliegue en GitHub Pages

- `createWebHistory(import.meta.env.BASE_URL)`; `base` en `vite.config.ts` = `process.env.VITE_BASE ?? (mode === 'production' ? '/frontkit/' : '/')` (permite forks sin tocar código).
- Build: copiar `dist/index.html` → `dist/404.html`. Trade-off documentado: los deep links responden HTTP 404 (con el contenido de la SPA), aceptable al ser una app sin SEO de contenido. Alternativa descartada: `createWebHashHistory`.
- **Resiliencia a despliegues:** escuchar `vite:preloadError`; ante fallo de carga de chunk, recargar **una sola vez** (guardia en `sessionStorage`) y mostrar aviso si persiste.
- `onErrorCaptured` + componente `ToolErrorBoundary` por herramienta: muestra error, botón *Reintentar* y *Restablecer estado de esta herramienta*.

### 3.10 Tema y anti-FOUC

- Script inline en `index.html` que lee `localStorage['frontkit:theme']` y `matchMedia`, y aplica `.dark` en `<html>` antes del primer pintado.
- `useTheme` mantiene sincronía con `matchMedia('(prefers-color-scheme: dark)')` en modo `system`, y con el store.

### 3.11 Interfaz global y componentes compartidos

- **Sidebar:** Inicio/Catálogo, Configuración, Acerca de; bloque Favoritos; herramientas por categoría; colapsable en escritorio, *drawer* en móvil/tablet.
- **Header:** título y categoría; botón de búsqueda (Ctrl/Cmd+K); cambio de tema; enlace a GitHub.
- **Command Palette:** patrón ARIA *dialog + combobox + listbox*; búsqueda **insensible a acentos y mayúsculas** (`normalize('NFD')`); resultados agrupados (Herramientas, Acciones, Recientes); **acciones**: cambiar tema, exportar datos, restablecer herramienta actual, copiar salida, compartir enlace; navegación ↑/↓/Enter/Esc con *focus trap* y retorno de foco.
- **HomeView:** buscador, filtros por categoría, «Solo favoritos», «Con salida Tailwind»; tarjetas con icono, badges (Tailwind, Beta, Próximamente) y favorito.
- **SettingsView:** Apariencia, Idioma, Editor, Preferencias de generadores, Almacenamiento (barra de uso, exportar, importar, limpiar caché de herramientas, restablecer de fábrica con confirmación).
- **AboutView:** descripción, licencia MIT, política de privacidad («sin telemetría ni cookies; todo se queda en tu navegador»), atribuciones, versión y enlace al repositorio.
- **ToolWorkspace.vue:** barra de herramientas (Presets, Aleatorio, Deshacer/Rehacer, Restablecer, Compartir, Favorito), controles, preview con selector de fondo (blanco, oscuro, ajedrez, personalizado) y aviso de compatibilidad (`CSS.supports`) cuando el navegador no soporte lo previsualizado (OKLCH, `color-mix`, `@property`).
- **CodeOutputPanel.vue:** pestañas dinámicas (CSS, Tailwind, HTML, JSON…), resaltado con `highlight.js/core`, copiar, descargar y contador de líneas/caracteres. Región `aria-live` para confirmar la copia.

## 4. Playground HTML / CSS / JS

**Ruta:** `/tools/playground` · **Categoría:** `code` · **Etapa:** 1b · **Uso recomendado:** tablet o escritorio (en móvil se fuerza el layout de pestañas).

### 4.1 Carga de Monaco

- `monaco-editor` y `emmet-monaco-es` se cargan **solo** con `import()` dinámico al entrar en la ruta, en un chunk aparte.
- Importar la API de Monaco y únicamente los lenguajes y contribuciones necesarios (HTML, CSS, JavaScript) en lugar del paquete completo ⚠️.
- Workers con la sintaxis nativa de Vite (`new Worker(new URL(...), { type: 'module' })`) para `editor.worker`, `html.worker`, `css.worker` y `ts.worker` (este último da el autocompletado de JavaScript). Definir `self.MonacoEnvironment.getWorker` por *label*. Sin `json.worker`.
- Verificar en el despliegue real de GitHub Pages que las URLs de los workers respetan `base: '/frontkit/'` (criterio de aceptación de la Etapa 1b).
- Registrar `emmetHTML`, `emmetCSS` y `emmetJSX` antes de crear los editores; **verificar compatibilidad** de `emmet-monaco-es` con la versión de Monaco fijada ⚠️ (spike).
- Mientras carga: *skeleton* con indicador accesible; si falla, mensaje de error con *Reintentar*.

### 4.2 Editores

- Tres modelos independientes (HTML, CSS, JS; sin preprocesadores en v1).
- Resaltado, numeración, plegado, autocompletado, emparejamiento, *Format Document*, Emmet con Tab.
- Configuración sincronizada con `useSettingsStore` (fuente, tabulación, *word wrap*, minimapa, tema `vs` / `vs-dark`).
- Los editores se destruyen (`dispose`) al salir de la ruta para liberar memoria.

### 4.3 Previsualización y seguridad

- `<iframe sandbox='allow-scripts allow-modals allow-forms'>` **sin** `allow-same-origin`: el origen es opaco y el código del usuario no puede acceder a IndexedDB, `localStorage` ni cookies de FrontKit.
- `srcdoc` generado con HTML + `<style>` + `<script>`. El JS del usuario se escapa para que `</script>` no rompa el documento y se envuelve en `try/catch` que reporta errores a la consola.
- **CSP:** FrontKit no define CSP por `<meta>` en el documento padre, porque los `srcdoc` la heredarían y romperían el código del usuario (por ejemplo, estilos o scripts en línea). Decisión explícita y documentada en `SECURITY.md`. El aislamiento se basa en el *sandbox*. ⚠️
- Ejecución: automática con *debounce* configurable (350 ms por defecto) o manual (botón Ejecutar / Ctrl+Enter).

### 4.4 Consola integrada

- Script puente inyectado en el iframe que intercepta `console.log/info/warn/error/clear`, `window.onerror` y `unhandledrejection`.
- Mensajes por `postMessage` al padre. En el padre se valida `event.source === iframe.contentWindow` y un **nonce** de sesión incluido en cada mensaje (en un *sandbox* sin `allow-same-origin` el `event.origin` es `'null'` y no sirve como validación).
- Serialización segura en el iframe: objetos con profundidad y tamaño limitados, detección de referencias circulares, errores con `name/message/stack`, nodos DOM como `<tag#id.class>`, funciones, `Symbol`, `BigInt`, `undefined`.
- Límite de mensajes (por ejemplo, 1.000 entradas con rotación) y de frecuencia para evitar saturar el padre.
- Panel inferior colapsable con contadores de errores/avisos, filtro por nivel, búsqueda y botón Limpiar. Región `aria-live` política *polite* para errores.

### 4.5 Protección frente a bucles infinitos

- **Instrumentación** del JS del usuario con `acorn`: se inserta un contador en `for`, `while` y `do...while`; al superar un umbral de tiempo o iteraciones se lanza un error controlado («Bucle posiblemente infinito detectado»). Opción desactivable en Configuración.
- **Guardia de arranque:** antes de ejecutar se escribe `meta.playgroundRunning = true` en IndexedDB y se borra al recibir el mensaje `ready` del iframe. Si al abrir el playground el *flag* sigue activo (la pestaña se congeló), **no se autoejecuta** el proyecto y se muestra un aviso con botón *Ejecutar de todos modos*.
- Si falla el *parseo* de `acorn` (sintaxis no soportada), se ejecuta sin instrumentar y se informa.

### 4.6 Layout y proyectos

- Layouts conmutables: **Columnas**, **Lateral** y **Pestañas**, con divisores redimensionables por arrastre y por teclado (flechas, con `role='separator'` y `aria-valuenow`).
- Gestor de proyectos en IndexedDB: autoguardado de la sesión actual, nuevo, guardar con nombre, duplicar, renombrar, eliminar, **exportar .html autocontenido**, **exportar/importar .json**.
- Plantillas: En blanco, Tarjeta animada, Grid básico, Contador JS.
- Compartir: ver 3.7 (fragmento si cabe; si no, archivo).
- Atajos: Ctrl/Cmd+Enter ejecutar, Ctrl/Cmd+S guardar, Ctrl/Cmd+Shift+F formatear.

## 5. Generador de Gradientes CSS

**Ruta:** `/tools/gradient` · **Categoría:** `color-tokens` · **Etapa:** 1a

### 5.1 Estado

- `type`: `linear | radial | conic`; `repeating`: boolean.
- `interpolation`: `default | srgb | oklab | oklch | hsl | lab | lch` + `hueMethod` (`shorter | longer | increasing | decreasing`) para espacios polares. Por defecto `oklab` (mejor degradado sin «zonas grises»).
- `angle` (0–360; en conic es `from`), `radialShape`, `radialSize`, `position {x,y}`.
- `stops`: `{ id, color, opacity, position, position2? }` — `position2` permite **hard stops** (dos posiciones para el mismo color). Mínimo 2.
- `hints`: array de *color hints* (punto medio de transición entre dos paradas, en %).

### 5.2 Controles

- Tipo, toggle Repetir, selector de espacio de interpolación con vista previa comparativa.
- Barra de stops interactiva (arrastrar, clic para añadir con color interpolado, selección, edición de color/opacidad/posición, eliminar, invertir, distribuir). **Alternativa por teclado:** cada marcador es un `role='slider'` focuseable (flechas ±1 %, Shift ±10 %, Supr elimina, Enter edita).
- Dial circular para el ángulo (con campo numérico equivalente y atajos 0/45/90/135/180). Pad XY para el centro (con inputs numéricos y flechas).
- Aviso si `CSS.supports` indica que el espacio de interpolación elegido no está soportado.
- Botón «Usar colores de Paleta» (lee el *handoff*, ver 15).

### 5.3 Salidas

- **CSS:** `background: linear-gradient(in oklch 135deg, ...)`; con opción `background-clip: text` + `color: transparent`.
- **Tailwind ≥ 4.1:** `bg-linear-to-r`, `bg-linear-<ángulo>`, `bg-radial`, `bg-conic` con modificador de interpolación (`/oklch`) y `from-*/via-*/to-*` cuando hay ≤ 3 paradas simples sin hard stops, hints ni alfa; en caso contrario, sintaxis arbitraria exacta `bg-[linear-gradient(...)]` pasando por `lib/tailwind`. ⚠️ Verificar los nombres de utilidades contra la versión fijada.
- Presets: Sunset, Ocean Blue, Aurora Boreal, Neon Cyber, Soft Pastel, Dark Mesh. Aleatorio: armonías generadas en OKLCH.

## 6. Generador de Text-Shadow y Box-Shadow

**Ruta:** `/tools/shadow` · **Categoría:** `effects` · **Etapa:** 1a

- **Estado:** `mode` (`box | text`), `layers[]` (`enabled, inset, offsetX, offsetY, blur, spread, color, opacity`), `previewConfig` (fondo, color del elemento, color del texto, radio, texto de muestra, forma `square | card | circle`).
- **Controles:** multicapa (añadir, duplicar, reordenar con botones y arrastre, visibilidad, eliminar), sliders con campo numérico: Offset X/Y (−100 a 100), Blur (0–150), Spread (−50 a 100, solo box), color y opacidad, Inset (solo box). Cambiar de modo conserva las capas compatibles.
- **CSS:** `box-shadow` / `text-shadow` formateado por capas; capas desactivadas se omiten.
- **Tailwind:** detección contra la escala **v4** (`shadow-2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` y sus equivalentes `inset-shadow-*` y `text-shadow-*` de 4.1) comparando valores normalizados; si no hay coincidencia, `shadow-[...]` / `text-shadow-[...]` arbitrario. ⚠️ Verificar los valores exactos de cada escalón en la versión fijada; el test de compilación real (sección 18) lo comprueba.
- **Presets:** Elevación suave (niveles 1–4), Neumorfismo claro/oscuro, Brutalismo, Glow neón, Tarjeta flotante.

## 7. Generador de Border y Border-Radius

**Ruta:** `/tools/border` · **Categoría:** `effects` · **Etapa:** 1a

- **Estado:** `border` (vinculado o por lado: ancho, estilo, color, opacidad), `radius` (modo `simple | organic`, unidad `px | % | rem`, 4 esquinas u 8 radios), `outline` (activar, ancho, estilo, color, offset).
- **Orden documentado y testeado:** `border-radius: TL TR BR BL / TL TR BR BL` (horizontales / verticales), por lo que los 8 valores del modo orgánico se serializan como `tlh trh brh blh / tlv trv brv blv`.
- **Controles:** candado de lados; ancho 0–32 px; estilos `solid, dashed, dotted, double, groove, ridge, inset, outset, none`; modo orgánico con tiradores arrastrables sobre el canvas (y 8 inputs numéricos como alternativa de teclado); outline con offset −20 a 40 px.
- **CSS:** colapsa a `border:` y `border-radius:` en una línea cuando los valores coinciden; si no, desglosa solo lo necesario.
- **Tailwind:** clases por lado (`border-t-2`, `border-x-4`…), `border-dashed`, color con alfa (`border-black/50`), `rounded-*` estándar o `rounded-[...]` arbitrario con `lib/tailwind`; outline (`outline-2 outline-offset-4`).
- **Presets:** Pill, Tarjeta estándar, Círculo, Blob orgánico, Marco doble retro.

## 8. Generador Visual de CSS Grid y Flexbox

**Ruta:** `/tools/layout` · **Categoría:** `layout` · **Etapa:** 2

### 8.1 Estado

- `system`: `flex | grid`; `flexContainer` (dirección, *wrap*, `justify-content`, `align-items`, `align-content`, gaps, unidad); `gridContainer` (columnas/filas como `TrackDefinition[]`, gaps, `autoFlow`, alineaciones `justify/align/place-items` y `place-content`, y **`areas`**).
- `TrackDefinition`: `{ value, unit: 'fr' | 'px' | '%' | 'auto' | 'min-content' | 'max-content' | 'minmax' | 'repeat-auto', min?, max?, repeatMode?: 'auto-fit' | 'auto-fill' }` para soportar `repeat(auto-fit, minmax(200px, 1fr))`.
- `areas`: matriz de nombres sobre la rejilla (`grid-template-areas`). Cada ítem puede asignarse a un área (`grid-area`) en lugar de usar líneas/spans.
- `items[]`: `flexGrow, flexShrink, flexBasis, alignSelf, order, colStart, colSpan, rowStart, rowSpan, justifySelf, placeSelf, area`.
- `responsive`: `{ enabled, breakpoints: { base, sm?, md?, lg? } }` donde cada breakpoint contiene **sobreescrituras parciales** del contenedor y de los ítems. El viewport del preview (`full | desktop 1024 | tablet 768 | mobile 375`) selecciona qué breakpoint se edita.

### 8.2 Controles

- Selector Flex/Grid; inspector con pestañas Contenedor / Ítem seleccionado (clic en caja del preview).
- Grid: constructor de pistas (añadir/eliminar, editar, `repeat(N, 1fr)`, `auto-fit/auto-fill`), editor visual de **áreas** (pintar celdas con nombre) y span por ítem.
- Flex: iconos de eje que rotan con `flex-direction`.
- Canvas: añadir/eliminar ítem, guías y numeración, **arrastrar para reordenar ítems** (con alternativa de teclado: seleccionar + Alt+flechas) y para redimensionar *spans*.

### 8.3 Salidas

- **HTML + CSS nativo:** clases `.container` e `.item-*` solo para ítems con estilos propios; si `responsive.enabled`, CSS *mobile-first* con `@media (min-width: ...)`.
- **HTML + Tailwind:** `flex`, `flex-col`, `justify-between`, `grid`, `grid-cols-3`, `gap-4`, `col-span-2`; prefijos responsive `sm:`, `md:`, `lg:` según los breakpoints; valores arbitrarios `[...]` solo si no existe utilidad estándar; `grid-template-areas` como `grid-areas-[...]`/arbitrario ⚠️ (verificar soporte en la versión fijada; si no existe, emitir `[grid-template-areas:'a_b']`).
- Presets: Holy Grail, Bento Grid, Navbar + Acciones, Galería responsive, Sidebar + Main, Centrado perfecto.

## 9. Generador de Paletas de Color

**Ruta:** `/tools/palette` · **Categoría:** `color-tokens` · **Etapa:** 2

- **Estado:** `mode` (`harmony | scale`), `baseColor`, `harmonyType` (complementary, analogous, triadic, tetradic, split-complementary, monochromatic), `swatches[]` (`id, name, color, locked`), `colorBlindnessPreview`, `contrastMethod` (`wcag | apca`).
- **Generación en OKLCH** (luminosidad perceptual uniforme), con mapeo a gamut sRGB para la salida HEX; la salida puede darse también en `oklch()`.
- **Armonías:** 3–10 colores; escala tonal de 11 pasos (50–950) con curva de luminosidad configurable.
- **Controles:** color base (picker + HEX/RGB/HSL/OKLCH), aleatorio (barra espaciadora o botón) respetando bloqueados, edición de L/C/H por color, reordenar y renombrar tokens, copiar con un clic.
- **Contraste:** matriz texto/fondo con ratio **WCAG 2.1** (AA/AAA normal y grande) y, en modo APCA, valor **Lc** con indicación del tamaño/peso de fuente recomendado ⚠️ (verificar versión y constantes del algoritmo APCA-W3).
- **Daltonismo:** protanopia, deuteranopia, tritanopia y acromatopsia sobre las tarjetas de muestra (matrices en `lib/color`).
- **Salidas:** CSS variables, Tailwind v4 `@theme { --color-brand-50: ... }`, JSON, SCSS.
- **Integración:** «Enviar a Tokens» y «Enviar a Gradiente» (sección 15).

## 10. Generador de Tokens CSS

**Ruta:** `/tools/tokens` · **Categoría:** `color-tokens` · **Etapa:** 2

### 10.1 Estado

- `prefix` (por ejemplo `fk`, o vacío).
- `colors`: `primary, secondary, accent, background, surface, text, textMuted, border, success, warning, error, info`. **Cada color tiene variante `light` y `dark` obligatorias** (no opcionales); al crear uno nuevo se propone una variante oscura derivada automáticamente en OKLCH.
- `typography`: `fontSans`, `fontMono`, `baseSizePx`, `scaleRatio`, `lineHeightBody`, `lineHeightHeading`, y `fluid: { enabled, minViewportPx, maxViewportPx, minScaleRatio, maxScaleRatio }` para tipografía fluida con `clamp()`.
- `spacing`: `basePx` y `steps: number[]` donde **cada paso es un multiplicador de `basePx`** (por ejemplo `[0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]`), nombrado `1…n`.
- `radii` (`sm, md, lg, full`) y `shadows` (`sm, md, lg`), con opción de importarlas desde las herramientas Shadow y Border (sección 15).

### 10.2 Controles y preview

- Editor lateral en acordeones/pestañas: Colores, Tipografía, Espaciado, Radios y elevación.
- UI Kit interactivo (botones primario/secundario/outline/deshabilitado, tarjeta, inputs, badges, alertas) que consume las variables generadas en vivo, con conmutador Light/Dark. El UI Kit se aloja en un contenedor con *scope* de variables para no afectar a la app.
- Indicador de contraste (WCAG/APCA según preferencia) para los pares `text/background`, `text/surface` y `primary/background`.

### 10.3 Salidas

- **CSS:** `:root { ... }` y `[data-theme='dark'] { ... }` (opcionalmente `@media (prefers-color-scheme: dark)`).
- **Tailwind v4:** bloque `@theme { ... }` con espacios de nombres estándar (`--color-*`, `--font-*`, `--text-*`, `--spacing`, `--radius-*`, `--shadow-*`) y variante oscura mediante `.dark`.
- **JSON:** formato **W3C Design Tokens (DTCG)** con claves `$value`, `$type` y `$description`; grupos anidados.
- **SCSS:** variables y mapas.
- Presets: Minimal Slate, Vibrant SaaS, Editorial Serif, High Contrast.

## 11. Generador de CSS Transform

**Ruta:** `/tools/transform` · **Categoría:** `effects` · **Etapa:** 3

- **Estado:** `mode` (`2d | 3d`); `translateX/Y/Z` (px o %); `rotate`, `rotateX/Y/Z` (deg); `scaleX/Y/Z` con `lockAspect`; `skewX/Y`; `perspective`; `perspectiveOrigin`; `transformOrigin` (X/Y/Z); `transformStyle` (`flat | preserve-3d`); `backfaceVisibility` (`visible | hidden`); y **`order`**: lista ordenable de las funciones activas, porque el orden de las funciones de `transform` altera el resultado (se documenta en la UI con un aviso y se refleja en el CSS).
- **Controles:** sliders con campo numérico y botón de reset a valor neutro; matriz 3×3 para `transform-origin`; lista de funciones reordenable por arrastre y con botones subir/bajar.
- **Preview:** elemento fantasma punteado en la posición original, punto de `transform-origin`, rejilla de perspectiva opcional en 3D.
- **Salidas:** CSS (`transform`, `transform-origin`, `perspective`, `perspective-origin`, `transform-style`, `backface-visibility`) y Tailwind: `translate-*`, `rotate-*`, `scale-*`, `skew-*`, `origin-*`, y las utilidades 3D de v4 (`rotate-x-*`, `rotate-y-*`, `translate-z-*`, `perspective-*`, `transform-3d`, `backface-hidden`) ⚠️ verificar nombres en la versión fijada. Si el orden de funciones no coincide con el orden fijo con que Tailwind compone la transformación, se emite `transform-[...]` arbitrario y se avisa.

## 12. Generador de CSS Filter

**Ruta:** `/tools/filter` · **Categoría:** `effects` · **Etapa:** 3

- **Estado:** `target` (**`filter | backdrop-filter`**), `blur`, `brightness`, `contrast`, `grayscale`, `hueRotate`, `invert`, `opacity`, `saturate`, `sepia`, `dropShadow` (solo en `filter`), `sampleImage` (`landscape | portrait | svg-transparent | custom`).
- **Funcionamiento:** solo se emiten los filtros que difieren del valor neutro. En modo `backdrop-filter` el preview coloca el elemento sobre un fondo con detalle (imagen/patrón) y el elemento semitransparente.
- **Imagen local:** `URL.createObjectURL`, nunca sale del navegador; no se persiste ni se incluye en el enlace de compartir (se muestra aviso).
- **Comparador antes/después** con divisor arrastrable y accesible por teclado (`role='slider'`).
- **Salidas:** CSS y Tailwind (`blur-*`, `brightness-*`, `backdrop-blur-*`, `backdrop-saturate-*`… o `filter-[...]` / `backdrop-filter-[...]`).
- Presets: Vintage, Noir B&N, Cyberpunk, Cálido, **Cristal esmerilado** (usa `backdrop-filter` y activa ese objetivo automáticamente).

## 13. Generador de Animaciones CSS

**Ruta:** `/tools/animation` · **Categoría:** `animation` · **Etapa:** 3

- **Estado:** `name`, `duration`, `delay`, `iterationCount`, `direction`, `fillMode`, `playState` (`running | paused`), `timing` (`{ kind: 'preset' | 'cubic-bezier' | 'steps' | 'linear', ... }`) y `keyframes[]` (`id`, `percentage`, props: `translateX/Y`, `rotate`, `scale`, `opacity`, `backgroundColor?`, `borderRadius?`).
- **Funciones de timing:** presets (`ease`, `ease-in-out`…), **`cubic-bezier()`** editable en SVG con dos tiradores, **`steps(n, jump-*)`** y **`linear()`** para efectos tipo muelle/rebote (generador de paradas a partir de una curva de muelle con parámetros de masa/rigidez/amortiguación).
- **Timeline:** clic para crear fotogramas, arrastrar para cambiar el porcentaje, edición de propiedades; alternativa por teclado (focus + flechas, Supr, Enter).
- **Barra de reproducción:** Play/Pause/Reiniciar, velocidad 0.5×/1×/2×, elemento de prueba (cuadrado, botón, texto, icono).
- **`prefers-reduced-motion`:** el preview respeta la preferencia del sistema (con control para forzar la reproducción) y **toda salida incluye opcionalmente el snippet** `@media (prefers-reduced-motion: reduce) { .animate-x { animation: none; } }`, activado por defecto.
- **Salidas:**
  - **CSS:** `@keyframes <name> { ... }` + clase `.animate-<name>`.
  - **Tailwind v4:** en v4 los `@keyframes` **se declaran dentro del bloque `@theme`** junto con la variable `--animate-<name>`; la salida es un único bloque `@theme { --animate-<name>: <name> 1s ease-in-out infinite; @keyframes <name> { ... } }` listo para pegar en el CSS principal, más el uso `animate-<name>` y la variante `motion-reduce:animate-none`. ⚠️
- Presets: Fade In Up, Bounce, Pulse, Shake, Spin, Float.

## 14. Limpieza y Minimización de CSS

**Ruta:** `/tools/css-minifier` · **Categoría:** `optimization` · **Etapa:** 3

### 14.1 Motor

- **Minificar:** `csso` (opciones `restructure`, eliminación de comentarios y reglas vacías). Se ejecuta en un **Web Worker** para no bloquear la UI, con límite de entrada configurable (por defecto 2 MB) y cancelación.
- **Limpiar/Formatear:** `csso` **no incluye formateador con indentación configurable** ⚠️. Se implementa con `css-tree` (parseo a AST) y un *printer* propio (indentación 2/4 espacios, una declaración por línea, saltos entre reglas, comentarios opcionales). Se conserva el CSS moderno (anidamiento, `@layer`, `@container`) tal cual lo parsea `css-tree`.
- **Spike (Etapa 0):** comparar este enfoque con `lightningcss-wasm` (soporte de *nesting* moderno y minificación); elegir uno y documentar el motivo (tamaño del chunk, fidelidad y errores).

### 14.2 Estado y UI

- Estado: `inputCss`, `mode` (`minify | clean`), `options` (`removeComments`, `restructure`, `removeEmptyRules`, `indentSize`).
- Entrada por pegado o arrastrar un `.css` (con *drop zone* accesible y botón «Seleccionar archivo» equivalente); lectura local.
- Métricas en vivo: tamaño original/final, % ahorrado, tiempo de proceso; errores de sintaxis con **línea y columna** y salto a la posición en el editor de entrada.
- Salida: copiar y descargar `.min.css` / `.clean.css`. Los editores de entrada/salida reutilizan Monaco (carga diferida) o `<textarea>` si el usuario no lo necesita en móvil.
- Los archivos no se persisten en IndexedDB (solo opciones y modo).

## 15. Integración entre herramientas (*handoff*)

- Almacén `handoff.inbox` en IndexedDB con `{ from, to, kind, payload, createdAt }` (caduca a las 24 h; se valida con esquema).
- Flujos soportados: Paleta → Tokens (colores y escala), Paleta → Gradiente (paradas), Sombras/Bordes → Tokens (`shadows`, `radii`).
- UI: botón «Enviar a…» en la herramienta origen y banner «Importar desde Paleta» en la herramienta destino con vista previa del contenido; nunca se aplica automáticamente.

## 16. Requisitos transversales

### 16.1 Accesibilidad (desde la Etapa 0)

- Objetivo: **WCAG 2.2 nivel AA**.
- Todos los controles personalizados (dial, barra de stops, pad XY, editor Bézier, timeline, divisores, comparador) tienen **alternativa por teclado y roles/atributos ARIA definidos en su diseño**, no a posteriori.
- Foco visible, orden lógico, *focus trap* en diálogos y Command Palette, restauración de foco, `aria-live` para confirmaciones (copiar, compartir, errores).
- Respeto de `prefers-reduced-motion` y `prefers-color-scheme`; contraste mínimo AA en toda la UI propia (validado en el tema claro y oscuro).
- Componentes base reutilizables en `src/lib/a11y/` (slider personalizado, 2D pad, lista reordenable) con tests de teclado.
- Auditoría con `axe` en los tests e2e para cada herramienta (sin violaciones serias).

### 16.2 Compatibilidad de navegadores

- Soportados: versiones modernas de Chrome/Edge, Firefox y Safari que cumplan el mínimo de Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+) ⚠️ verificar contra la versión fijada.
- Detección de características con `CSS.supports` (OKLCH, `color-mix`, `@property`, `backdrop-filter`, `linear()`); si el navegador no soporta lo que se previsualiza, aviso no bloqueante en el preview. La salida de código no se ve afectada.
- Sin navegadores antiguos ni IE; Playwright cubre Chromium, Firefox y WebKit en pruebas de humo.

### 16.3 Soporte móvil y responsive

La aplicación es **totalmente responsive**; el uso móvil se considera «suficiente» (todo es usable, sin optimizar la experiencia táctil de edición avanzada).

| Herramienta | Móvil | Tablet/Escritorio |
| --- | --- | --- |
| Catálogo, Configuración, Acerca de | Completo | Completo |
| Gradiente, Sombras, Bordes, Transform, Filter | Controles apilados sobre el preview; salida en pestaña inferior | Dos columnas |
| Paleta, Tokens | Acordeones y UI Kit apilado | Dos columnas |
| Layout | Usable, canvas con scroll; arrastre limitado (se prioriza el inspector) | Completo |
| Animation | Timeline con scroll horizontal | Completo |
| CSS Minifier | Usable con `<textarea>` | Completo |
| Playground | Solo layout Pestañas; aviso «Mejor en pantalla grande» | Completo |

- Objetivos táctiles mínimos de 24×24 px (WCAG 2.2) en controles; arrastre con *pointer events* (`setPointerCapture`), sin depender de *hover*.
- `minViewport` del registro alimenta el aviso de usabilidad.

### 16.4 Rendimiento (presupuestos)

- JS inicial (shell + vendor + i18n común): **≤ 150 KB gzip**.
- Chunk de cada herramienta (sin compartidos): **≤ 60 KB gzip**; Monaco y sus workers **nunca** en el chunk inicial.
- LCP del catálogo < 2,5 s en perfil móvil de Lighthouse; CLS < 0,1; sin *long tasks* > 200 ms al mover controles (cálculos pesados en Worker o con `requestAnimationFrame`).
- Verificación en CI mediante script de tamaño de *bundle* (falla si se excede) y Lighthouse CI (Etapa 4).

### 16.5 Privacidad y seguridad

- Sin telemetría, analíticas, cookies ni peticiones a terceros en tiempo de ejecución (sin CDNs: fuentes y recursos autoalojados).
- Política visible en `/about` y `README`; `SECURITY.md` con proceso de reporte.
- Todo dato externo (hash de compartir, importación de backup, `handoff`, archivos) se valida con esquemas antes de usarse; nunca se usa `v-html` con contenido del usuario.
- Aislamiento del código de usuario únicamente en el *sandbox* del playground (sección 4.3).

## 17. Estructura de carpetas

```text
frontkit/
├── .github/
│   ├── workflows/ci.yml, deploy.yml
│   ├── dependabot.yml
│   └── ISSUE_TEMPLATE/, PULL_REQUEST_TEMPLATE.md
├── e2e/                      # Playwright (deep link 404, share URL, playground, axe)
├── public/favicon.svg
├── scripts/                  # i18n-check, bundle-size, licenses (about), copy-404
├── src/
│   ├── assets/main.css       # @import 'tailwindcss'; @custom-variant dark; @theme
│   ├── components/
│   │   ├── layout/ (AppShell, SidebarNav, TopHeader, CommandPalette)
│   │   ├── shared/ (ToolWorkspace, CodeOutputPanel, ToolErrorBoundary,
│   │   │            ColorPickerInput, RangeSlider, Pad2D, SortableList, ShareDialog)
│   │   └── ui/ (BaseButton, BaseCard, BaseBadge, ToastContainer, Dialog)
│   ├── composables/ (useClipboard, useShareState, useTheme, useHistory, usePersistedState)
│   ├── core/
│   │   ├── registry.ts
│   │   └── storage/ (db.ts, migrations.ts, backup.ts, sync.ts)
│   ├── i18n/ (index.ts, locales/es-ES/common.json)
│   ├── lib/
│   │   ├── color/ (culori wrapper, contrast wcag/apca, cvd matrices, scales)
│   │   ├── tailwind/ (escape, standard-class detection, formatters)
│   │   ├── css/ (serializers)
│   │   └── a11y/ (keyboard slider, 2D pad, sortable)
│   ├── router/index.ts
│   ├── stores/ (settings.ts, tools.ts, notifications.ts)
│   ├── tools/<id>/          # index.vue, logic.ts, schema.ts, presets.ts,
│   │                        # locales/es-ES.json, logic.spec.ts, tailwind.spec.ts
│   ├── views/ (HomeView, SettingsView, AboutView, NotFoundView)
│   ├── App.vue
│   └── main.ts
├── biome.json, index.html, package.json, pnpm-lock.yaml
├── tsconfig.json, tsconfig.app.json, vite.config.ts, vitest.config.ts, playwright.config.ts
├── .nvmrc, .editorconfig
└── LICENSE (MIT), README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
```

## 18. Estrategia de testing

### 18.1 Unitarios (Vitest)

- **Obligatorios** para toda la lógica pura (`logic.ts`) de cada herramienta: dado un estado, se generan exactamente el CSS y las clases Tailwind esperadas. Casos límite mínimos por herramienta:
  - Gradiente: 2 vs N paradas, hard stops, hints, alfa, `repeating`, espacios de interpolación.
  - Sombras: 1 capa vs multicapa, capas desactivadas, `inset`, coincidencia con la escala v4.
  - Bordes: lados vinculados vs independientes, orden de los 8 radios, unidades.
  - Layout: pistas `minmax()` y `auto-fit`, `grid-template-areas`, overrides responsive.
  - Paleta/Tokens: ida y vuelta de color, escala 50–950, contraste WCAG/APCA con valores de referencia, DTCG válido.
  - Animación: `cubic-bezier`, `steps`, `linear()`, `@theme` con `@keyframes` interno.
  - Minificador: CSS inválido (línea/columna), CSS moderno, entradas vacías y muy grandes.
- **Property-based tests** (por ejemplo `fast-check`) en `lib/color`: conversiones ida y vuelta dentro de tolerancia, rangos válidos, idempotencia del mapeo de gamut.
- **Core:** `storage` con `fake-indexeddb` (migraciones, corrupción, cuota, import/export, concurrencia entre pestañas simulada), `useShareState` (idempotencia, truncado, claves peligrosas, versión), filtros de `useToolsStore` (incluida búsqueda sin acentos), `registry` (ids, rutas, claves i18n), `i18n:check`.
- **Componentes** (`@vue/test-utils`): HomeView, CodeOutputPanel, ToolWorkspace, CommandPalette (teclado y ARIA), componentes `a11y` (slider, pad, sortable).

### 18.2 Salida Tailwind verificada con compilación real

- Test que toma las clases generadas por cada herramienta, las compila con la API `compile` de `tailwindcss` (con `loadStylesheet` apuntando a `node_modules`) y comprueba que producen CSS (es decir, que las clases existen) y que el CSS resultante es equivalente a la salida nativa en los casos canónicos. ⚠️ Verificar la firma de la API en la versión fijada.

### 18.3 End-to-end (Playwright)

- Deep link `/frontkit/tools/gradient` tras recarga (servidor de preview que emula 404 → `404.html`).
- Compartir: generar enlace, abrirlo en contexto limpio, estado idéntico; enlace dañado no rompe.
- Playground: carga de Monaco y workers bajo `base: '/frontkit/'`, Emmet, ejecución, consola, error de usuario, bucle infinito detectado, aislamiento del *sandbox* (el iframe no puede leer IndexedDB).
- Persistencia: recarga conserva estado; exportar e importar backup.
- Accesibilidad: `axe` por herramienta y navegación completa por teclado de un control personalizado por herramienta.
- Smoke en Firefox y WebKit.

## 19. Hoja de ruta por etapas

### Etapa 0 — Fundaciones y *spikes*

- Repositorio con pnpm, Vue 3, TS estricto, Vite, Tailwind 4.x, Pinia, Vue Router, vue-i18n, Vitest, Playwright y Biome; archivos del repo (LICENSE MIT, README, CONTRIBUTING, etc.).
- Core: `registry`, `storage` (IndexedDB + migraciones + backup + sync), `useShareState`, stores, `ToolWorkspace` base, `CodeOutputPanel`, `AppShell`, `CommandPalette`, `HomeView`, `SettingsView`, `AboutView`, `NotFoundView`, anti-FOUC, `ToolErrorBoundary`, recarga ante `ChunkLoadError`.
- Librerías: `lib/color`, `lib/tailwind`, `lib/css`, `lib/a11y` y contrato `ToolLogic<S>`.
- CI (`ci.yml`, `deploy.yml`), Dependabot, scripts `i18n:check` y de tamaño de bundle.
- **Spikes con criterio de salida explícito** (cada uno documentado en `docs/decisions/`):
  1. **Biome + `.vue`**: configuración final o fallback con `overrides`.
  2. **Monaco + Vite + `base: '/frontkit/'`**: workers y Emmet funcionando en un despliegue real de prueba; tamaño del chunk.
  3. **Compilación Tailwind en Vitest** funcionando.
  4. **Formateador CSS**: `css-tree` + *printer* propio vs `lightningcss-wasm`.
  5. **IndexedDB** con `idb` y `fake-indexeddb` en Vitest y happy-dom.
  6. **Nombres de utilidades Tailwind** (gradientes, 3D, sombras de texto, `grid-template-areas`) contra la versión fijada.

### Etapa 1a — Generadores base

- Gradiente, Sombras y Bordes con salida Tailwind, presets, historial, compartir y persistencia. Valida la arquitectura de `ToolWorkspace` y `ToolLogic`.

### Etapa 1b — Playground

- Monaco + Emmet, iframe *sandbox*, consola, protección de bucles, proyectos en IndexedDB, exportaciones y compartir por fragmento. Se despliega aparte para no bloquear 1a.

### Etapa 2 — Color, layout y sistemas de diseño

- Layout (con *areas*, responsive y arrastre), Paletas (OKLCH, WCAG/APCA, daltonismo), Tokens (DTCG, fluid type) y *handoff* entre herramientas.

### Etapa 3 — Efectos, animación y optimización

- Transform, Filter, Animation (`steps`, `linear()`, reduced-motion) y CSS Minifier (Worker).

### Etapa 4 — Pulido, offline y escalabilidad

- `vite-plugin-pwa` con `navigateFallback` y estrategia de actualización clara (aviso «Nueva versión disponible» con acción *Actualizar*); **Monaco y workers en caché de ejecución (*runtime caching*), no en precache**.
- Auditoría final de accesibilidad y Lighthouse CI con presupuestos.
- Documentación de contribución: cómo añadir una herramienta (plantilla `pnpm new:tool <id>` que genera carpeta, `logic.ts`, `schema.ts`, `locales/` y tests base).
- Añadir un segundo idioma de prueba (por ejemplo `en`) para validar la arquitectura i18n, sin necesidad de publicarlo.

## 20. CI/CD

- **`ci.yml`** en `pull_request` y `push`: `pnpm install --frozen-lockfile` → `biome check .` → `vue-tsc --noEmit` → `pnpm i18n:check` → `pnpm test --run` → `pnpm build` → comprobación de tamaño de bundle → Playwright e2e (contra `vite preview` con base `/frontkit/`).
- **`deploy.yml`** solo en `push` a `main`: build, copia `index.html` → `404.html`, `actions/upload-pages-artifact` y `actions/deploy-pages`.
- Permisos mínimos: `contents: read`, y en el job de despliegue `pages: write` e `id-token: write`; `environment: github-pages`.
- `concurrency` por rama (cancelar en PR, no cancelar el despliegue en curso).
- Caché de pnpm, `pnpm/action-setup` y versión de Node desde `.nvmrc`.
- Acciones fijadas por versión mayor (o SHA) y actualizadas con Dependabot.

## 21. Definition of Done por herramienta

Una herramienta se considera terminada cuando cumple **todo** lo siguiente:

1. `logic.ts` puro con tests (casos límite incluidos) y esquema valibot con `migrate`.
2. Salida CSS **y** Tailwind verificadas (incluido test de compilación real) y salidas adicionales según su sección.
3. Teclado y ARIA completos en todos los controles; `axe` sin violaciones serias.
4. Persistencia del último estado, presets propios, historial (deshacer/rehacer) y *share URL* (cuando aplique) con validación.
5. Todas las cadenas en i18n (`i18n:check` verde); sin textos hardcodeados.
6. Presets incluidos y botón Aleatorio (si aplica).
7. Responsive comprobado en 375, 768 y 1280 px.
8. Chunk dentro del presupuesto de tamaño; carga diferida verificada.
9. Aviso de compatibilidad (`CSS.supports`) cuando proceda.
10. Entrada en el registro, documentación breve en el README y prueba e2e de humo.

## 22. Riesgos y supuestos

| Riesgo / supuesto | Mitigación |
| --- | --- |
| Soporte de Vue en Biome inestable | Spike en Etapa 0, versión exacta fijada, fallback con `overrides` |
| Peso de Monaco y workers bajo la base `/frontkit/` | Chunk diferido, solo workers necesarios, e2e en preview con base real, *runtime caching* en PWA |
| Compatibilidad `emmet-monaco-es` con Monaco | Spike; fijar versiones compatibles; plan B: integración Emmet propia o paquete alternativo |
| Cambios de nombres/utilidades en Tailwind | Tests de compilación real, versión mínima 4.1 documentada |
| Fallos de IndexedDB (modo privado, cuota) | Modo en memoria, avisos, exportación de emergencia |
| Congelación por bucles infinitos | Instrumentación con `acorn` + guardia de arranque |
| APCA: algoritmo y constantes en evolución | Aislado en `lib/color`, con valores de referencia en tests y versión citada |
| 404 en *deep links* de GitHub Pages | Aceptado y documentado; alternativa hash descartada |
| Alcance amplio (11 herramientas) | Etapas incrementales y DoD estricto; 1a valida la arquitectura antes de 1b |

**Supuestos adoptados** (revisables): payload máximo de compartir del playground de 8.000 caracteres; historial de 100 pasos; límite de entrada del minificador de 2 MB; *handoff* con caducidad de 24 h; UI de Monaco en inglés en v1; ningún segundo idioma publicado hasta la Etapa 4.
