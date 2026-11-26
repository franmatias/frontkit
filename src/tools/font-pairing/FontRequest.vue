<script setup lang="ts">
import { watch } from 'vue'
const props=defineProps<{url:string}>()
const emit=defineEmits<{change:[url:string]}>()
watch(()=>props.url,url=>emit('change',url),{immediate:true})
</script>
<template></template>
