const wordsSegmenter = new Intl.Segmenter('es', { granularity: 'word' })
const sentencesSegmenter = new Intl.Segmenter('es', { granularity: 'sentence' })
const characters = new Intl.Segmenter('es', { granularity: 'grapheme' })
const vowel = /[aeiouüáéíóú]/u
const strong = /[aeoáéó]/u
const tonic = /[íú]/u

export function syllables(word: string) {
  const normalized = word.toLowerCase().normalize('NFC').replace(/([qg])u(?=[eéií])/g, '$1').replace(/y$/,'i')
  let count = 0
  let previous = ''
  let hadStrong = false
  for (const letter of normalized) {
    if (letter === 'h' && previous) continue
    if (!vowel.test(letter)) {
      previous = ''
      hadStrong = false
      continue
    }
    if (!previous || tonic.test(letter) || tonic.test(previous) || (strong.test(letter) && hadStrong)) {
      count++
      hadStrong = strong.test(letter)
    } else if (strong.test(letter)) hadStrong = true
    previous = letter
  }
  return Math.max(1, count)
}

// Szigriszt–Pazos formula, validated for the INFLESZ scale by Barrio Cantalejo.
export function inflesz(words: number, syllables: number, sentences: number) {
  return words && sentences ? 206.835 - 62.3 * syllables / words - words / sentences : undefined
}
export function textMetrics(text: string) {
  const words = [...wordsSegmenter.segment(text)].filter(item => item.isWordLike)
  const sentences = [...sentencesSegmenter.segment(text)].filter(item => /[\p{L}\p{N}]/u.test(item.segment))
  const count = words.length
  return {
    words: count, characters: [...characters.segment(text)].length, sentences: sentences.length, seconds: Math.ceil(count / 200 * 60),
    index: inflesz(count, words.reduce((sum, item) => sum + syllables(item.segment), 0), sentences.length),
  }
}
export function measureLines(root: HTMLElement) {
  const iterator = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = root.ownerDocument.createRange()
  const lines = new Map<number, number>()
  for (let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    for (const part of characters.segment(node.textContent ?? '')) {
      range.setStart(node, part.index)
      range.setEnd(node, part.index + part.segment.length)
      const box = Array.from(range.getClientRects()).find(rect => rect.width > 0 && rect.height > 0)
      if (!box) continue
      const row = Math.round(box.top * 2) / 2
      lines.set(row, (lines.get(row) ?? 0) + 1)
    }
  }
  const sizes = [...lines.values()]
  if (!sizes.length) return undefined
  return {
    lines: sizes.length, min: Math.min(...sizes), max: Math.max(...sizes),
    average: sizes.reduce((sum, value) => sum + value, 0) / sizes.length,
  }
}
