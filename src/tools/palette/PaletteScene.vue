<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { wcagContrast } from '../../lib/color'
import { simulateVision, type Vision } from '../../lib/color/vision'
import type { Swatch } from './logic'

const props = defineProps<{ swatches: Swatch[]; primary: Swatch; vision: Vision }>()
const { t, n } = useI18n()
const label = (key: string) => t('detail.palette.' + key)
const mode = ref<'light' | 'dark'>('light')
const secondaryId = ref('')
const options = computed(() => props.swatches.filter(color => color.id !== props.primary.id))
const secondary = computed(() => options.value.find(color => color.id === secondaryId.value) ?? options.value[0] ?? props.primary)
const shown = (color: Swatch) => simulateVision(color.color, props.vision) ?? color.color
const mainColor = computed(() => shown(props.primary))
const supportColor = computed(() => shown(secondary.value))
const onMain = computed(() => wcagContrast('#000000', mainColor.value) >= wcagContrast('#ffffff', mainColor.value) ? '#000000' : '#ffffff')
const ratio = computed(() => n(wcagContrast(onMain.value, mainColor.value), { maximumFractionDigits: 2, minimumFractionDigits: 1 }))
</script>

<template>
  <section class="palette-scene" :aria-label="label('scene')">
    <div class="scene-toolbar">
      <h3>{{ label('scene') }}</h3>
      <div class="scene-switch" role="group" :aria-label="label('sceneTheme')">
        <button type="button" :aria-pressed="mode === 'light'" @click="mode = 'light'"><Sun :size="15" aria-hidden="true" />{{ t('settings.light') }}</button>
        <button type="button" :aria-pressed="mode === 'dark'" @click="mode = 'dark'"><Moon :size="15" aria-hidden="true" />{{ t('settings.dark') }}</button>
      </div>
    </div>
    <div class="interface-scene" :data-mode="mode" :style="{ '--main-color': mainColor, '--secondary-color': supportColor, '--on-main': onMain }">
      <div class="interface-header">
        <span class="interface-mark" aria-hidden="true" />
        <span>{{ label('sceneTitle') }}</span>
      </div>
      <div class="interface-content">
        <div class="interface-art" aria-hidden="true"><span /><span /><span /></div>
        <div class="interface-copy">
          <span class="interface-caption">{{ label('sceneLabel') }}</span>
          <strong>{{ label('sceneHeadline') }}</strong>
          <span class="interface-action">{{ label('sceneAction') }}</span>
        </div>
      </div>
    </div>
    <div class="scene-meta">
      <div class="scene-role"><span class="role-dot" :style="{ background: mainColor }" aria-hidden="true" />
        <span>{{ label('primaryColor') }} <strong>{{ primary.name }}</strong></span>
      </div>
      <label>{{ label('secondaryColor') }}
        <select :value="secondary.id" @change="secondaryId = ($event.target as HTMLSelectElement).value">
          <option v-for="color in options" :key="color.id" :value="color.id">{{ color.name }}</option>
        </select>
      </label>
      <p class="scene-ratio">{{ t('detail.palette.sceneContrast', { ratio }) }}</p>
    </div>
  </section>
</template>

<style scoped>
.palette-scene { min-width:0;display:grid;gap:.7rem; }
.scene-toolbar { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.35rem; }
.scene-switch { display:inline-flex;border:1px solid var(--line);border-radius:.55rem;padding:.16rem;background:var(--sidebar); }
.scene-switch button { display:flex;align-items:center;gap:.27rem;padding:.3rem .5rem;border-radius:.35rem;font-weight:650;font-size:.76rem;min-height:30px; }
.scene-switch button[aria-pressed='true'] { background:var(--surface);color:var(--accent);box-shadow:0 1px 3px #0002; }
.interface-scene { --paper:#f8faf7;--ink:#172820;--scene-line:#17282035;--card:#ffffff;overflow:hidden;border-radius:.85rem;
  background:color-mix(in srgb,var(--paper),var(--secondary-color) 9%);color:var(--ink);border:1px solid var(--scene-line); }
.interface-scene[data-mode='dark'] { --paper:#12191c;--ink:#f1f6f5;--scene-line:#f1f6f548;--card:#232b2e; }
.interface-header { display:flex;align-items:center;gap:.45rem;padding:.62rem .8rem;border-bottom:1px solid var(--scene-line);font-weight:750;font-size:.8rem; }
.interface-mark { width:.9rem;height:.9rem;border-radius:.27rem;background:var(--main-color);box-shadow:inset 0 0 0 1px var(--scene-line); }
.interface-content { display:grid;grid-template-columns:minmax(100px,.85fr) minmax(0,1fr);align-items:stretch;
  gap:clamp(.55rem,2vw,1rem);margin:.7rem;border-radius:.65rem;border:1px solid var(--scene-line);background:var(--card);padding:.55rem; }
.interface-art { display:grid;place-items:center;overflow:hidden;min-height:8rem;border-radius:.45rem;position:relative;isolation:isolate;
  background:color-mix(in srgb,var(--secondary-color),var(--paper) 28%); }
.interface-art span { position:absolute;aspect-ratio:1;border-radius:22%; }
.interface-art span:first-child { width:70%;border:1px solid var(--ink);opacity:.55;transform:rotate(-17deg); }
.interface-art span:nth-child(2) { width:51%;background:var(--main-color);transform:rotate(18deg);box-shadow:0 7px 20px #0003; }
.interface-art span:last-child { width:17%;border-radius:50%;background:var(--ink);transform:translate(116%,-112%); }
.interface-copy { display:grid;justify-items:start;align-content:center;gap:.38rem;padding-block:.25rem;min-width:0; }
.interface-caption { padding:.1rem .38rem;border-radius:2rem;background:color-mix(in srgb,var(--card),var(--secondary-color) 20%);font-size:.65rem;font-weight:700; }
.interface-copy strong { font-size:clamp(.88rem,2vw,1.3rem);line-height:1.1;letter-spacing:-.04em;overflow-wrap:anywhere; }
.interface-action { display:inline-block;background:var(--main-color);color:var(--on-main);padding:.38rem .55rem;border-radius:.42rem;font-size:.72rem;font-weight:750; }
.scene-meta { display:flex;align-items:center;flex-wrap:wrap;gap:.45rem .72rem;color:var(--muted);font-size:.74rem; }
.scene-role { display:flex;align-items:center;gap:.32rem; }
.scene-role strong { color:var(--text);font-weight:700; }
.role-dot { width:.78rem;height:.78rem;border:1px solid var(--line);border-radius:50%; }
.scene-meta label { display:inline-flex;align-items:center;flex-wrap:wrap;gap:.24rem;font-size:.74rem; }
.scene-meta select { min-height:30px;padding:.25rem .36rem; }
.scene-ratio { font-variant-numeric:tabular-nums; }
@media (max-width:420px) { .interface-content { grid-template-columns: minmax(75px,.75fr) minmax(0,1fr);margin:.48rem; } }
</style>
