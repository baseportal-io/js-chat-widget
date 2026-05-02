#!/usr/bin/env node
/**
 * Regenerates `src/ui/styles/widget-css.ts` from `widget.css`.
 *
 * Why this script exists: tsup's CSS extraction breaks the inlined-
 * bundle contract (the widget injects styles via document.head from
 * a JS string). We import the CSS as a TS string export so it ends
 * up baked into the JS bundle — but that meant maintaining two
 * copies. This script keeps them in sync, wired into the `prebuild`
 * hook so a forgotten manual copy can't ship a stale bundle again.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const cssPath = resolve(__dirname, '../src/ui/styles/widget.css')
const tsPath = resolve(__dirname, '../src/ui/styles/widget-css.ts')

const css = readFileSync(cssPath, 'utf8')

// Escape backticks and ${} so the CSS becomes a safe template literal.
const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const banner = `// AUTO-GENERATED — do not edit. Source of truth: widget.css.
// Regenerate with \`pnpm run sync-css\` (also runs as part of \`pnpm build\`).
//
// CSS exported as a string so tsup keeps it inlined in the JS bundle.
// mount.ts attaches it to the widget's shadow root at mount time so
// the host page's stylesheets cannot bleed into our tree.
`

const output = `${banner}export default \`${escaped}\`\n`

writeFileSync(tsPath, output, 'utf8')
console.log(`[sync-css] ${tsPath} regenerated (${css.length} bytes)`)
