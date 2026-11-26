import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve('dist')
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' }
const server = createServer(async (req,res) => {
  const { pathname } = new URL(req.url,'http://localhost')
  const file = resolve(root, pathname.replace(/^\/frontkit\//,'') || 'index.html')
  if (!file.startsWith(root + sep)) { res.writeHead(404).end(); return }
  try {
    const content = await readFile(file)
    res.writeHead(200, {'Content-Type':mime[extname(file)] ?? 'application/octet-stream'}).end(content)
  } catch { res.writeHead(404,{'Content-Type':'text/html'}).end(await readFile(resolve(root,'404.html'))) }
})
await new Promise(done => server.listen(0,'127.0.0.1',done))
let browser
try {
  const sources = await readFile('src/core/registry.ts','utf8')
  const ids = [...sources.matchAll(/id: '([\w-]+)', category:/g)].map(match => match[1])
  const requested = process.argv.slice(2)
  const selected = requested.length ? ids.filter(id=>requested.includes(id)) : ids
  if (!selected.length) throw new Error('No hay herramientas que capturar')
  const port = server.address().port
  const folder = resolve('src/assets/catalog')
  await mkdir(folder,{recursive:true})
  browser = await chromium.launch(process.env.FRONTKIT_CHROME ? { executablePath:process.env.FRONTKIT_CHROME } : {})
  const context = await browser.newContext({viewport:{width:1350,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'})
  const preparations = {
    'css-converter':['Analizar CSS','Confirmar y mostrar código'],
    bem:['Analizar HTML','Confirmar y generar HTML'],
    smacss:['Clasificar reglas','Confirmar y generar CSS'],
    'a11y-audit':['Auditar HTML'],
    playground:['Vista debajo','Plegar CSS'],
    'svg-optimizer':['Optimizar SVG'],
    'svg-sprite':['Generar sprite'],
    favicon:['Usar SVG de ejemplo','Generar favicons'],
  }
  for (const id of selected) {
    const page = await context.newPage()
    try {
      await page.goto('http://127.0.0.1:'+port+'/frontkit/tools/'+id)
      await page.getByRole('heading',{level:1}).first().waitFor()
      for (const name of preparations[id] ?? []) await page.getByRole('button',{name,exact:true}).click({timeout:4000})
      if (id==='playground') await page.locator('.projects-panel summary').click()
      if (id==='a11y-audit') await page.locator('summary code').getByText('image-alt',{exact:true}).waitFor()
      if (id==='image-optimizer') {
        await page.getByLabel('Archivos de imagen').setInputFiles(resolve(folder,'palette.jpg'))
        await page.getByRole('button',{name:'Optimizar imagen',exact:true}).click()
        await page.getByAltText('Imagen recodificada').waitFor()
      }
      const previews = {'svg-optimizer':'.compare img', 'svg-sprite':'.icons-sheet', favicon:'.device-grid'}
      if (previews[id]) await page.locator(previews[id]).first().waitFor()
      await page.evaluate(()=>document.fonts.ready)
      const card = page.locator(id==='playground' ? '.studio' : id==='palette' ? '.preview-panel' : id==='a11y-audit' ? '.preview-column > .panel' : id==='image-optimizer' || id==='svg-optimizer' ? '.compare' : id==='svg-sprite' ? '.icons-sheet' : id==='meta-tags' ? '.social article' : id==='favicon' ? '.devices' : id==='table-builder' ? '.frame-scroll' : '.preview-panel,.preview-column > .panel,.tool-controls,.main .panel').first()
      const target = await card.count() ? card : page.locator('#main')
      await target.scrollIntoViewIfNeeded()
      const box = await target.boundingBox()
      if (!box || box.width<80) throw new Error('No hay panel visible para '+id)
      const width=Math.min(Math.floor(box.width),630)
      const height=Math.min(Math.floor(box.height),Math.round(width*.56),410)
      const image = await page.screenshot({ type:'jpeg', quality:76, animations:'disabled',
        clip:{ x:Math.max(0,Math.round(box.x)), y:Math.max(0,Math.round(box.y)),width,height:Math.max(60,height) } })
      await writeFile(resolve(folder,id+'.jpg'),image)
      console.log(id+': '+image.length+' bytes')
    } finally { await page.close() }
  }
} finally { await browser?.close(); server.close() }
