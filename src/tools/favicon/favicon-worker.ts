import { geometry, ico, manifest, tags, type Request, type Result } from './logic'
function canvas(size:number,height=size){
  const surface=new OffscreenCanvas(size,height)
  const ctx=surface.getContext('2d')
  if(!ctx)throw new Error('El contexto 2D no está disponible.')
  ctx.imageSmoothingQuality='high'
  return {surface,ctx}
}
function png(image:ImageBitmap,size:number,options:Request['options'],background='',mask=false){
  const {surface,ctx}=canvas(size)
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,size,size)}
  const {x,y,w,h}=geometry(image.width,image.height,size,options.padding,mask)
  let current:ImageBitmap|OffscreenCanvas=image
  while(Math.max(current.width/w,current.height/h)>2.5){
    const stage=canvas(Math.ceil(current.width/2),Math.ceil(current.height/2))
    stage.ctx.drawImage(current,0,0,stage.surface.width,stage.surface.height)
    current=stage.surface
  }
  ctx.drawImage(current,x,y,w,h)
  return surface.convertToBlob({type:'image/png'})
}
const bytes=async(blob:Blob)=>new Uint8Array(await blob.arrayBuffer())
const content=(text:string,type:string)=>new Blob([text],{type})
async function run(data:Request):Promise<Result>{
  const {file,options,vector}=data
  const image=await createImageBitmap(file,{imageOrientation:'from-image'})
  const files:Record<string,Blob>={}
  const width=vector?.width??image.width,height=vector?.height??image.height
  try{
    if(!vector&&Math.min(width,height)<192)throw new Error('La imagen de mapa de bits debe medir al menos 192 × 192 px.')
    if(!image.width||!image.height||image.width*image.height>40_000_000)throw new Error('La imagen supera 40 megapíxeles.')
    const sizes=[16,32,48,180,192,512]
    const bitmaps:Blob[]=[]
    for(const [i,size] of sizes.entries()){
      bitmaps.push(await png(image,size,options,size===180?options.backgroundColor:''))
      self.postMessage({kind:'progress',progress:Math.round((i+1)/8*100)})
    }
    for(const [i,name] of ['icon-16.png','icon-32.png','icon-48.png','apple-touch-icon.png','icon-192.png','icon-512.png'].entries())files[name]=bitmaps[i]!
    files['favicon.ico']=new Blob([new Uint8Array(ico(await Promise.all(sizes.slice(0,3).map(async (size,i)=>({size,bytes:await bytes(bitmaps[i]!)})))))],{type:'image/x-icon'})
    if(options.maskable)files['icon-512-maskable.png']=await png(image,512,options,options.maskColor,true)
    if(vector){
      const original=vector.svg.match(/^<svg[^>]*>/)?.[0]
      const boxed=original&& !original.endsWith('/>')?vector.svg.replace(original,original+(options.darkSvg?
        '<style>@media(prefers-color-scheme:dark){.frontkit-theme{fill:'+options.darkColor+'}}</style><rect class="frontkit-theme" width="100%" height="100%" fill="'+options.backgroundColor+'"/>':'')):vector.svg
      files['icon.svg']=content(boxed,'image/svg+xml')
    }
    files['manifest.webmanifest']=content(manifest(options),'application/manifest+json')
    files['links.html']=content(tags(options,Boolean(vector)),'text/html')
    return {files,width,height,svg:Boolean(vector)}
  }finally{image.close()}
}
self.addEventListener('message',async(event:MessageEvent<Request>)=>{
  try{self.postMessage({ok:true,result:await run(event.data)})}
  catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'No se pudieron generar los iconos.'})}
})
