import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next v16 ships native flat configs (arrays), so we spread them directly.
// (The older FlatCompat bridge runs these through the legacy eslintrc validator, which crashes
// with "Converting circular structure to JSON" on ESLint 9.)
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
];

export default eslintConfig;
