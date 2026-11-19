const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended", "prettier", "turbo"],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    // Ignore dotfiles
    ".*.js",
    "node_modules/",
    "dist/",
  ],
  overrides: [
    {
      files: ["*.js?(x)", "*.ts?(x)"],
    },
    {
      // TypeScript already checks these, and the core rules misread TS: they flag globals from
      // lib.dom, method overloads, and a type and a value that share a name.
      files: ["*.ts?(x)"],
      rules: {
        "no-undef": "off",
        "no-dupe-class-members": "off",
        "no-redeclare": "off",
      },
    },
  ],
  rules: {
    "no-unused-vars": "off",
    // An expression statement that does nothing, e.g. an arrow function defined and never called.
    "no-unused-expressions": ["error", { allowTernary: true }],
  },
};
