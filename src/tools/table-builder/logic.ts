import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { htmlText } from '../../lib/html-sandbox'
import { numberBetween } from '../../lib/schema'
const text=(max:number)=>v.pipe(v.string(),v.maxLength(max))
const cell=text(300)
export const modes=['scroll','sticky','cards','priority'] as const
export const column=v.strictObject({header:text(80),align:v.picklist(['left','center','right']),type:v.picklist(['text','number']),priority:v.boolean()})
export const schema=v.strictObject({
  caption:text(180),columns:v.pipe(v.array(column),v.minLength(1),v.maxLength(16)),
  rows:v.pipe(v.array(v.pipe(v.array(cell),v.maxLength(16))),v.maxLength(1000)),rowHeaders:v.boolean(),
  footer:text(180),mode:v.picklist(modes),breakpoint:numberBetween(300,900),sort:v.boolean(),striped:v.boolean(),compact:v.boolean(),
})
export type State=v.InferOutput<typeof schema>
export const makeColumn=(header:string):State['columns'][number]=>({header,align:'left',type:'text',priority:false})
export const defaults=():State=>({caption:'Material para el taller',columns:[makeColumn('Material'),makeColumn('Cantidad'),makeColumn('Grupo')],
  rows:[['Papel reciclado','24','A'],['Rotuladores','12','B'],['Cuadernos','16','A']],rowHeaders:true,footer:'',mode:'scroll',breakpoint:580,sort:false,striped:true,compact:false})
