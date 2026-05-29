/**
 * 역할 관리 페이지 (/admin)
 * 화면설계서 §5 기준 / 접근 권한: Admin
 * Admin 아닌 경우 홈으로 리다이렉트
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import RoleManager from "../components/admin/RoleManager";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";

export default function AdminPage() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { isAdmin, isLoading } = useRole();

  // 권한 가드: 연결된 상태에서 Admin 아니면 홈으로
  useEffect(() => {
    if (!isLoading && isConnected && !isAdmin) {
      console.warn("[AdminPage] Admin 권한 없음 → 홈 리다이렉트");
      navigate("/", { replace: true });
    }
  }, [isAdmin, isConnected, isLoading, navigate]);

  // 미연결 상태 안내
  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-sm mb-1">MetaMask 연결이 필요합니다</p>
          <p className="text-xs text-gray-400">Admin 계정으로 연결 후 이용 가능합니다</p>
        </div>
      </PageLayout>
    );
  }

  // 역할 로딩 중
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
        <h2 className="text-lg font-bold text-gray-900">역할 관리</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          지갑 주소에 Mill / Fabricator / Integrator 역할을 등록·해제합니다
        </p>
      </div>

      <RoleManager />
    </PageLayout>
  );
}
