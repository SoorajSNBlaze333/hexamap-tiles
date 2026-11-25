import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", three: "src/three/index.ts" },
  // ESM only: lets bundlers drop countries and code an app doesn't import. Node ≥ 22.12 can also
  // require() it from CommonJS.
  format: ["esm"],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "framer-motion", "three", /^three\//, "@react-three/fiber"],
  banner: { js: '"use client";' },
});
