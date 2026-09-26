import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Next build/dev output may use a QA-specific distDir. It has the same
    // generated manifest, cache, server, and static bundle shape as .next.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Identical generated support runtime bundled with imported visual-design
    // reference packages. These are not application or security source.
    "Cozy Christmas Market Map Design/support.js",
    "cozy animal village map design/design-reference/support.js",
    "design_handoff_music_zone_map/support.js",
  ]),
]);

export default eslintConfig;
