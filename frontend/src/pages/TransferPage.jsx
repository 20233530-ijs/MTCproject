import PageLayout from "../components/layout/PageLayout";

/**
 * 소유권 이전 페이지 (/transfer)
 * 화면설계서 §10 기준 / 접근 권한: Mill, Fabricator, Admin
 * Phase 10에서 완전 구현 예정 (transferOwnership 트랜잭션)
 */
export default function TransferPage() {
  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">소유권 이전</h2>

      <div className="max-w-lg space-y-5">
        {/* 이전할 강재 */}
        <div className="section-card">
          <p className="section-title">이전할 강재 선택</p>
          <div className="flex gap-2">
            <input type="text" placeholder="강재 ID  (예: H_001)" className="input" disabled />
            <button className="btn-ghost shrink-0" disabled>조회</button>
          </div>
        </div>

        {/* 수신자 정보 */}
        <div className="section-card">
          <p className="section-title">수신자 정보</p>
          <div className="flex gap-2">
            <input type="text" placeholder="0x5678...abcd" className="input font-mono" disabled />
            <button className="btn-ghost shrink-0" disabled>확인</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Phase 10에서 역할 확인(Fabricator/Integrator) + 시스템 등록 여부 검증 구현 예정
          </p>
        </div>

        {/* 불가역 경고 */}
        <div className="warning-box">
          ⚠ 이전 완료 후 해당 강재에 대한 모든 권한이 수신자에게 이동됩니다.
        </div>

        {/* 버튼 */}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled>초기화</button>
          <button className="btn-blue" disabled>
            MetaMask로 이전 ✍ (Phase 10 구현 예정)
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
