import PageLayout from "../components/layout/PageLayout";

/**
 * 강재 분할 페이지 (/split)
 * 화면설계서 §7 기준 / 접근 권한: Fabricator, Admin
 * Phase 10에서 완전 구현 예정 (splitSteel 트랜잭션 + 무게 검증 UI)
 */
export default function SplitPage() {
  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">강재 분할 (1 → N)</h2>

      <div className="max-w-2xl space-y-5">
        {/* 부모 강재 선택 */}
        <div className="section-card">
          <p className="section-title">부모 강재 선택</p>
          <div className="flex gap-2">
            <input type="text" placeholder="강재 ID  (예: H_003)" className="input" disabled />
            <button className="btn-ghost shrink-0" disabled>조회</button>
          </div>
          <p className="text-xs text-gray-400">
            Phase 10에서 소유 확인 + ACTIVE 상태 검증 구현 예정
          </p>
        </div>

        {/* 자식 무게 입력 */}
        <div className="section-card">
          <p className="section-title">자식 무게 입력 <span className="text-gray-400 normal-case">(최소 2개 / 최대 10개)</span></p>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i}>
                <label className="label">자식 {i} <span className="font-mono text-xs">(kg)</span></label>
                <input type="number" step="0.1" placeholder="0.0" className="input" disabled />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn-ghost text-xs" disabled>+ 행 추가</button>
            <button className="btn-ghost text-xs" disabled>- 마지막 제거</button>
          </div>
        </div>

        {/* 무게 검증 프리뷰 */}
        <div className="section-card bg-gray-50">
          <p className="section-title">무게 검증</p>
          <p className="text-xs text-gray-400">Phase 10에서 실시간 무게 보존 검증 (≤ 10% 손실) 구현 예정</p>
        </div>

        {/* 버튼 */}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled>초기화</button>
          <button className="btn-blue" disabled>
            MetaMask로 분할 ✍ (Phase 10 구현 예정)
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
