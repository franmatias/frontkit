import { attachProfile, profileFormat, readProfile, stripProfile } from './icc'
import { extension, geometry, mime, responsiveWidths, type Format, type Optimised, type State } from './logic'

export type Job={file:File;options:State}
export type Result=Optimised|{error:string}
async function encode(canvas:OffscreenCanvas,ctx:OffscreenCanvasRenderingContext2D,format:Format,options:State) {
  const type=mime(format)
  if(format==='avif') {
    const {default:avif}=await import('@jsquash/avif/encode.js')
    return new Blob([await avif(ctx.getImageData(0,0,canvas.width,canvas.height),{cqLevel:Math.round((100-options.avif)*63/99),speed:7})],{type})
  }
  if(format==='jpeg'&&options.optimised) {
    const {default:jpeg}=await import('@jsquash/jpeg/encode.js')
    return new Blob([await jpeg(ctx.getImageData(0,0,canvas.width,canvas.height),{quality:options.jpeg})],{type})
  }
  if(format==='png'&&options.optimised) {
    const {default:optimise}=await import('@jsquash/oxipng/optimise.js')
    return new Blob([await optimise(ctx.getImageData(0,0,canvas.width,canvas.height),{level:options.png})],{type})
  }
  const blob=await canvas.convertToBlob({type,quality:format==='png'?undefined:options[format]/100})
  if(blob.type!==type)throw new Error('El navegador no admite '+format+' en el codificador nativo.')
  return blob
}
function sample(source:ImageBitmap, mode:State['placeholder']) {
  const canvas=new OffscreenCanvas(20,20)
  const ctx=canvas.getContext('2d')
  if(!ctx)return undefined
  ctx.drawImage(source,0,0,20,20)
  if(mode==='tiny')return canvas.convertToBlob({type:'image/webp',quality:.36}).then(async blob=>{
    const bytes=new Uint8Array(await blob.arrayBuffer())
    return 'data:'+blob.type+';base64,'+btoa(String.fromCharCode(...bytes))
  })
  const bytes=ctx.getImageData(0,0,20,20).data
  const buckets=new Map<string,{count:number;r:number;g:number;b:number}>()
  for(let i=0;i<bytes.length;i+=4)if(bytes[i+3]>=77){
    const r=bytes[i],g=bytes[i+1],b=bytes[i+2]
    const key=[r>>5,g>>5,b>>5].join('-')
    const item=buckets.get(key)??{count:0,r:0,g:0,b:0}
    item.count++;item.r+=r;item.g+=g;item.b+=b;buckets.set(key,item)
  }
  const color=[...buckets.values()].sort((a,b)=>b.count-a.count)[0]
  return color?'#'+[color.r,color.g,color.b].map(sum=>Math.round(sum/color.count).toString(16).padStart(2,'0')).join(''):''
}
self.onmessage=async({data:{file,options}}:MessageEvent<Job>)=>{
  let image:ImageBitmap|undefined
  let untagged:ImageBitmap|undefined
  try {
    image=await createImageBitmap(file,{imageOrientation:'from-image'})
    if(image.width*image.height>50_000_000)throw new Error('La imagen supera 50 megapíxeles.')
    const size=geometry(image.width,image.height,options)
    const widths=options.responsive?responsiveWidths(options.widths,size.width):[size.width]
    if(!widths.length)throw new Error('Indica al menos un ancho válido.')
    const outputs=options.responsive?[...new Set(options.formats)]:[options.format]
    const variants:Optimised['variants']=[]
    const inputFormat=profileFormat(file.type)
    let profile:Awaited<ReturnType<typeof readProfile>>
    if(options.keepIcc&&inputFormat&&outputs.some(format=>format!=='avif')){
      try{
        const original=new Uint8Array(await file.arrayBuffer())
        profile=await readProfile(original,inputFormat)
        if(profile){
          const pixels=await stripProfile(original,inputFormat)
          untagged=await createImageBitmap(new Blob([pixels],{type:file.type}),{imageOrientation:'from-image',colorSpaceConversion:'none'})
        }
      }catch{profile=undefined}
    }
    const token=file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'imagen'
    let total=0
    for(const width of widths)for(const format of outputs){
      const scale=width/size.width,height=Math.max(1,Math.round(size.height*scale))
      const canvas=new OffscreenCanvas(width,height)
      const ctx=canvas.getContext('2d')
      if(!ctx)throw new Error('No se puede dibujar la imagen.')
      const w=size.drawWidth*scale,h=size.drawHeight*scale
      ctx.imageSmoothingQuality='high'
      const draw=(source:ImageBitmap)=>{
        ctx.clearRect(0,0,width,height)
        if(format==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)}
        ctx.drawImage(source,(width-w)/2,(height-h)/2,w,h)
      }
      const retain=untagged&&profile&&format!=='avif'
      draw(retain ? untagged! : image)
      let blob=await encode(canvas,ctx,format,options)
      let icc=false
      if(retain&&profile){
        let preserved:Awaited<ReturnType<typeof attachProfile>>
        try{preserved=await attachProfile(new Uint8Array(await blob.arrayBuffer()),format,profile,{width,height})}
        catch{/* The browser encoder emitted an incompatible container. */}
        if(preserved){
          blob=new Blob([preserved],{type:blob.type})
          icc=true
        }else{
          draw(image)
          blob=await encode(canvas,ctx,format,options)
        }
      }
      total+=blob.size
      if(total>120_000_000)throw new Error('La salida supera 120 MB por lote.')
      variants.push({file:token+'-'+width+'.'+extension(format),format,width,height,blob,icc})
      self.postMessage({kind:'progress',progress:Math.round(variants.length/(widths.length*outputs.length)*100)})
    }
    const placeholder=options.placeholder==='none'?'':await sample(image,options.placeholder)??''
    self.postMessage({original:{width:image.width,height:image.height},variants,placeholder,iccRequested:options.keepIcc} satisfies Result)
  } catch(error) { self.postMessage({error:error instanceof Error?error.message:'No se pudo procesar la imagen.'} satisfies Result) }
  finally { image?.close(); untagged?.close() }
}
