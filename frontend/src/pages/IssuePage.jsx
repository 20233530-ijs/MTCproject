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
import { TxPageHead, PageConnectGuard } from "../components/TxShared";

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

  if (!isConnected || isLoading) {
    return <PageLayout><PageConnectGuard isLoading={isLoading && isConnected} /></PageLayout>;
  }

  return (
    <PageLayout>
      <TxPageHead title="MTC 발행" en="issueMtc" />

      {isConnected && !isLoading && !hasAccess && (
        <div className="warn-irreversible" style={{ marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M12 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
          </svg>
          <span><b>Mill(제강사) 역할이 없습니다.</b> 발행을 시도하면 컨트랙트에서 거부됩니다 (Scenario 10-B).</span>
        </div>
      )}

      <MtcIssuance />
    </PageLayout>
  );
}
