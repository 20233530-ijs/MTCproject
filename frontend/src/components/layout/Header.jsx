/**
 * 공통 헤더 컴포넌트 — MetaMask 연동 완전 구현
 * 화면설계서 §2.1 기준
 *
 * 구성:
 *   - 로고 (클릭 → /)
 *   - 네비게이션 (역할 기반 활성화/비활성화)
 *   - Admin 역할 전환 드롭다운 (RoleSwitcher)
 *   - 네트워크 뱃지 (Sepolia=초록, 기타=주황)
 *   - 지갑 주소 (클릭=클립보드 복사) / [지갑 연결] 버튼
 *   - 잘못된 네트워크 경고 배너 (헤더 직하단)
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useRole, ROLE_LABEL, ROLE_BADGE_CLASS } from "../../hooks/useRole";
import RoleSwitcher from "./RoleSwitcher";
import { shortenAddress } from "../../utils/format";

// 네비게이션 항목 정의
// allowedRoles: null = 누구나, 배열 = 해당 역할만
const NAV_ITEMS = [
  { label: "조회",    to: "/search",   allowedRoles: null },
  { label: "발행",    to: "/issue",    allowedRoles: ["admin", "mill"] },
  { label: "분할",    to: "/split",    allowedRoles: ["admin", "fabricator"] },
  { label: "조합",    to: "/combine",  allowedRoles: ["admin", "fabricator"] },
  { label: "이전",    to: "/transfer", allowedRoles: ["admin", "mill", "fabricator"] },
  { label: "사용등록", to: "/usage",   allowedRoles: ["admin", "integrator"] },
  { label: "역할관리", to: "/admin",   allowedRoles: ["admin"] },
];

export default function Header() {
  const { account, isSepolia, isConnected, isConnecting, connect } = useWallet();
  const { effectiveRole, isAdmin, isLoading } = useRole();
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!account) return;
    navigator.clipboard.writeText(account).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function isNavAllowed(item) {
    if (!item.allowedRoles) return true;
    if (isAdmin && !isLoading) return true; // Admin은 모든 탭에 접근 가능
    return item.allowedRoles.includes(effectiveRole);
  }

  return (
    <>
      {/* 헤더 바 */}
      <header className="sticky top-0 z-[7000] bg-brand-surface border-b border-brand-border">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* 로고 */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white font-bold text-base
                       shrink-0 hover:opacity-80 transition-opacity"
          >
            <HexIcon />
            <span>MTC Chain</span>
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1">
            {NAV_ITEMS.map((item) => {
              const allowed = isNavAllowed(item);
              return allowed ? (
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
              ) : (
                <span
                  key={item.to}
                  className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap
                             text-slate-600 cursor-not-allowed select-none"
                  title={`현재 역할(${ROLE_LABEL[effectiveRole]})에서 접근 불가`}
                >
                  {item.label}
                </span>
              );
            })}
          </nav>

          {/* 우측: 역할 드롭다운 + 네트워크 + 지갑 */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Admin 역할 전환 */}
            <RoleSwitcher />

            {/* 역할 배지 (연결 시) */}
            {isConnected && !isLoading && (
              <span className={ROLE_BADGE_CLASS[effectiveRole]}>
                {ROLE_LABEL[effectiveRole]}
              </span>
            )}

            {/* 네트워크 뱃지 */}
            <NetworkBadge isSepolia={isSepolia} isConnected={isConnected} />

            {/* 지갑 주소 / 연결 버튼 */}
            {isConnected ? (
              <button
                onClick={copyAddress}
                title="클릭하여 주소 복사"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                           bg-white/5 hover:bg-white/10 transition-colors
                           text-xs font-mono text-slate-200"
              >
                {copied ? (
                  <span className="text-green-400">✓ 복사됨</span>
                ) : (
                  shortenAddress(account)
                )}
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-role-mill hover:bg-blue-700 transition-colors
                           text-xs text-white font-medium
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                ) : "지갑 연결 ▶"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 잘못된 네트워크 경고 배너 */}
      {isConnected && !isSepolia && (
        <div className="bg-amber-500 text-white text-sm py-2 px-4 text-center font-medium z-[6900]">
          ⚠ 현재 네트워크가 Sepolia가 아닙니다. MetaMask에서 Sepolia로 전환하세요.
        </div>
      )}
    </>
  );
}

function NetworkBadge({ isSepolia, isConnected }) {
  if (!isConnected) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
        <span className="hidden sm:inline">--</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-300">
      <span
        className={[
          "w-2 h-2 rounded-full inline-block",
          isSepolia ? "bg-green-400" : "bg-amber-400 animate-pulse",
        ].join(" ")}
      />
      <span className="hidden sm:inline">{isSepolia ? "Sepolia" : "잘못된 네트워크"}</span>
    </span>
  );
}

function HexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <polygon
        points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5"
        fill="#1d4ed8"
        stroke="#93c5fd"
        strokeWidth="1"
      />
    </svg>
  );
}
