/**
 * 공통 헤더 — MTCPROJECT/styles.css + search.html 마크업 적용
 * 블록체인 로직(useWallet, useRole) 유지 / 스타일·마크업만 교체
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useRole, ROLE_LABEL } from "../../hooks/useRole";
import RoleSwitcher from "./RoleSwitcher";
import { shortenAddress } from "../../utils/format";

// 네비게이션 항목 — MTCPROJECT/tx-shared.jsx ROUTE_ACCESS 기준과 동일하게 정렬
const NAV_ITEMS = [
  { label: "조회",     to: "/search",   allowedRoles: null },
  { label: "발행",     to: "/issue",    allowedRoles: ["admin", "mill"] },
  { label: "분할",     to: "/split",    allowedRoles: ["admin", "fabricator"] },
  { label: "조합",     to: "/combine",  allowedRoles: ["admin", "fabricator"] },
  { label: "이전",     to: "/transfer", allowedRoles: ["admin", "mill", "fabricator"] },
  { label: "사용등록",  to: "/usage",   allowedRoles: ["admin", "integrator"] },
  { label: "역할관리",  to: "/admin",   allowedRoles: ["admin"] },
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

  // 역할별 탭 접근 제어 — Admin은 전체 허용 (isLoading 중 조기 차단 방지)
  function isNavAllowed(item) {
    if (!item.allowedRoles) return true;          // 조회 탭: 누구나
    if (isAdmin && !isLoading) return true;        // Admin: 모든 탭
    return item.allowedRoles.includes(effectiveRole);
  }

  return (
    <>
      {/* ── .mtc-header ─────────────────────────────────────────── */}
      <header className="mtc-header" data-screen-label="Header">

        {/* 로고 — outline 육각형 SVG (MTCPROJECT 기준) */}
        <Link to="/" className="mtc-logo" aria-label="MTC Chain 홈">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L21.66 7.5V16.5L12 22L2.34 16.5V7.5L12 2Z"
                  stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M12 7.5L17 10.25V15.75L12 18.5L7 15.75V10.25L12 7.5Z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <span>MTC Chain</span>
        </Link>

        {/* ── .mtc-nav ─────────────────────────────────────────── */}
        <nav className="mtc-nav" aria-label="primary">
          {NAV_ITEMS.map((item) => {
            const allowed = isNavAllowed(item);

            if (!allowed) {
              return (
                <span
                  key={item.to}
                  className="mtc-nav-item is-disabled"
                  title={`${ROLE_LABEL[effectiveRole] || "현재 역할"}에서 접근 불가`}
                >
                  {item.label}
                </span>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  "mtc-nav-item" + (isActive ? " is-active" : "")
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* ── .mtc-header-right ───────────────────────────────── */}
        <div className="mtc-header-right">

          {/* Admin 역할 전환 드롭다운 (.role-select) */}
          <RoleSwitcher />

          {/* 네트워크 배지 (.net-badge) */}
          <NetworkBadge isSepolia={isSepolia} isConnected={isConnected} />

          {/* 지갑 주소 / 연결 버튼 (.wallet-pill) */}
          {isConnected ? (
            <button className="wallet-pill" onClick={copyAddress} title="클릭하여 주소 복사">
              {/* MetaMask 아이콘 */}
              <span style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                background: "linear-gradient(135deg,#f6851b,#e2761b 50%,#cd6116)",
                display: "inline-block",
              }} />
              <span>{copied ? "복사됨" : shortenAddress(account)}</span>
              <span className="copy">
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M5 15V5C5 4.45 5.45 4 6 4H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </span>
            </button>
          ) : (
            <button
              className="wallet-pill is-disconnected"
              onClick={connect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span style={{
                  display: "inline-block", width: 12, height: 12,
                  border: "1.5px solid rgba(255,255,255,0.35)", borderTop: "1.5px solid #fff",
                  borderRadius: "999px", animation: "spin .9s linear infinite",
                }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginRight: 2 }}>
                  <path d="M21 12V8C21 7 20 6 19 6H5C4 6 3 7 3 8V16C3 17 4 18 5 18H19C20 18 21 17 21 16V12ZM21 12H17C16 12 15 13 15 14C15 15 16 16 17 16H21"
                        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                </svg>
              )}
              지갑 연결
            </button>
          )}
        </div>
      </header>

      {/* ── .warn-banner: 잘못된 네트워크 ───────────────────────── */}
      {isConnected && !isSepolia && (
        <div className="warn-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M12 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
          </svg>
          <span>
            <b>현재 네트워크가 Sepolia가 아닙니다.</b>{" "}
            MetaMask에서 Sepolia로 전환하세요.
          </span>
          <button className="btn-inline" type="button">네트워크 전환</button>
        </div>
      )}
    </>
  );
}

// ── NetworkBadge — .net-badge CSS 클래스 사용 ─────────────────────────────────
function NetworkBadge({ isSepolia, isConnected }) {
  if (!isConnected) {
    return (
      <span className="net-badge no-conn">
        <span className="dot" />
        <span>--</span>
      </span>
    );
  }
  return (
    <span className={"net-badge" + (!isSepolia ? " is-wrong" : "")}>
      <span className="dot" />
      <span>{isSepolia ? "Sepolia" : "잘못된 네트워크"}</span>
    </span>
  );
}
