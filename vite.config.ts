import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Gera bundle legado para iPads/browsers antigos (Safari < 14, iOS < 14)
    // O browser escolhe automaticamente qual bundle carregar via <script type="module"> / <script nomodule>
    legacy({
      targets: ["ios >= 12", "safari >= 12"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
