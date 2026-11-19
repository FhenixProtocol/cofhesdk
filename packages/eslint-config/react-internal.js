const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/*
 * This is a custom ESLint configuration for use with
 * internal (bundled by their consumer) libraries
 * that utilize React.
 */

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended", "prettier", "turbo"],
  plugins: ["react-hooks"],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    browser: true,
    es2021: true,
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
    // Force ESLint to detect .tsx files
    { files: ["*.js?(x)", "*.ts?(x)"] },
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
    // Enforce React Hooks best practices
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // Allow intentional `while (true)` polling loops that rely on an
    // internal abort-signal check / break condition rather than a
    // condition expression.
    "no-constant-condition": ["warn", { checkLoops: false }],
    // An expression statement that does nothing, e.g. an arrow function defined and never called.
    "no-unused-expressions": ["error", { allowTernary: true }],
  }
};
