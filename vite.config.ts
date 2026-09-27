import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { seo } from "./scripts/seo-plugin";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("VITE_"))) } as Record<string, string>;
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api': 'http://localhost:8787',
      },
    },
    plugins: [
      react(),
      seo(env),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
