import { Braces, Type, Images, Workflow, Activity, Blend, Box, Code2, Layers3, LayoutGrid, Minimize2, Palette, ScanLine, SlidersHorizontal, SwatchBook } from 'lucide-vue-next'
import type { Component } from 'vue'

export type ToolCategory = 'code' | 'color-tokens' | 'layout' | 'effects' | 'animation' | 'optimization' | 'data' | 'typography' | 'assets' | 'html' | 'refactor'
export type ToolStatus = 'available' | 'beta' | 'coming-soon'

export interface ToolDefinition {
  id: string
  category: ToolCategory
  tags: string[]
  icon: Component
  phase: '1a' | '1b' | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
  status: ToolStatus
  todo?: boolean
  sensitive?: boolean
  inputKind?: 'none' | 'text' | 'files'
  featured: boolean
  supportsTailwind: boolean
  supportsShareUrl: boolean
  minViewport: 'mobile' | 'tablet' | 'desktop'
  component: () => Promise<Component>
}

const planned = () => import('../views/ComingSoonView.vue').then(module => module.default)
export const tools: ToolDefinition[] = [
  {
    id: 'playground', category: 'code', icon: Code2, phase: "1b",
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'tablet', tags: ['tools.playground.tags.main'],
    component: () => import('../tools/playground/index.vue').then(module => module.default),
  },
  {
    id: 'gradient', category: 'color-tokens', icon: Blend, phase: "1a",
    status: 'beta', featured: true,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.gradient.tags.main'],
    component: () => import('../tools/gradient/index.vue').then(module => module.default),
  },
  {
    id: 'shadow', category: 'effects', icon: Layers3, phase: "1a",
    status: 'beta', featured: true,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.shadow.tags.main'],
    component: () => import('../tools/shadow/index.vue').then(module => module.default),
  },
  {
    id: 'border', category: 'effects', icon: ScanLine, phase: "1a",
    status: 'beta', featured: true,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.border.tags.main'],
    component: () => import('../tools/border/index.vue').then(module => module.default),
  },
  {
    id: 'layout', category: 'layout', icon: LayoutGrid, phase: 2,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.layout.tags.main'],
    component: () => import('../tools/layout/index.vue'),
  },
  {
    id: 'palette', category: 'color-tokens', icon: Palette, phase: 2,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.palette.tags.main'],
    component: () => import('../tools/palette/index.vue').then(module => module.default),
  },
  {
    id: 'tokens', category: 'color-tokens', icon: SwatchBook, phase: 2,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.tokens.tags.main'],
    component: () => import('../tools/tokens/index.vue').then(module => module.default),
  },
  {
    id: 'transform', category: 'effects', icon: Box, phase: 3,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.transform.tags.main'],
    component: () => import('../tools/transform/index.vue').then(module => module.default),
  },
  {
    id: 'filter', category: 'effects', icon: SlidersHorizontal, phase: 3,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.filter.tags.main'],
    component: () => import('../tools/filter/index.vue').then(module => module.default),
  },
  {
    id: 'animation', category: 'animation', icon: Activity, phase: 3,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.animation.tags.main'],
    component: () => import('../tools/animation/index.vue').then(module => module.default),
  },
  {
    id: 'css-minifier', category: 'optimization', icon: Minimize2, phase: 3,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.css-minifier.tags.main'],
    component: () => import('../tools/css-minifier/index.vue').then(module => module.default),
  },
  {
    id: 'json', category: 'data', icon: Braces, phase: 5,
    status: 'beta', inputKind: 'text', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.json.tags.main'],
    component: () => import('../tools/json/index.vue').then(module => module.default),
  },
  {
    id: 'decoder', category: 'data', icon: Braces, phase: 5,
    status: 'beta', sensitive: true, inputKind: 'text', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.decoder.tags.main'],
    component: () => import('../tools/decoder/index.vue').then(module => module.default),
  },
  {
    id: 'mock-data', category: 'data', icon: Braces, phase: 5,
    status: 'beta', inputKind: 'none', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.mock-data.tags.main'],
    component: () => import('../tools/mock-data/index.vue').then(module => module.default),
  },
  {
    id: 'lorem', category: 'typography', icon: Type, phase: 5,
    status: 'beta', inputKind: 'text', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.lorem.tags.main'],
    component: () => import('../tools/lorem/index.vue').then(module => module.default),
  },
  {
    id: 'readability', category: 'typography', icon: Type, phase: 5,
    status: 'beta', inputKind: 'text', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.readability.tags.main'],
    component: () => import('../tools/readability/index.vue').then(module => module.default),
  },
  {
    id: 'fluid-type', category: 'typography', icon: Type, phase: 5,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.fluid-type.tags.main'],
    component: () => import('../tools/fluid-type/index.vue').then(module => module.default),
  },
  {
    id: 'type-scale', category: 'typography', icon: Type, phase: 5,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.type-scale.tags.main'],
    component: () => import('../tools/type-scale/index.vue').then(module => module.default),
  },
  {
    id: 'font-pairing', category: 'typography', icon: Type, phase: 6,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.font-pairing.tags.main'],
    component: planned,
  },
  {
    id: 'blob', category: 'effects', icon: Blend, phase: 6,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.blob.tags.main'],
    component: planned,
  },
  {
    id: 'clip-path', category: 'effects', icon: Blend, phase: 6,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.clip-path.tags.main'],
    component: planned,
  },
  {
    id: 'backgrounds', category: 'effects', icon: Blend, phase: 6,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.backgrounds.tags.main'],
    component: planned,
  },
  {
    id: 'svg-optimizer', category: 'assets', icon: Images, phase: 7,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.svg-optimizer.tags.main'],
    component: planned,
  },
  {
    id: 'svg-sprite', category: 'assets', icon: Images, phase: 7,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.svg-sprite.tags.main'],
    component: planned,
  },
  {
    id: 'favicon', category: 'assets', icon: Images, phase: 7,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.favicon.tags.main'],
    component: planned,
  },
  {
    id: 'meta-tags', category: 'html', icon: Code2, phase: 7,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.meta-tags.tags.main'],
    component: planned,
  },
  {
    id: 'table-builder', category: 'html', icon: Code2, phase: 7,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.table-builder.tags.main'],
    component: planned,
  },
  {
    id: 'css-converter', category: 'refactor', icon: Workflow, phase: 8,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.css-converter.tags.main'],
    component: () => import('../tools/css-converter/index.vue').then(module => module.default),
  },
  {
    id: 'bem', category: 'refactor', icon: Workflow, phase: 8,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.bem.tags.main'],
    component: () => import('../tools/bem/index.vue').then(module => module.default),
  },
  {
    id: 'smacss', category: 'refactor', icon: Workflow, phase: 8,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.smacss.tags.main'],
    component: () => import('../tools/smacss/index.vue').then(module => module.default),
  },
  {
    id: 'stacking', category: 'layout', icon: LayoutGrid, phase: 8,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'tablet', tags: ['tools.stacking.tags.main'],
    component: () => import('../tools/stacking/index.vue').then(module => module.default),
  },
  {
    id: 'color-converter', category: 'color-tokens', icon: Palette, phase: 9,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.color-converter.tags.main'],
    component: () => import('../tools/color-converter/index.vue').then(module => module.default),
  },
  {
    id: 'encoders', category: 'data', icon: Braces, phase: 9,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.encoders.tags.main'],
    component: () => import('../tools/encoders/index.vue').then(module => module.default),
  },
  {
    id: 'css-reset', category: 'code', icon: Code2, phase: 9,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.css-reset.tags.main'],
    component: () => import('../tools/css-reset/index.vue').then(module => module.default),
  },
  {
    id: 'transitions', category: 'animation', icon: Activity, phase: 10,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.transitions.tags.main'],
    component: () => import('../tools/transitions/index.vue').then(module => module.default),
  },
  {
    id: 'container-queries', category: 'layout', icon: LayoutGrid, phase: 10,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.container-queries.tags.main'],
    component: () => import('../tools/container-queries/index.vue').then(module => module.default),
  },
  {
    id: 'image-optimizer', category: 'assets', icon: Images, phase: 11,
    status: 'beta', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.image-optimizer.tags.main'],
    component: () => import('../tools/image-optimizer/index.vue').then(module => module.default),
  },
  {
    id: 'a11y-audit', category: 'html', icon: ScanLine, phase: 11,
    status: 'beta', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.a11y-audit.tags.main'],
    component: () => import('../tools/a11y-audit/index.vue').then(module => module.default),
  },
]

export const categories = [...new Set(tools.map(tool => tool.category))]
export const findTool = (id: unknown) => tools.find(tool => tool.id === id)
