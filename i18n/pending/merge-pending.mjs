/**
 * Merge i18n/pending/*-{zh,en,ja}.json into i18n/locales/{zh,en,ja}.json
 * Usage: node i18n/pending/merge-pending.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.resolve(__dirname, '../locales')
const pendingDir = __dirname

const langs = ['zh', 'en', 'ja']
const locales = Object.fromEntries(
  langs.map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8')),
  ]),
)

const files = fs.readdirSync(pendingDir).filter((f) => /-(zh|en|ja)\.json$/.test(f))
let mergedCount = 0

for (const file of files) {
  const m = file.match(/-(zh|en|ja)\.json$/)
  if (!m) continue
  const lang = m[1]
  const data = JSON.parse(fs.readFileSync(path.join(pendingDir, file), 'utf8'))
  const keys = Object.keys(data)
  Object.assign(locales[lang], data)
  mergedCount += keys.length
  console.log(`merged ${file}: ${keys.length} keys`)
}

for (const lang of langs) {
  const out = locales[lang]
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]))
  // Keep original order-ish: write unsorted assign order from zh as base
  fs.writeFileSync(
    path.join(localesDir, `${lang}.json`),
    `${JSON.stringify(out, null, '\t')}\n`,
    'utf8',
  )
}

const zhKeys = new Set(Object.keys(locales.zh))
const enKeys = new Set(Object.keys(locales.en))
const jaKeys = new Set(Object.keys(locales.ja))
const missEn = [...zhKeys].filter((k) => !enKeys.has(k))
const missJa = [...zhKeys].filter((k) => !jaKeys.has(k))
console.log(`total merged key inserts: ${mergedCount}`)
console.log(`zh=${zhKeys.size} en=${enKeys.size} ja=${jaKeys.size}`)
console.log(`missing en: ${missEn.length}`, missEn.slice(0, 20))
console.log(`missing ja: ${missJa.length}`, missJa.slice(0, 20))
void sorted
