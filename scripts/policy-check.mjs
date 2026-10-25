#!/usr/bin/env node
/**
 * Static checks for the design, TypeScript, accessibility and error-handling policies.
 * Run with `npm run lint:policy`. Exits with status 1 when any rule is broken.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const failures = []

function walk(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

const srcFiles = walk(join(root, 'src'))
const textFiles = [...srcFiles, join(root, 'index.html'), ...walk(join(root, 'public'))].filter((file) =>
  ['.ts', '.vue', '.css', '.html', '.svg'].includes(extname(file)),
)
const codeFiles = srcFiles.filter((file) => ['.ts', '.vue'].includes(extname(file)))
const styleFiles = srcFiles.filter((file) => ['.css', '.vue'].includes(extname(file)))
const globalCss = join(root, 'src/theme/global.css')
const variablesCss = join(root, 'src/theme/variables.css')

const read = (file) => readFileSync(file, 'utf8')
const rel = (file) => relative(root, file)

function fail(rule, file, lineNumber, text) {
  failures.push(`${rule}\n    ${rel(file)}:${lineNumber}  ${text.trim().slice(0, 140)}`)
}

function scan(files, rule, test) {
  for (const file of files) {
    read(file)
      .split('\n')
      .forEach((line, index) => {
        if (test(line, file)) fail(rule, file, index + 1, line)
      })
  }
}

/** Removes the :root token block so token definitions are not reported as raw values. */
function withoutRootBlock(file, line, state) {
  if (file !== globalCss) return false
  if (/^:root\s*\{/.test(line)) state.inRoot = true
  const inside = state.inRoot
  if (state.inRoot && /^\}/.test(line)) state.inRoot = false
  return inside
}

/* 1. Em dashes in interface copy */
scan(textFiles, 'No em dashes (U+2014) in interface copy', (line) => line.includes('—'))

/* 2. Emoji used as icons */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u
scan(textFiles, 'No emoji in the interface; use Lucide icons', (line) => EMOJI.test(line))

/* 3. any and unchecked assertions */
scan(codeFiles, "No 'any' type", (line) => /(:\s*any\b|<any>|\bas\s+any\b|\bany\[\]|Record<[^>]*\bany\b)/.test(line))
/** Returns only the TypeScript lines of a file: whole .ts files, or the <script> block of a .vue file. */
function scriptLines(file) {
  const lines = read(file).split('\n')
  if (extname(file) === '.ts') return lines.map((text, index) => ({ text, index }))
  const result = []
  let inScript = false
  lines.forEach((text, index) => {
    if (/<script/.test(text)) {
      inScript = true
      return
    }
    if (/<\/script>/.test(text)) inScript = false
    else if (inScript) result.push({ text, index })
  })
  return result
}

