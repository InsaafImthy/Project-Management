const spfxProfile = require("@microsoft/eslint-config-spfx/lib/flat-profiles/react");

module.exports = [
  {
    // SPFx writes compiled bundles here during packaging. Keep generated output
    // outside the source lint graph so repeatable production builds do not lint
    // their own webpack artifacts.
    ignores: [
      "dist/**",
      "lib/**",
      "lib-commonjs/**",
      "release/**",
      "sharepoint/solution/debug/**",
      "temp/**",
    ],
  },
  ...spfxProfile,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: "./tsconfig.json",
      },
    },
  },
];
