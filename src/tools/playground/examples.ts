import type { Source } from './project'

const base = `body {
  margin: 0;
  padding: clamp(1rem, 5vw, 3rem);
  background: #edf3ed;
  color: #1c352c;
  font: 1rem/1.5 system-ui, sans-serif;
}
main {
  max-width: 34rem;
  margin: auto;
  padding: 1.25rem;
  border: 1px solid #c8dcd0;
  border-radius: 1rem;
  background: #fff;
}
h1 { margin-top: 0; }
button, input, textarea { font: inherit; }
button { cursor: pointer; }
label { display: block; margin-block: .5rem; }
button:not([role="switch"]) {
  padding: .35rem .75rem;
  border: 1px solid #256751;
  border-radius: .4rem;
  background: #e3f2e9;
  color: #1c352c;
}`

export const examples = {
  tasks: {
    html: `<main>
  <h1>Lista de tareas</h1>
  <form>
    <label for="task">Nueva tarea</label>
    <input id="task" name="task" required />
    <button>Añadir</button>
  </form>
  <ul id="tasks">
    <li><label><input type="checkbox" /> Revisar el HTML</label></li>
  </ul>
  <p id="pending" role="status"></p>
</main>`,
    css: base + '\nli:has(:checked) { text-decoration: line-through; }\nli label { margin: .25rem 0; }',
    js: `const form = document.querySelector('form')
const list = document.querySelector('#tasks')
const pending = document.querySelector('#pending')

function updateCount() {
  const count = list.querySelectorAll('input:not(:checked)').length
  pending.textContent = 'Tareas pendientes: ' + count
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = new FormData(form).get('task').trim()
  if (!text) return

  const item = document.createElement('li')
  const label = document.createElement('label')
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  label.append(checkbox, ' ' + text)
  item.append(label)
  list.append(item)
  form.reset()
  form.elements.task.focus()
  updateCount()
})

list.addEventListener('change', updateCount)
updateCount()`,
    layout: 'columns',
  },
  filterList: {
    html: `<main>
  <h1>Encuentra un destino</h1>
  <label for="query">Buscar un destino</label>
  <input id="query" type="search" />
  <p id="matches" role="status"></p>
  <ul class="cards">
    <li>Granada <small>Monumentos</small></li>
    <li>Cádiz <small>Costa</small></li>
    <li>Córdoba <small>Patios</small></li>
    <li>Almería <small>Costa</small></li>
  </ul>
</main>`,
    css: base + '\n.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .6rem; padding: 0; }\n.cards li { list-style: none; padding: .8rem; background: #edf3ed; border-radius: .4rem; }\nsmall { display: block; }',
    js: `const search = document.querySelector('#query')
const cards = [...document.querySelectorAll('.cards li')]
const matches = document.querySelector('#matches')
const normalize = (value) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function filter() {
  const query = normalize(search.value.trim())
  for (const card of cards) {
    card.hidden = !normalize(card.textContent).includes(query)
  }
  matches.textContent = cards.filter((card) => !card.hidden).length + ' resultados'
}

search.addEventListener('input', filter)
filter()`,
    layout: 'side',
  },
  paletteSwitch: {
    html: `<main>
  <h1>Cambia el ambiente</h1>
  <p>Empieza con un tema claro y prueba el modo oscuro.</p>
  <button type="button" role="switch" aria-checked="false">Modo oscuro</button>
</main>`,
    css: base + '\nbody.dark { background: #192724; color: #e7f6ee; }\n.dark main { background: #2c4039; border-color: #55756b; }\n[role="switch"] { padding: .5rem .85rem; border-radius: 2rem; border: 1px solid #608678; background: #d8ece4; color: #152c23; }\n[aria-checked="true"] { background: #9cdac1; }',
    js: `const toggle = document.querySelector('[role="switch"]')
toggle.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark')
  toggle.setAttribute('aria-checked', String(dark))
})`,
    layout: 'quad',
  },
  formDemo: {
    html: `<main>
  <h1>Borrador de contacto</h1>
  <form>
    <label for="email">Correo electrónico</label>
    <input id="email" name="email" type="email" required />
    <label for="message">Mensaje</label>
    <textarea id="message" name="message" maxlength="180" required></textarea>
    <p id="remaining">180 caracteres disponibles</p>
    <button>Revisar borrador</button>
  </form>
  <p id="state" role="status"></p>
</main>`,
    css: base + '\ntextarea { display: block; width: min(100%, 25rem); min-height: 4rem; }\n#remaining { color: #476156; }',
    js: `const form = document.querySelector('form')
const message = form.elements.message
const remaining = document.querySelector('#remaining')

message.addEventListener('input', () => {
  remaining.textContent = (message.maxLength - message.value.length) + ' caracteres disponibles'
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  document.querySelector('#state').textContent =
    'Borrador revisado para ' + form.elements.email.value
})`,
    layout: 'bottom',
  },
  accordion: {
    html: `<main>
  <h1>Preguntas del taller</h1>
  <details><summary>¿Qué puedo editar?</summary><p>El HTML, los estilos y el JavaScript.</p></details>
  <details><summary>¿Dónde veo el resultado?</summary><p>En la vista previa que acompaña al editor.</p></details>
  <details><summary>¿Puedo guardar un ejemplo?</summary><p>Sí, puedes descargar el proyecto como JSON.</p></details>
</main>`,
    css: base + '\ndetails { padding: .5rem .75rem; border-block-end: 1px solid #c8dcd0; }\nsummary { cursor: pointer; font-weight: 600; }\ndetails[open] { background: #ebf7ef; }',
    js: `const panels = document.querySelectorAll('details')
for (const panel of panels) {
  panel.addEventListener('toggle', () => {
    if (!panel.open) return
    for (const other of panels) {
      if (other !== panel) other.open = false
    }
  })
}`,
    layout: 'left',
  },
} satisfies Record<string, Source>