export function parseGrid(raw:string){
  raw=raw.replace(/^\uFEFF/,'')
  const sample=raw.split(/\r?\n/,1)[0]??''
  const delimiter=sample.includes('\t')?'\t':','
  const rows:string[][]=[]
  let row:string[]=[],cell='',quoted=false
  for(let i=0;i<raw.length&&rows.length<1001;i++){
    const c=raw[i]!
    if(c==='"'){
      if(quoted&&raw[i+1]==='"'){cell+='"';i++}
      else if(quoted||!cell)quoted=!quoted
      else cell+=c
    }else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){
      row.push(cell.slice(0,300));cell=''
      if(c!==delimiter){
        rows.push(row.slice(0,16));row=[]
        if(c==='\r'&&raw[i+1]==='\n')i++
      }
    }else cell+=c
  }
  if(quoted)throw new Error('Hay una celda entre comillas sin cerrar.')
  if(cell||row.length){row.push(cell.slice(0,300));rows.push(row.slice(0,16))}
  return rows
}
export function replaceRows(s:State,headers:string[], rows:string[][]){
  if(!headers.length)return
  s.columns=headers.slice(0,16).map((name,i)=>makeColumn(name.trim().slice(0,80)||'Columna '+(i+1)))
  s.rows=rows.slice(0,1000).map(row=>s.columns.map((_,i)=>(row[i]??'').slice(0,300)))
}
export const sortCode=String.raw`document.querySelectorAll('[data-sort-table]').forEach(table => {
  const body = table.tBodies[0];
  const buttons = [...table.tHead.querySelectorAll('button[data-order]')];
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    const header = button.closest('th');
    const ascending = header.getAttribute('aria-sort') !== 'ascending';
    const display = new Intl.Collator(document.documentElement.lang || undefined, { numeric: true, sensitivity: 'base' });
    const rows = [...body.rows];
    const get = row => row.cells[index]?.textContent.trim() || '';
    rows.sort((a, b) => {
      const x = get(a), y = get(b);
      const aNumber = Number(x.replace(',', '.')), bNumber = Number(y.replace(',', '.'));
      const comparison = button.dataset.order === 'number' && x && y && Number.isFinite(aNumber) && Number.isFinite(bNumber)
        ? aNumber - bNumber : display.compare(x, y);
      return ascending ? comparison : -comparison;
    });
    buttons.forEach(item => item.closest('th').removeAttribute('aria-sort'));
    header.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    rows.forEach(row => body.append(row));
  }));
});`
const attribute=(key:string,value:string)=>value?' '+key+'="'+htmlText(value)+'"':''
export function html(s:State,tailwind=false){
  const cards=s.mode==='cards',cut='max-['+Math.round(s.breakpoint)+'px]:'
  const role=(value:string)=>cards?attribute('role',value):''
  const fmt=(items:string[])=>attribute('class',items.filter(Boolean).join(' '))
  const standard=tailwind?['px-3 py-2','text-slate-950','dark:text-slate-100']:[]
  const wrapper=fmt(['frontkit-table',s.mode,tailwind&&'overflow-x-auto'||''])
  const caption='<caption id="tabla-titulo"'+fmt(tailwind?['p-2','font-semibold','text-left']:[])+'>'+htmlText(s.caption || 'Tabla de datos')+'</caption>'
  const keys=s.columns.map((col,i)=>col.header.trim()||'Columna '+(i+1))
  const classes=(col:State['columns'][number],i:number)=>fmt([
    'align-'+col.align, s.mode==='priority'&&col.priority?'low':'',
    ...(tailwind?[...standard,'text-'+col.align,s.mode==='sticky'&&i===0?'sticky left-0 bg-slate-100 dark:bg-slate-900':'',
      s.mode==='priority'&&col.priority?cut+'hidden':'',
      cards?cut+'block '+cut+'before:content-[attr(data-label)]':'']:[]),
  ])
  const headers=s.columns.map((col,i)=>'<th scope="col"'+role('columnheader')+classes(col,i)+'>'+
    (s.sort?'<button type="button" data-order="'+col.type+'">'+htmlText(keys[i]!)+'</button>':htmlText(keys[i]!))+'</th>')
  const rows=s.rows.map(row=>'<tr'+role('row')+(tailwind&&cards?fmt([cut+'block',cut+'border']):'')+'>'+s.columns.map((col,i)=>{
    const heading=s.rowHeaders&&i===0,tag=heading?'th':'td'
    const prefix=cards?attribute('data-label',keys[i]!) : ''
    return '<'+tag+(heading?' scope="row"':'')+role(heading?'rowheader':'cell')+classes(col,i)+prefix+'>'+htmlText(row[i]??'')+'</'+tag+'>'
  }).join('')+'</tr>')
  const foot=s.footer?'<tfoot'+role('rowgroup')+'><tr'+role('row')+'><td colspan="'+s.columns.length+'"'+role('cell')+'>'+htmlText(s.footer)+'</td></tr></tfoot>':''
  return '<div'+wrapper+' role="region" aria-labelledby="tabla-titulo" tabindex="0">\n'+
    '  <table'+role('table')+(s.sort?' data-sort-table':'')+fmt(tailwind?['w-full','border-collapse',cards?cut+'block':'']:[]) +'>\n    '+caption+
    '\n    <thead'+role('rowgroup')+(cards&&tailwind?fmt([cut+'sr-only',cut+'focus-within:not-sr-only']):'')+'><tr'+role('row')+'>'+headers.join('')+'</tr></thead>'+
    '\n    <tbody'+role('rowgroup')+(cards&&tailwind?fmt([cut+'block']):'')+'>\n      '+rows.join('\n      ')+'\n    </tbody>'+foot+
    '\n  </table>\n</div>'
}
export function css(s:State){
  const rules=[
    '.frontkit-table { overflow-x: auto; color: #172a24; background: #fff; }',
    '.frontkit-table table { width: 100%; border-collapse: collapse; }',
    '.frontkit-table caption { text-align: left; font-weight: 700; padding: .7rem; }',
    '.frontkit-table th, .frontkit-table td { padding: '+(s.compact?'.3rem .5rem':'.65rem .8rem')+'; border: 1px solid #81978d; text-align: left; overflow-wrap: anywhere; }',
    '.frontkit-table thead { background: #deeee7; }',
    '.frontkit-table .align-left { text-align: left; } .frontkit-table .align-right { text-align: right; } .frontkit-table .align-center { text-align: center; }',
    '.frontkit-table button:focus-visible, .frontkit-table:focus-visible { outline: 3px solid #16745c; outline-offset: -3px; }',
  ]
  if(s.striped)rules.push('.frontkit-table tbody tr:nth-child(even) { background: #edf6f2; }')
  if(s.mode==='sticky')rules.push('.frontkit-table table { min-width: 38rem; } .frontkit-table th:first-child, .frontkit-table td:first-child { position: sticky; left: 0; background: #e3eee9; box-shadow: 2px 0 3px #0003; }')
  if(s.mode==='priority')rules.push('@media (max-width: '+Math.round(s.breakpoint)+'px) { .frontkit-table .low { display: none; } }')
  if(s.mode==='cards')rules.push('@media (max-width: '+Math.round(s.breakpoint)+'px) {\n'+
    '  .frontkit-table table, .frontkit-table tbody, .frontkit-table tbody tr, .frontkit-table tbody tr > * { display: block; }\n'+
    '  .frontkit-table thead { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n'+
    '  .frontkit-table thead:focus-within { position: static; inline-size: auto; block-size: auto; overflow: visible; clip-path: none; }\n'+
    '  .frontkit-table tbody tr { margin-block-end: .5rem; }\n'+
    '  .frontkit-table [data-label]::before { content: attr(data-label); font-weight: 700; margin-inline-end: .75rem; }\n}')
  return rules.join('\n')
}
export const logic=defineTool<State>({id:'table-builder',schema,defaultState:defaults,outputs:{
  html:s=>html(s),css,tailwind:s=>html(s,true),js:s=>s.sort?sortCode:'',
},presets:[]})
