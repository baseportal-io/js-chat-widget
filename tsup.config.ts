import { defineConfig } from 'tsup'

export default defineConfig([
  // IIFE for script tag
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    outDir: 'dist',
    globalName: 'BaseportalChatSDK',
    outExtension: () => ({ js: '.iife.js' }),
    minify: true,
    sourcemap: true,
    target: 'es2020',
    platform: 'browser',
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.jsxImportSource = 'preact'
    },
    noExternal: [/(.*)/],
    footer: {
      js: `(function(){var s=BaseportalChatSDK;if(s&&s.default){var c=window.BaseportalChat;if(c&&c.channelToken){var inst=new s.default(c);Object.keys(inst).forEach(function(k){if(typeof inst[k]==='function')c[k]=inst[k].bind(inst)});window.BaseportalChat=c}}})();`,
    },
  },
  // ESM + CJS for npm
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    outExtension: ({ format }) => ({
      js: format === 'esm' ? '.esm.js' : '.cjs.js',
    }),
    dts: true,
    sourcemap: true,
    target: 'es2020',
    platform: 'browser',
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.jsxImportSource = 'preact'
    },
    external: ['preact', 'ably'],
  },
])
