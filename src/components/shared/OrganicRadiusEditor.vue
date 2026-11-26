<script setup lang="ts">
import { computed } from 'vue'
import PointCanvas from './PointCanvas.vue'
import type { Radii } from '../../tools/blob/logic'
const props=defineProps<{ radii:Radii }>()
const emit=defineEmits<{ change:[axis:keyof Radii,index:number,value:number] }>()
const corners=['superior izquierda','superior derecha','inferior derecha','inferior izquierda']
const axes=['horizontal','vertical'] as const
const handles=axes.flatMap(axis=>corners.map((corner,index)=>({axis,index,corner,right:index===1||index===2,bottom:index>=2})))
const position = computed(()=>handles.map(h=>{
  const n=Math.min(100,props.radii[h.axis][h.index]!)
  return {x:h.right?100-(h.axis==='horizontal'?n:0):h.axis==='horizontal'?n:0,y:h.bottom?100-(h.axis==='vertical'?n:0):h.axis==='vertical'?n:0}
}))
function move(index:number,p:{x:number;y:number}){
  const h=handles[index]!
  const value=h.axis==='horizontal'?(h.right?100-p.x:p.x):(h.bottom?100-p.y:p.y)
  emit('change',h.axis,h.index,Math.round(value))
}
</script>
<template>
  <PointCanvas label="Tiradores de radios orgánicos" :points="position" :axis="i=>handles[i]?.axis==='vertical'?'y':'x'"
    :title="i=>'Radio '+handles[i]?.axis+' '+handles[i]?.corner" @move="move"><slot /></PointCanvas>
</template>
