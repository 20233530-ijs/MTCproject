/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // 화면설계서 §11 역할별 색상 코드 (보라색 계열 제외)
      colors: {
        role: {
          admin: "#0c2340",       // 관리자 — 진남색 (보라 대신)
          mill: "#1d4ed8",        // 제강사 — 파랑 (#2563EB 계열)
          fabricator: "#047857",  // 가공사 — 초록
          integrator: "#b45309",  // 통합사 — 호박색
          auditor: "#4b5563",     // 조회자 — 회색
        },
        // 강재 상태 배지 색상
        status: {
          active: "#059669",      // ACTIVE — 초록
          split: "#ca8a04",       // SPLIT — 노랑
          combined: "#ea580c",    // COMBINED — 주황
          used: "#6b7280",        // USED — 회색
        },
        // 브랜드 색상 (헤더, 로고)
        brand: {
          DEFAULT: "#0f172a",     // 메인 다크 (slate-900)
          surface: "#1e293b",     // 헤더 배경 (slate-800)
          border: "#334155",      // 테두리 (slate-700)
        },
      },
      fontFamily: {
        // 한국어 레이블용
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        // 코드·주소·ID 표시용 mono
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "monospace",
        ],
      },
      // 트랜잭션 토스트 z-index
      zIndex: {
        toast: "9000",
        modal: "8000",
        header: "7000",
        eventlog: "6000",
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
