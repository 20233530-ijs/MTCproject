/**
 * Admin 전용 역할 전환 드롭다운
 * 화면설계서 §2.1 — Admin 접속 시에만 표시
 * §5.10 F-09 역할 전환 UI (데모 전용)
 *
 * 실제 컨트랙트 권한은 변경되지 않음 — UI 표시 모드만 전환
 */

import { useState, useRef, useEffect } from "react";
import { useRole, ROLE_LABEL } from "../../hooks/useRole";

const MODES = ["admin", "mill", "fabricator", "integrator", "auditor"];

// 모드별 아이콘 (텍스트 이모지 대신 단순 문자 사용)
const MODE_ICON = {
  admin: "★",
  mill: "◆",
  fabricator: "▲",
  integrator: "●",
  auditor: "◎",
};

export default function RoleSwitcher() {
  const { isAdmin, effectiveRole, selectedMode, setMode } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // 드롭다운 외부 클릭 시 닫기 — early return 전에 호출해야 Hook 규칙 준수
  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  // Admin 아닌 경우 렌더하지 않음 — 모든 hook 호출 이후
  if (!isAdmin) return null;

  const displayMode = selectedMode || "admin";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* 트리거 버튼 — .role-select (MTCPROJECT/styles.css) */}
      <button className="role-select" onClick={() => setIsOpen((v) => !v)}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
          role
        </span>
        <span>{ROLE_LABEL[displayMode]} 모드</span>
        <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* 드롭다운 패널 */}
      {isOpen && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 8000,
          width: 208, background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(10,10,11,0.10), 0 0 0 1px #ececee",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "8px 12px", background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <p style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
              데모 모드 전환 (Admin 전용)
            </p>
          </div>
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => { setMode(mode === "admin" ? null : mode); setIsOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", border: 0, textAlign: "left", cursor: "pointer",
                background: effectiveRole === mode ? "var(--bg-muted)" : "var(--bg-surface)",
                color: effectiveRole === mode ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: effectiveRole === mode ? 500 : 400,
                fontSize: 13, fontFamily: "inherit",
                borderBottom: "1px solid var(--border-subtle)",
                transition: "background .1s",
              }}
              onMouseEnter={(e) => { if (effectiveRole !== mode) e.currentTarget.style.background = "var(--bg-subtle)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = effectiveRole === mode ? "var(--bg-muted)" : "var(--bg-surface)"; }}
            >
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", width: 12, flexShrink: 0 }}>{MODE_ICON[mode]}</span>
              <span>{ROLE_LABEL[mode]}</span>
              {effectiveRole === mode && (
                <span style={{ marginLeft: "auto", color: "var(--status-active)", fontSize: 12 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
