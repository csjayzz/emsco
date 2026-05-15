module.exports = {
  env: {
    es6: true,
    node: true,
    commonjs: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "no-unused-vars": ["error", {"argsIgnorePattern": "^_"}],
  },
  globals: {
    module: "readonly",
    require: "readonly",
    exports: "readonly",
    process: "readonly",
    __dirname: "readonly",
  },
};