/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@cofhesdk/eslint-config/library'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
