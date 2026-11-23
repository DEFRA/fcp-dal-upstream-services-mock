import { readdirSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { exit } from 'node:process'

const schemata = readdirSync(new URL('../src/routes/', import.meta.url), {
  recursive: true
})
  .filter((file) => file.endsWith('-schema.oas.yml'))
  .map((file) => basename(file, '-schema.oas.yml'))
  .sort()

const compose = readFileSync(
  new URL('../test/contract/compose.yml', import.meta.url),
  'utf8'
)
const defaultList = compose.match(/\$\{SCHEMAS:-([^}\n]*)\}/)?.[1]
const configured = defaultList?.trim().split(/\s+/).filter(Boolean) ?? []

const missing = schemata.filter((name) => !configured.includes(name))
const unexpected = configured.filter((name) => !schemata.includes(name))
const duplicates = configured.filter(
  (name, index) => configured.indexOf(name) !== index
)

if (
  !schemata.length ||
  !configured.length ||
  missing.length ||
  unexpected.length ||
  duplicates.length
) {
  if (!schemata.length) console.error('No mock schema files found.')
  if (!configured.length) console.error('No default SCHEMAS list found.')
  if (missing.length)
    console.error(`Missing contract tests: ${missing.join(', ')}`)
  if (unexpected.length)
    console.error(`Unknown contract test schemata: ${unexpected.join(', ')}`)
  if (duplicates.length)
    console.error(`Duplicate contract test schemata: ${duplicates.join(', ')}`)
  exit(1)
} else {
  console.log(`All ${schemata.length} mock schemata have contract tests.`)
}
