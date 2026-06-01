/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── 역할 색상 ────────────────────────────────────────────────────
        role: {
          admin:       "#0c2340",
          mill:        "#1d4ed8",
          fabricator:  "#047857",
          integrator:  "#b45309",
          auditor:     "#4b5563",
        },

        // ── 강재 상태 (Design Token 원본값) ─────────────────────────────
        status: {
          active:   "#16a34a",   // ACTIVE
          split:    "#b45309",   // SPLIT   (이전: #ca8a04)
          combined: "#c2410c",   // COMBINED (이전: #ea580c)
          used:     "#6b7280",   // USED
          // 배경색
          "active-bg":   "#ecfdf3",
          "split-bg":    "#fef7e6",
          "combined-bg": "#fff1e6",
          "used-bg":     "#f1f2f4",
        },

        // ── 브랜드 / 서피스 (Design Token) ──────────────────────────────
        brand: {
          DEFAULT: "#0a0a0b",   // primary (near-black)
          hover:   "#1c1c1f",
          pressed: "#2a2a2d",
          fg:      "#ffffff",
          canvas:  "#f7f7f8",   // page background
          surface: "#ffffff",   // card background
          subtle:  "#fafafa",   // secondary surface
          muted:   "#f1f2f4",   // hover bg
          // 헤더는 밝은 배경
          header:  "#ffffff",
          border:  "#e1e2e5",   // border-default
        },

        // ── 텍스트 계층 ─────────────────────────────────────────────────
        text: {
          primary:   "#0a0a0b",
          secondary: "#4b5160",
          tertiary:  "#80868f",
          disabled:  "#b3b6bd",
        },

        // ── 테두리 ──────────────────────────────────────────────────────
        border: {
          subtle:  "#ececee",
          default: "#e1e2e5",
          strong:  "#c8cace",
          focus:   "#0a0a0b",
        },

        // ── 트랜잭션 상태 ────────────────────────────────────────────────
        tx: {
          sending:    "#80868f",
          "sending-bg": "#f1f2f4",
          pending:    "#1d4ed8",
          "pending-bg": "#eef2ff",
          success:    "#15803d",
          "success-bg": "#ecfdf3",
          error:      "#b42318",
          "error-bg":   "#fef3f2",
        },
      },

      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.02em" }], // caption
      },

      zIndex: {
        toast:    "9000",
        modal:    "8000",
        header:   "7000",
        eventlog: "6000",
      },

      animation: {
        "spin-slow": "spin 2s linear infinite",
        "fade-in":   "fadeIn 0.2s cubic-bezier(.2,.7,.2,1)",
        "pulse-dot": "pulse 1.6s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },

      boxShadow: {
        sm:    "0 1px 2px rgba(10,10,11,0.04)",
        md:    "0 4px 12px rgba(10,10,11,0.06), 0 0 0 1px #ececee",
        lg:    "0 12px 32px rgba(10,10,11,0.10), 0 0 0 1px #ececee",
        toast: "0 8px 24px rgba(10,10,11,0.10), 0 0 0 1px #ececee",
      },
    },
  },
  plugins: [],
};
