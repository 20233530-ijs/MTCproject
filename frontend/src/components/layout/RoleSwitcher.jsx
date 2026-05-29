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

  // Admin 아닌 경우 렌더하지 않음
  if (!isAdmin) return null;

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const displayMode = selectedMode || "admin";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   bg-slate-700 hover:bg-slate-600 transition-colors
                   text-xs text-slate-200 font-medium whitespace-nowrap"
      >
        <span className="text-slate-400 text-[10px]">{MODE_ICON[displayMode]}</span>
        <span>{ROLE_LABEL[displayMode]} 모드</span>
        <span className="text-slate-400 text-[10px] ml-0.5">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-[8000]
                        w-52 bg-white border border-gray-200 rounded-xl shadow-lg
                        overflow-hidden animate-fade-in">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              데모 모드 전환 (Admin 전용)
            </p>
          </div>
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setMode(mode === "admin" ? null : mode);
                setIsOpen(false);
              }}
              className={[
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left",
                "hover:bg-gray-50 transition-colors",
                effectiveRole === mode
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700",
              ].join(" ")}
            >
              <span className="text-gray-400 text-xs w-3">{MODE_ICON[mode]}</span>
              <span>{ROLE_LABEL[mode]}</span>
              {effectiveRole === mode && (
                <span className="ml-auto text-blue-500 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
