/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@cofhe/eslint-config/library'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
