const removeFromPreview = 'script, iframe, frame, frameset, object, embed, base, meta, link, style, template, portal, foreignObject'
const address = new Set(['src','srcset','href','xlink:href','poster','ping','action','formaction','background','cite','data','longdesc','imagesrcset'])
const fragment = /^#[\w:.-]*$/
const embedded = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i

// Inert parsing avoids activating resources before the document has its CSP.
export function previewFragment(html: string, add?: (root: DocumentFragment) => void) {
  const canvas = document.createElement('template')
  canvas.innerHTML = html
  for (const node of canvas.content.querySelectorAll(removeFromPreview)) node.remove()
  for (const el of canvas.content.querySelectorAll('*')) {
    for (const attribute of [...el.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || ['srcdoc','autofocus','target','autoplay'].includes(name)) {
        el.removeAttribute(attribute.name)
      } else if (address.has(name) && !fragment.test(attribute.value) && !(name === 'src' && embedded.test(attribute.value))) {
        if (name === 'href' && el.localName === 'a') el.setAttribute('href', '#')
        else el.removeAttribute(attribute.name)
      }
    }
  }
  add?.(canvas.content)
  return canvas.innerHTML
}
export const styleText = (css: string) => css.replace(/<\/style/gi,'<\\/style')
export const baseCsp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'"
export const htmlText = (text:string) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
