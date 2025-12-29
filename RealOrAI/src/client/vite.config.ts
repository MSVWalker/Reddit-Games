import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  logLevel: "warn",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "EVAL" && warning.id?.includes("@protobufjs/inquire")) {
          return;
        }
        warn(warning);
      },
      input: {
        splash: "splash.html",
        game: "game.html",
      },
    },
  },
});
