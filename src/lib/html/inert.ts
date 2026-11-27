// Parse in a detached document and keep all content outside the live page.
export function inertFragment(html: string) {
  const inert = document.implementation.createHTMLDocument('')
  const container = inert.createElement('div')
  const range = inert.createRange()
  range.selectNodeContents(container)
  container.append(range.createContextualFragment(html))
  return container
}
export const unsafeElements =
  'script,noscript,iframe,frame,frameset,object,embed,applet,base,template,link,style,svg,math,portal'
export const rasterData =
  /^data:image\/(?:png|jpeg|gif|webp);base64,[0-9a-z+/]+={0,2}$/i
export function safeUrl(value: string, hyperlink = false, image = false) {
  const trimmed = value.trim()
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Control characters can disguise URL schemes.
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false
  if (image && rasterData.test(trimmed)) return true
  try {
    const url = new URL(trimmed, 'https://frontkit.invalid/')
    return (
      !url.username &&
      !url.password &&
      (['http:', 'https:'].includes(url.protocol) ||
        (hyperlink && ['mailto:', 'tel:'].includes(url.protocol)))
    )
  } catch {
    return false
  }
}
