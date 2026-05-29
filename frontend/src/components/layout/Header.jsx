import { Link, NavLink } from "react-router-dom";

/**
 * 공통 헤더 컴포넌트
 * 화면설계서 §2.1 기준
 * Phase 8에서 MetaMask 연동, 역할 드롭다운 실제 구현 예정
 */
export default function Header() {
  // 네비게이션 항목 (화면설계서 §1 경로 기준)
  const navItems = [
    { label: "조회", to: "/search" },
    { label: "발행", to: "/issue" },
    { label: "분할", to: "/split" },
    { label: "조합", to: "/combine" },
    { label: "이전", to: "/transfer" },
    { label: "사용등록", to: "/usage" },
    { label: "역할관리", to: "/admin" },
  ];

  return (
    <header className="sticky top-0 z-[7000] bg-brand-surface border-b border-brand-border">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
        {/* 로고 */}
        <Link
          to="/"
          className="flex items-center gap-2 text-white font-bold text-base shrink-0 hover:opacity-80 transition-opacity"
        >
          <HexIcon />
          <span>MTC Chain</span>
        </Link>

        {/* 네비게이션 */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-white/10 text-white font-medium underline underline-offset-4"
                    : "text-slate-300 hover:text-white hover:bg-white/5",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 우측: 네트워크 + 지갑 (Phase 8에서 실제 구현) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* 네트워크 뱃지 */}
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Sepolia
          </span>
          {/* 지갑 연결 버튼 (placeholder) */}
          <button
            className="px-3 py-1.5 rounded-lg bg-role-mill text-white text-xs font-medium
                       hover:bg-blue-700 transition-colors"
            onClick={() => alert("Phase 8에서 MetaMask 연동 구현 예정")}
          >
            지갑 연결 ▶
          </button>
        </div>
      </div>
    </header>
  );
}

// 육각형 로고 아이콘 (SVG)
function HexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <polygon
        points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5"
        fill="#3b82f6"
        stroke="#93c5fd"
        strokeWidth="1"
      />
    </svg>
  );
}
