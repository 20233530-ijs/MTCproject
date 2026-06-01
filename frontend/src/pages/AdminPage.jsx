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
import { TxPageHead, PageConnectGuard } from "../components/TxShared";

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

  if (!isConnected || isLoading) {
    return <PageLayout><PageConnectGuard isLoading={isLoading && isConnected} /></PageLayout>;
  }

  return (
    <PageLayout>
      <TxPageHead title="역할 관리" en="grantRole / revokeRole" />
      <RoleManager />
    </PageLayout>
  );
}
