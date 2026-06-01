/**
 * 역할 상태 공유 Context
 * — useRole()을 호출하는 모든 컴포넌트(Header, RoleSwitcher, 페이지)가
 *   동일한 selectedMode / effectiveRole 상태를 공유한다.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useWallet } from "./WalletContext";
import { useContract } from "../hooks/useContract";

const STORAGE_KEY = "mtc_admin_mode";

// DEFAULT_ADMIN_ROLE = bytes32(0) (OpenZeppelin)
const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function detectPrimaryRole(roles) {
  if (roles.isAdmin) return "admin";
  if (roles.isMill) return "mill";
  if (roles.isFabricator) return "fabricator";
  if (roles.isIntegrator) return "integrator";
  return "auditor";
}

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { account, isConnected } = useWallet();
  const { readContract } = useContract();

  const [roles, setRoles] = useState({
    isAdmin: false,
    isMill: false,
    isFabricator: false,
    isIntegrator: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // selectedMode: localStorage에서 초기값 복원 (Admin 확인 전까지는 보류)
  const [selectedMode, setSelectedModeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null
  );

  // ── 역할 조회 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected || !account || !readContract) {
      setRoles({ isAdmin: false, isMill: false, isFabricator: false, isIntegrator: false });
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const [isAdmin, isMill, isFabricator, isIntegrator] = await Promise.all([
          readContract.hasRole(DEFAULT_ADMIN_ROLE, account),
          readContract.hasMillRole(account),
          readContract.hasFabricatorRole(account),
          readContract.hasIntegratorRole(account),
        ]);
        if (!cancelled) {
          setRoles({ isAdmin, isMill, isFabricator, isIntegrator });
          console.log("[Role] 조회 완료:", { isAdmin, isMill, isFabricator, isIntegrator });
        }
      } catch (err) {
        console.warn("[Role] 조회 실패:", err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [account, isConnected, readContract]);

  // ── Admin 아닌 경우 selectedMode 초기화 ────────────────────────────────────
  // 버그 수정:
  //   1. isLoading 중에는 판단 보류 (fetchRoles 완료 전에 잘못 클리어되는 문제 해결)
  //   2. selectedMode를 deps에서 제거 — mode 설정 자체가 트리거가 되지 않도록
  useEffect(() => {
    if (isLoading) return;
    if (!roles.isAdmin) {
      setSelectedModeState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isLoading, roles.isAdmin]);

  // ── 데모 모드 전환 (Admin 전용) ────────────────────────────────────────────
  const setMode = useCallback(
    (mode) => {
      if (!roles.isAdmin) return;
      setSelectedModeState(mode);
      if (mode) {
        localStorage.setItem(STORAGE_KEY, mode);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [roles.isAdmin]
  );

  // ── 최종 역할 계산 ─────────────────────────────────────────────────────────
  // Admin이 모드를 선택했으면 선택 모드, 아니면 실제 역할
  const effectiveRole =
    roles.isAdmin && selectedMode ? selectedMode : detectPrimaryRole(roles);

  return (
    <RoleContext.Provider
      value={{ ...roles, selectedMode, setMode, effectiveRole, isLoading }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole: RoleProvider 안에서 호출하세요");
  return ctx;
}

// 역할명 → 한국어 레이블
export const ROLE_LABEL = {
  admin: "Admin",
  mill: "Mill (제강사)",
  fabricator: "Fabricator (가공사)",
  integrator: "Integrator (통합사)",
  auditor: "Auditor (조회자)",
};

// 역할명 → Tailwind 배지 클래스
export const ROLE_BADGE_CLASS = {
  admin: "badge-role-admin",
  mill: "badge-role-mill",
  fabricator: "badge-role-fabricator",
  integrator: "badge-role-integrator",
  auditor: "badge-role-auditor",
};
