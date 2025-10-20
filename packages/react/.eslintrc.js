/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@cofhe/eslint-config/react-internal'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
