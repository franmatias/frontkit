import { Activity, Blend, Box, Code2, Layers3, LayoutGrid, Minimize2, Palette, ScanLine, SlidersHorizontal, SwatchBook } from 'lucide-vue-next'
import type { Component } from 'vue'

export type ToolCategory = 'code' | 'color-tokens' | 'layout' | 'effects' | 'animation' | 'optimization'
export type ToolStatus = 'available' | 'beta' | 'coming-soon'

export interface ToolDefinition {
  id: string
  category: ToolCategory
  tags: string[]
  icon: Component
  phase: '1a' | '1b' | 2 | 3 | 4
  status: ToolStatus
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
    status: 'coming-soon', featured: false,
    supportsTailwind: false, supportsShareUrl: true,
    minViewport: 'tablet', tags: ['tools.playground.tags.main'],
    component: planned,
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
]

export const categories = [...new Set(tools.map(tool => tool.category))]
export const findTool = (id: unknown) => tools.find(tool => tool.id === id)
