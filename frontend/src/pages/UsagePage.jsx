/**
 * 사용 매핑 페이지 (/usage)
 * 화면설계서 §9 기준 / 접근 권한: Integrator, Admin
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SteelUsage from "../components/integrator/SteelUsage";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";

export default function UsagePage() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { isAdmin, isIntegrator, effectiveRole, isLoading } = useRole();

  const hasAccess = isAdmin || isIntegrator || effectiveRole === "integrator";

  useEffect(() => {
    if (!isLoading && isConnected && !hasAccess) {
      console.warn("[UsagePage] Integrator/Admin 권한 없음 → 홈 리다이렉트");
      navigate("/", { replace: true });
    }
  }, [hasAccess, isConnected, isLoading, navigate]);

  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-sm mb-1">MetaMask 연결이 필요합니다</p>
          <p className="text-xs text-gray-400">Integrator 또는 Admin 계정으로 연결 후 이용 가능합니다</p>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-24">
          <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">권한 확인 중...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">사용 매핑 (강재 → 부품 등록)</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          강재를 부품에 매핑하여 최종 사용 이력을 블록체인에 기록합니다.
          등록 후 해당 강재는 재사용할 수 없습니다.
        </p>
      </div>

      <SteelUsage />
    </PageLayout>
  );
}
