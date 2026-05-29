/**
 * 현재 지갑의 역할 조회 + Admin 데모 모드 상태
 * §8-7 Phase 8 / §5.10 F-09 역할 전환 UI
 *
 * 반환값:
 *   isAdmin       — DEFAULT_ADMIN_ROLE 보유 여부
 *   isMill        — MILL_ROLE 보유 여부
 *   isFabricator  — FABRICATOR_ROLE 보유 여부
 *   isIntegrator  — INTEGRATOR_ROLE 보유 여부
 *   selectedMode  — Admin이 선택한 데모 모드 ('admin'|'mill'|'fabricator'|'integrator'|'auditor')
 *   setMode       — 데모 모드 변경 함수 (Admin만 유효)
 *   effectiveRole — UI에 적용할 최종 역할 (selectedMode 또는 실제 역할)
 *   isLoading     — 역할 조회 중 여부
 */

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "./useWallet";
import { useContract } from "./useContract";

const STORAGE_KEY = "mtc_admin_mode";

// DEFAULT_ADMIN_ROLE = bytes32(0) (OpenZeppelin)
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// 실제 역할 → 우선순위 순서 (Admin > Mill > Fabricator > Integrator > Auditor)
function detectEffectiveRole(roles) {
  if (roles.isAdmin) return "admin";
  if (roles.isMill) return "mill";
  if (roles.isFabricator) return "fabricator";
  if (roles.isIntegrator) return "integrator";
  return "auditor";
}

export function useRole() {
  const { account, isConnected } = useWallet();
  const { readContract } = useContract();

  const [roles, setRoles] = useState({
    isAdmin: false,
    isMill: false,
    isFabricator: false,
    isIntegrator: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Admin 데모 모드 — localStorage 영속
  const [selectedMode, setSelectedModeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || null;
  });

  // 역할 조회
  useEffect(() => {
    if (!isConnected || !account || !readContract) {
      setRoles({ isAdmin: false, isMill: false, isFabricator: false, isIntegrator: false });
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchRoles = async () => {
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
    };

    fetchRoles();
    return () => { cancelled = true; };
  }, [account, isConnected, readContract]);

  // Admin 아닌 경우 선택 모드 초기화
  useEffect(() => {
    if (!roles.isAdmin && selectedMode) {
      setSelectedModeState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [roles.isAdmin, selectedMode]);

  const setMode = useCallback((mode) => {
    if (!roles.isAdmin) return;
    setSelectedModeState(mode);
    if (mode) {
      localStorage.setItem(STORAGE_KEY, mode);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [roles.isAdmin]);

  // UI에 적용할 최종 역할
  // Admin이 모드를 선택한 경우 선택 모드 사용, 아니면 실제 역할
  const effectiveRole = roles.isAdmin && selectedMode
    ? selectedMode
    : detectEffectiveRole(roles);

  return {
    ...roles,
    selectedMode,
    setMode,
    effectiveRole,
    isLoading,
  };
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
