#!/usr/bin/env node
/**
 * Copies the freshly-built IIFE bundle into `client/public/` so the
 * panel always serves the same artifact the package just produced.
 *
 * Why this exists: `<script src="/baseportal-chat.iife.js">` in the
 * panel layout reads from `client/public/`. Without an automated
 * sync, every widget change requires a manual `cp dist/... ../...`
 * step that is easy to forget — exactly the drift the round-2
 * review caught (panel served a 2-week-old bundle that didn't yet
 * carry `x-visitor-ts`).
 *
 * Wired as `postbuild` in `packages/chat-widget/package.json` so it
 * runs on every `pnpm build` (including the `prebuild` chain that
 * regenerates `widget-css.ts`).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const src = resolve(__dirname, '../dist/index.iife.js')
const dst = resolve(__dirname, '../../../client/public/baseportal-chat.iife.js')

if (!existsSync(src)) {
  console.error(`[sync-iife] source missing: ${src}`)
  process.exit(1)
}

const dstDir = dirname(dst)
if (!existsSync(dstDir)) {
  // The client repo might not be checked out alongside the widget
  // (CI builds the package alone for npm publish). Skip silently
  // in that case — the publish path doesn't need the panel copy.
  console.log(`[sync-iife] client public dir missing, skipping: ${dstDir}`)
  process.exit(0)
}

copyFileSync(src, dst)
console.log(`[sync-iife] copied → ${dst}`)
