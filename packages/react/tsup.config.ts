import { defineConfig } from 'tsup';
import { readFile } from 'node:fs/promises';
import { transform } from '@svgr/core';
import jsxPlugin from '@svgr/plugin-jsx';

export default defineConfig({
  // Keep only JS/TS entry files in tsup. We'll copy CSS to `dist` in a post-build step
  // to avoid tsup generating a malformed CSS source map.
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@mui/material', '@mui/icons-material', '@cofhe/sdk'],
  esbuildPlugins: [
    {
      name: 'svg-to-react',
      setup(build) {
        build.onLoad({ filter: /\.svg$/ }, async (args) => {
          const svg = await readFile(args.path, 'utf8');
          const code = await transform(
            svg,
            {
              jsxRuntime: 'automatic',
              typescript: true,
              expandProps: 'end',
              plugins: [jsxPlugin],
            },
            { filePath: args.path }
          );
          return { contents: code, loader: 'tsx' };
        });
      },
    },
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Handle image imports as data URLs
    options.loader = {
      ...options.loader,
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
    };
  },
});
