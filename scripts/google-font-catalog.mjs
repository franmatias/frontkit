import { writeFile } from 'node:fs/promises'
const key = process.env.FRONTKIT_GOOGLE_FONTS_KEY
if (!key) throw new Error('Define FRONTKIT_GOOGLE_FONTS_KEY en el entorno local')
const url = new URL('https://www.googleapis.com/webfonts/v1/webfonts')
url.searchParams.set('key', key)
url.searchParams.set('capability', 'VF')
url.searchParams.set('sort', 'popularity')
const response = await fetch(url)
if (!response.ok) throw new Error('Google Fonts devolvió HTTP ' + response.status)
const { items } = await response.json()
const rows = items
  .filter(item => /^[\p{L}\d -]+$/u.test(item.family) && !item.family.startsWith('System '))
  .slice(0, 450)
  .map(item => {
    const axes = (item.axes ?? []).map(({tag,start,end}) => ({tag,start,end}))
    const weight = axes.find(axis => axis.tag === 'wght')
    const weights = new Set(item.variants.map(value => Number.parseInt(value, 10) || 400))
    if (weight) for (let n = 100; n <= 900; n += 100) if (n >= weight.start && n <= weight.end) weights.add(n)
    return {family:item.family,category:item.category,weights:[...weights].sort((a,b)=>a-b),italic:item.variants.some(value=>value.includes('italic')),axes,subsets:item.subsets}
  })
await writeFile(new URL('../src/tools/font-pairing/catalog.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n')
