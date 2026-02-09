import { defineConfig } from 'tsup';
import { existsSync, lstatSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from '@svgr/core';
import jsxPlugin from '@svgr/plugin-jsx';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src');

const srcAliasPlugin = {
  name: 'src-alias',
  setup(build: any) {
    build.onResolve({ filter: /^@\// }, (args: any) => {
      const relativePath = args.path.slice(2); // drop '@/'
      const candidate = path.resolve(srcDir, relativePath);

      // Check if it's a file (not a directory)
      if (existsSync(candidate)) {
        try {
          const stats = lstatSync(candidate);
          if (stats.isFile()) {
            return { path: candidate };
          }
        } catch {
          // If we can't stat it, continue with other checks
        }
      }

      // If import has no extension, try common TS/JS variants
      if (!path.extname(candidate)) {
        const tryExts = ['.ts', '.tsx', '.js', '.jsx'];
        // First try as a file with extensions
        for (const ext of tryExts) {
          const withExt = candidate + ext;
          if (existsSync(withExt)) {
            return { path: withExt };
          }
        }
        // Then try index files within directories
        for (const ext of tryExts) {
          const indexFile = path.join(candidate, 'index' + ext);
          if (existsSync(indexFile)) {
            return { path: indexFile };
          }
        }
      }

      if (candidate.endsWith('.js')) {
        const tsCandidate = candidate.replace(/\.js$/, '.ts');
        if (existsSync(tsCandidate)) {
          return { path: tsCandidate };
        }
        const tsxCandidate = candidate.replace(/\.js$/, '.tsx');
        if (existsSync(tsxCandidate)) {
          return { path: tsxCandidate };
        }
      }
      return { path: candidate };
    });
  },
};

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
  esbuildPlugins: [
    srcAliasPlugin,
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
  external: ['react', 'react-dom', '@mui/material', '@mui/icons-material', '@cofhe/sdk', '@cofhe/abi', 'viem'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Handle image imports as data URLs
    options.loader = {
      ...options.loader,
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
    };
  },
});
