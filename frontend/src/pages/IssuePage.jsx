/**
 * MTC 발행 페이지 (/issue)
 * 화면설계서 §6 기준 / 접근 권한: Mill, Admin
 * Mill 또는 Admin 아닌 경우 홈으로 리다이렉트
 */

import { useEffect } from "react";
import PageLayout from "../components/layout/PageLayout";
import MtcIssuance from "../components/mill/MtcIssuance";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";

export default function IssuePage() {
  const { isConnected } = useWallet();
  const { isAdmin, isMill, effectiveRole, isLoading } = useRole();

  // 권한 가드: Mill 또는 Admin (또는 Admin이 Mill 모드 선택 시)
  const hasAccess = isAdmin || isMill || effectiveRole === "mill";

  // Scenario 10-B 데모 목적: 리다이렉트 대신 경고 배너 표시
  // 권한 없는 지갑도 폼을 볼 수 있고, 발행 시도 시 컨트랙트가 NotMill로 거부함
  useEffect(() => {
    if (!isLoading && isConnected && !hasAccess) {
      console.warn("[IssuePage] Mill/Admin 권한 없음 — 경고 배너 표시 (Scenario 10-B 데모 허용)");
    }
  }, [hasAccess, isConnected, isLoading]);

  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-sm mb-1">MetaMask 연결이 필요합니다</p>
          <p className="text-xs text-gray-400">Mill 또는 Admin 계정으로 연결 후 이용 가능합니다</p>
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
        <h2 className="text-lg font-bold text-gray-900">MTC 발행</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          강재 정보를 입력하고 PDF를 업로드하여 블록체인에 이력을 기록합니다
        </p>
      </div>

      {/* Scenario 10-B: 권한 없는 지갑 경고 배너 (리다이렉트 대신 안내) */}
      {isConnected && !isLoading && !hasAccess && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="text-amber-500 font-bold text-sm mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Mill(제강사) 역할이 없습니다
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              이 계정에는 MTC 발행 권한이 없습니다.
              발행을 시도하면 컨트랙트에서 거부됩니다.
              <span className="font-mono ml-1 text-[10px]">(Scenario 10-B 데모 확인용)</span>
            </p>
          </div>
        </div>
      )}

      <MtcIssuance />
    </PageLayout>
  );
}
