/**
 * 강재 조합 페이지 (/combine)
 * 화면설계서 §8 기준 / 접근 권한: Fabricator, Admin
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SteelCombine from "../components/fabricator/SteelCombine";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";

export default function CombinePage() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { isAdmin, isFabricator, effectiveRole, isLoading } = useRole();

  const hasAccess = isAdmin || isFabricator || effectiveRole === "fabricator";

  useEffect(() => {
    if (!isLoading && isConnected && !hasAccess) {
      console.warn("[CombinePage] Fabricator/Admin 권한 없음 → 홈 리다이렉트");
      navigate("/", { replace: true });
    }
  }, [hasAccess, isConnected, isLoading, navigate]);

  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-sm mb-1">MetaMask 연결이 필요합니다</p>
          <p className="text-xs text-gray-400">Fabricator 또는 Admin 계정으로 연결 후 이용 가능합니다</p>
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
        <h2 className="text-lg font-bold text-gray-900">강재 조합 (N → 1)</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          여러 강재를 하나로 조합합니다. 결과물 무게는 부모 합계의 85% 이상이어야 합니다.
        </p>
      </div>

      <SteelCombine />
    </PageLayout>
  );
}
