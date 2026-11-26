import { prepareVector, processBatch } from './engine'
import type { SvgRequest, VectorRequest, VectorResult } from './model'
self.addEventListener('message',(event:MessageEvent<SvgRequest|VectorRequest>)=>{
  if(event.data.kind==='vector'){
    let result:VectorResult
    try{result={ok:true,vector:prepareVector(event.data.source)}}
    catch(error){result={ok:false,error:error instanceof Error?error.message:'No se pudo preparar el SVG.'}}
    self.postMessage(result)
    return
  }
  self.postMessage(processBatch(event.data,progress=>self.postMessage({kind:'progress',progress})))
})
