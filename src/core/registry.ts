import { Braces, Type, Images, Workflow, Activity, Blend, Box, Code2, Layers3, LayoutGrid, Minimize2, Palette, ScanLine, SlidersHorizontal, SwatchBook } from 'lucide-vue-next'
import type { Component } from 'vue'

export type ToolCategory = 'code' | 'color-tokens' | 'layout' | 'effects' | 'animation' | 'optimization' | 'data' | 'typography' | 'assets' | 'html' | 'refactor'
export type ToolStatus = 'available' | 'beta' | 'coming-soon'

export interface ToolDefinition {
  id: string
  category: ToolCategory
  tags: string[]
  icon: Component
  phase: '1a' | '1b' | 2 | 3 | 4 | 5 | 6 | 7 | 8
  status: ToolStatus
  todo?: boolean
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
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.layout.tags.main'],
    component: planned,
  },
  {
    id: 'palette', category: 'color-tokens', icon: Palette, phase: 2,
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.palette.tags.main'],
    component: planned,
  },
  {
    id: 'tokens', category: 'color-tokens', icon: SwatchBook, phase: 2,
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.tokens.tags.main'],
    component: planned,
  },
  {
    id: 'transform', category: 'effects', icon: Box, phase: 3,
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.transform.tags.main'],
    component: planned,
  },
  {
    id: 'filter', category: 'effects', icon: SlidersHorizontal, phase: 3,
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.filter.tags.main'],
    component: planned,
  },
  {
    id: 'animation', category: 'animation', icon: Activity, phase: 3,
    status: 'coming-soon', featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.animation.tags.main'],
    component: planned,
  },
  {
    id: 'css-minifier', category: 'optimization', icon: Minimize2, phase: 3,
    status: 'coming-soon', featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.css-minifier.tags.main'],
    component: planned,
  },
  {
    id: 'json', category: 'data', icon: Braces, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.json.tags.main'],
    component: planned,
  },
  {
    id: 'decoder', category: 'data', icon: Braces, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'mobile', tags: ['tools.decoder.tags.main'],
    component: planned,
  },
  {
    id: 'mock-data', category: 'data', icon: Braces, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.mock-data.tags.main'],
    component: planned,
  },
  {
    id: 'lorem', category: 'typography', icon: Type, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.lorem.tags.main'],
    component: planned,
  },
  {
    id: 'readability', category: 'typography', icon: Type, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.readability.tags.main'],
    component: planned,
  },
  {
    id: 'fluid-type', category: 'typography', icon: Type, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.fluid-type.tags.main'],
    component: planned,
  },
  {
    id: 'type-scale', category: 'typography', icon: Type, phase: 5,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: true,
    minViewport: 'mobile', tags: ['tools.type-scale.tags.main'],
    component: planned,
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
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: true, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.css-converter.tags.main'],
    component: planned,
  },
  {
    id: 'bem', category: 'refactor', icon: Workflow, phase: 8,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.bem.tags.main'],
    component: planned,
  },
  {
    id: 'smacss', category: 'refactor', icon: Workflow, phase: 8,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: false,
    minViewport: 'tablet', tags: ['tools.smacss.tags.main'],
    component: planned,
  },
  {
    id: 'stacking', category: 'layout', icon: LayoutGrid, phase: 8,
    status: 'coming-soon', todo: true, featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'tablet', tags: ['tools.stacking.tags.main'],
    component: planned,
  },
]

export const categories = [...new Set(tools.map(tool => tool.category))]
export const findTool = (id: unknown) => tools.find(tool => tool.id === id)
