import { onScopeDispose, ref } from 'vue'

export function useLocalFont(family: string) {
  const fontName = ref('')
  const fontError = ref(false)
  let face: FontFace | undefined
  let revision = 0
  function clearLocal() {
    revision++
    if (face) document.fonts.delete(face)
    face = undefined
    fontName.value = ''
    fontError.value = false
  }
  async function localFont(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const request = ++revision
    fontError.value = false
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      fontError.value = true
      return
    }
    try {
      const loaded = await new FontFace(family, await file.arrayBuffer()).load()
      if (request !== revision) return
      if (face) document.fonts.delete(face)
      document.fonts.add(loaded)
      face = loaded
      fontName.value = file.name
    } catch {
      if (request === revision) fontError.value = true
    }
  }
  onScopeDispose(clearLocal)
  return { fontName, fontError, localFont, clearLocal }
}
