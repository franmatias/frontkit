<script setup lang="ts">
import { Activity, Binary, BookOpenText, Braces, Brush, ClipboardList, Code2, Combine, FileCode2, FileImage, FileSearch, FileText, Focus, FoldVertical, Globe, Grid2X2, Image, Layers3, ListFilter, Move, PaintBucket, PanelTop, Pipette, RectangleHorizontal, Regex, ScanLine, ShieldCheck, Sparkles, SwatchBook, Table2, Timer, Type, WashingMachine } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ToolDefinition } from '../../core/registry'
const props = defineProps<{ tool: ToolDefinition }>()
const icons: Record<string, Component> = {
  playground: Code2, 'regex-kit': Regex, gradient: PaintBucket, shadow: Layers3, border: RectangleHorizontal, layout: Grid2X2,
  palette: SwatchBook, tokens: Braces, transform: Move, filter: ListFilter, animation: Activity,
  'css-minifier': FoldVertical, json: Braces, decoder: Binary, 'mock-data': ClipboardList,
  lorem: FileText, readability: BookOpenText, 'fluid-type': Type, 'type-scale': Type, 'font-pairing': BookOpenText,
  blob: Brush, 'clip-path': Focus, backgrounds: PaintBucket, 'svg-optimizer': FileImage, 'svg-sprite': Grid2X2,
  favicon: Image, 'meta-tags': Globe, 'table-builder': Table2, 'css-converter': FileCode2, bem: Combine, smacss: Layers3,
  stacking: Layers3, 'color-converter': Pipette, encoders: Binary, 'css-reset': WashingMachine, transitions: Timer,
  'container-queries': PanelTop, 'image-optimizer': FileImage, 'a11y-audit': ScanLine, 'html-cleaner': ShieldCheck,
}
const accents: Record<ToolDefinition['category'], Component> = {
  code: Braces, 'color-tokens': Pipette, effects: Sparkles, layout: Grid2X2, animation: Activity,
  optimization: FoldVertical, data: Binary, typography: Type, assets: Image, html: FileSearch, refactor: Combine,
}
</script>

<template>
  <span class="kit-illustration" :data-category="tool.category" :data-kit="tool.id" aria-hidden="true">
    <span class="kit-outline" />
    <span class="kit-badge"><component :is="icons[props.tool.id] ?? props.tool.icon" :size="58" :stroke-width="1.4" /></span>
    <span class="kit-accent"><component :is="accents[props.tool.category]" :size="21" :stroke-width="1.55" /></span>
  </span>
</template>

<style scoped>
.kit-illustration { --ink:#22604c;--back:#e2f1e9;--tile:#fafdfb;--mark:#b9e6d1;display:grid;place-items:center;position:relative;isolation:isolate;width:100%;height:100%;
  overflow:hidden;color:var(--ink);background:radial-gradient(circle at 74% 25%,var(--tile),transparent 45%),var(--back); }
.kit-illustration:is([data-category='layout'],[data-category='assets'],[data-category='html']) { --ink:#214e76;--back:#e3eff9;--tile:#f9fcff;--mark:#bbd9ef; }
.kit-illustration:is([data-category='effects'],[data-category='animation'],[data-category='refactor']) { --ink:#634383;--back:#efe7f7;--tile:#fffbff;--mark:#ddcaef; }
.kit-illustration:is([data-category='data'],[data-category='typography']) { --ink:#80501f;--back:#f8eddb;--tile:#fffaf0;--mark:#efd6a7; }
.kit-illustration::before { content:'';position:absolute;inset:0;opacity:.19;background:radial-gradient(var(--ink) .8px,transparent 1px) 0 0/15px 15px;mask-image:linear-gradient(135deg,#000,transparent 86%); }
.kit-outline { position:absolute;width:min(40%,10rem);aspect-ratio:1;border-radius:22%;border:1px solid var(--ink);opacity:.21;transform:rotate(-13deg); }
.kit-badge { position:relative;display:grid;place-items:center;width:clamp(4.5rem,45%,7.7rem);aspect-ratio:1;border:1px solid var(--mark);border-radius:24%;background:var(--tile);box-shadow:0 9px 30px #12233b22;transform:rotate(6deg); }
.kit-badge svg { width:52%;height:auto;transform:rotate(-6deg); }
.kit-accent { position:absolute;display:grid;place-items:center;width:clamp(1.9rem,15%,2.8rem);aspect-ratio:1;border-radius:.65rem;background:var(--mark);right:20%;bottom:16%;box-shadow:0 4px 12px #15233022; }
</style>