for (const file of codeFiles) {
  for (const { text, index } of scriptLines(file)) {
    const trimmed = text.trim()
    if (/^(\/\/|\/\*|\*|import |export \{)/.test(trimmed)) continue
    const stripped = text.replace(/'[^']*'|`[^`]*`|"[^"]*"/g, "''")
    if (/[\w)\]>]\s+as\s+(?!const\b)[A-Za-z_{(\[]/.test(stripped)) {
      fail('No unchecked type assertions (only `as const` is allowed)', file, index + 1, text)
    }
  }
}
scan(codeFiles, 'No @ts-ignore or @ts-expect-error', (line) => /@ts-(ignore|expect-error)/.test(line))

/* 4. Error handling */
scan(codeFiles, 'No empty catch blocks', (line) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(line))
scan(codeFiles, 'No console.log (use the logger)', (line) => /console\.log\(/.test(line))
scan(
  codeFiles.filter((file) => !file.endsWith('logger.ts')),
  'Use logger instead of console.*',
  (line) => /console\.(error|warn|info|debug)\(/.test(line),
)

/* 5. Accessibility basics */
scan(srcFiles.filter((file) => file.endsWith('.vue')), 'Every <img> needs an alt attribute', (line) => /<img(?![^>]*\balt=)[^>]*>/.test(line) && !/:alt=|\balt=/.test(line))
scan(srcFiles.filter((file) => file.endsWith('.vue')), 'No v-html', (line) => /v-html/.test(line))
scan(styleFiles, 'Never remove outlines without a replacement', (line) => /outline\s*:\s*(none|0)\b/.test(line))

/* 6. Tokens only: no raw colors, radii, shadows, font sizes or timings outside :root */
const rootState = { inRoot: false }
for (const file of styleFiles) {
  rootState.inRoot = false
  let inStyleBlock = extname(file) === '.css'
  read(file)
    .split('\n')
    .forEach((line, index) => {
      if (extname(file) === '.vue') {
        if (/<style/.test(line)) inStyleBlock = true
        if (/<\/style>/.test(line)) inStyleBlock = false
        if (!inStyleBlock) return
      }
      if (withoutRootBlock(file, line, rootState)) return
      if (/^\s*(\/\*|\*)/.test(line)) return
      const raw = (rule) => fail(rule, file, index + 1, line)
      if (file !== variablesCss && /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/.test(line)) raw('Raw color value: use a token')
      if (/border-radius\s*:/.test(line) && !/var\(--radius/.test(line) && !/:\s*0\s*;/.test(line)) raw('Raw border-radius: use a --radius token')
      if (/font-size\s*:/.test(line) && !/var\(--(text|icon)/.test(line) && !/inherit/.test(line)) raw('Raw font-size: use a --text token')
      if (/box-shadow\s*:/.test(line) && !/(var\(--shadow|none)/.test(line)) raw('Raw box-shadow: use a --shadow token')
      if (/(^|\s)(transition|animation)(-duration)?\s*:/.test(line) && /\b\d+(\.\d+)?m?s\b/.test(line) && !/var\(--/.test(line)) {
        raw('Raw transition or animation timing: use a --transition token')
      }
      // Hairlines (1px and 2px strokes, borders, sr-only boxes) are exempt; anything larger needs a token.
      if (/(^|\s)(padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:/.test(line) && /\b([3-9]|\d{2,})\d*px\b/.test(line) && !/var\(--/.test(line)) {
        raw('Raw spacing: use a --space token')
      }
      if (/(^|\s)(width|height|min-height|min-width|max-width|max-height)\s*:/.test(line) && /\b([3-9]|\d{2,})\d*px\b/.test(line) && !/var\(--/.test(line)) {
        raw('Raw size: use a sizing token')
      }
    })
}

/* 7. Contrast, computed from the real tokens in both appearances */
function parseTokens(css) {
  const block = css.slice(css.indexOf(':root'), css.indexOf('\n}\n'))
  const light = {}
  const dark = {}
  for (const match of block.matchAll(/--([\w-]+):\s*light-dark\(\s*hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\),\s*hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)\s*\)/g)) {
    light[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])]
    dark[match[1]] = [Number(match[5]), Number(match[6]), Number(match[7])]
  }
  for (const match of block.matchAll(/--([\w-]+):\s*hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/g)) {
    const name = match[1]
    if (light[name] !== undefined) continue
    const value = [Number(match[2]), Number(match[3]), Number(match[4])]
    light[name] = value
    dark[name] = value
  }
  return { light, dark }
}

function toRgb([h, s, l]) {
  const sat = s / 100
  const light = l / 100
  const k = (n) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function luminance(rgb) {
  const channel = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [high, low] = [luminance(toRgb(a)), luminance(toRgb(b))].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const tokens = parseTokens(read(globalCss))
const SCHEMES = ['light', 'dark']

function token(scheme, name) {
  const value = tokens[scheme][`color-${name}`]
  if (value === undefined) throw new Error(`Missing ${scheme} color token --color-${name}`)
  return value
}

for (const name of new Set([...Object.keys(tokens.light), ...Object.keys(tokens.dark)])) {
  if (!name.startsWith('color-')) continue
  if (tokens.light[name] === undefined || tokens.dark[name] === undefined) {
    failures.push(`Color token is missing a light or dark value\n    --${name}`)
  }
}

const TEXT = 4.5
const UI = 3
const pairs = [
  ['text-primary', 'canvas', TEXT],
  ['text-primary', 'surface', TEXT],
  ['text-secondary', 'surface', TEXT],
  ['text-secondary', 'canvas', TEXT],
  ['text-secondary', 'overlay', TEXT],
  ['text-secondary', 'neutral-light', TEXT],
  ['text-secondary', 'track', TEXT],
  ['text-muted', 'surface', TEXT],
  ['text-muted', 'canvas', TEXT],
  ['text-muted', 'overlay', TEXT],
  ['text-on-brand', 'brand', TEXT],
  ['text-on-brand', 'brand-dark', TEXT],
  ['brand', 'canvas', TEXT],
  ['brand', 'surface', TEXT],
  ['brand', 'brand-light', TEXT],
  ['brand-dark', 'brand-light', TEXT],
  ['success', 'success-light', TEXT],
  ['success', 'surface', TEXT],
  ['danger', 'danger-light', TEXT],
  ['danger', 'surface', TEXT],
  ['danger-dark', 'danger-light', TEXT],
  ['control-border', 'surface', UI],
  ['brand', 'surface', UI],
]
for (const scheme of SCHEMES) {
  for (const [foreground, background, minimum] of pairs) {
    const ratio = contrast(token(scheme, foreground), token(scheme, background))
    if (ratio < minimum) {
      failures.push(`Contrast below ${minimum}:1 in ${scheme} appearance\n    --${foreground} on --${background} is ${ratio.toFixed(2)}:1`)
    }
  }
}

/* 8. Borders need at least 10 lightness points of separation from their surface.
   Light borders are darker than the surface; dark borders are lighter. */
const borderPairs = [
  ['border', 'surface'],
  ['border', 'canvas'],
  ['border', 'overlay'],
  ['border', 'track'],
  ['brand-border', 'brand-light'],
  ['success-border', 'success-light'],
  ['danger-border', 'danger-light'],
  ['neutral-border', 'neutral-light'],
]
for (const scheme of SCHEMES) {
  for (const [border, surface] of borderPairs) {
    const surfaceLightness = token(scheme, surface)[2]
    const borderLightness = token(scheme, border)[2]
    const delta = scheme === 'light' ? surfaceLightness - borderLightness : borderLightness - surfaceLightness
    if (delta < 10) {
      failures.push(`Border too close to its background in ${scheme} appearance (needs 10+ lightness points)\n    --${border} vs --${surface}: ${delta}`)
    }
  }
}

/* 9. Ionic RGB triplets must match the tokens they mirror in both appearances */
const variables = read(variablesCss)
const mirrored = [
  ['ion-color-primary-rgb', 'brand'],
  ['ion-color-primary-contrast-rgb', 'text-on-brand'],
  ['ion-color-success-rgb', 'success'],
  ['ion-color-success-contrast-rgb', 'text-on-brand'],
  ['ion-color-danger-rgb', 'danger'],
  ['ion-color-danger-contrast-rgb', 'text-on-brand'],
  ['ion-background-color-rgb', 'canvas'],
  ['ion-text-color-rgb', 'text-primary'],
]

function rgbValues(variable) {
  const pattern = new RegExp(`--${variable}:\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)`, 'g')
  return [...variables.matchAll(pattern)].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])])
}

function sameRgb(actual, expected) {
  return expected.every((value, index) => Math.abs(value - actual[index]) <= 1)
}

if (!variables.includes(":root[data-appearance='dark']") || !variables.includes(":root:not([data-appearance='light'])")) {
  failures.push('variables.css must define Ionic values for explicit dark and system dark appearances')
}

for (const [variable, name] of mirrored) {
  const values = rgbValues(variable)
  if (values.length === 0) {
    failures.push(`Missing --${variable} in variables.css`)
    continue
  }
  for (const scheme of SCHEMES) {
    const expected = toRgb(token(scheme, name)).map((value) => Math.round(value * 255))
    if (!values.some((actual) => sameRgb(actual, expected))) {
      failures.push(`--${variable} has no ${scheme} value matching --color-${name} (${expected.join(', ')})`)
    }
  }
}

/* Report */
if (failures.length > 0) {
  console.error(`Policy check failed (${failures.length}):\n`)
  for (const failure of failures) console.error(`  - ${failure}\n`)
  process.exit(1)
}
console.log(`Policy check passed: ${textFiles.length} files, ${pairs.length * SCHEMES.length} contrast pairs, ${borderPairs.length * SCHEMES.length} border pairs.`)
