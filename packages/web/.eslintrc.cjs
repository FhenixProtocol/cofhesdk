module.exports = {
  root: true,
  extends: ['@cofhesdk/eslint-config/library.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  ignorePatterns: ['*.cjs', '*.mjs', 'dist/', 'node_modules/'],
};
