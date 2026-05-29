import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // 절대 경로 임포트 단축: '@/components/...'
      "@": "/src",
    },
  },

  build: {
    outDir: "dist",
    // 소스맵 활성화 — Cloudflare Pages 배포 후 에러 추적에 유용
    sourcemap: true,

    // 청크별 수동 분리: 벤더 라이브러리를 독립 청크로 캐시 효율 향상
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어 (자주 바뀌지 않으므로 가장 안정적인 캐시)
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          // ethers.js — 컨트랙트 호출 관련 (큰 라이브러리)
          "vendor-ethers": ["ethers"],
          // React Flow — 이력 트리 시각화 (큰 라이브러리)
          "vendor-flow":   ["reactflow"],
        },
      },
    },
  },
});
