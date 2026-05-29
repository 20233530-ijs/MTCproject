import PageLayout from "../components/layout/PageLayout";

/**
 * 사용 매핑 페이지 (/usage)
 * 화면설계서 §9 기준 / 접근 권한: Integrator, Admin
 * Phase 11에서 완전 구현 예정 (markAsUsed 트랜잭션)
 */
export default function UsagePage() {
  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">사용 매핑 (강재 → 부품 등록)</h2>

      <div className="max-w-lg space-y-5">
        {/* 강재 선택 */}
        <div className="section-card">
          <p className="section-title">사용할 강재 선택</p>
          <div className="flex gap-2">
            <input type="text" placeholder="강재 ID  (예: PIPE_001)" className="input" disabled />
            <button className="btn-ghost shrink-0" disabled>조회</button>
          </div>
        </div>

        {/* 부품 정보 */}
        <div className="section-card">
          <p className="section-title">부품 정보 입력</p>
          <div className="space-y-3">
            <div>
              <label className="label">
                부품 ID
                <span className="text-blue-600 text-xs ml-1 font-normal">(블록체인)</span>
              </label>
              <input type="text" placeholder="P_001" className="input" disabled />
            </div>
            <div>
              <label className="label">
                부품 설명
                <span className="text-amber-600 text-xs ml-1 font-normal">(서버 저장)</span>
              </label>
              <input type="text" placeholder="자동화 설비 A 프레임" className="input" disabled />
            </div>
          </div>
        </div>

        {/* 불가역 경고 */}
        <div className="warning-box">
          ⚠ 등록 완료 후 해당 강재의 상태는 <strong>USED</strong>로 변경됩니다.
          이 작업은 <strong>되돌릴 수 없습니다.</strong>
        </div>

        {/* 버튼 */}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled>초기화</button>
          <button className="btn-blue" disabled>
            MetaMask로 사용 등록 ✍ (Phase 11 구현 예정)
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
