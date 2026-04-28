import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const enableComponentTagger =
    mode === "development" && process.env.VITE_ENABLE_COMPONENT_TAGGER === "true";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Suppress spurious "preloaded but not used" warnings in dev
      preTransformRequests: false,
    },
    plugins: [react(), enableComponentTagger && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Disable automatic <link rel="modulepreload"> for lazy chunks
      // Prevents browser warnings for pages that haven't been visited yet
      modulePreload: false,
      rollupOptions: {
        external: ["@mlc-ai/web-llm"],
      },
    },
    optimizeDeps: {
      exclude: ["@mlc-ai/web-llm"],
      include: [
        "react",
        "react-dom",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
      ],
    },
  };
});
