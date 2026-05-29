import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // ethers.js v6 호환 — Node.js 폴리필 불필요
  resolve: {
    alias: {
      // 절대 경로 임포트 단축: '@/components/...'
      "@": "/src",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
