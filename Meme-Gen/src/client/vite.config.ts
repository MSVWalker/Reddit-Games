import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  logLevel: 'warn',
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        splash: "splash.html",
        game: "game.html",
      },
    },
  },
});
