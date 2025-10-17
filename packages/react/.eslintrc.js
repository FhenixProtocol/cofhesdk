/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@cofhesdk/eslint-config/react-internal'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
