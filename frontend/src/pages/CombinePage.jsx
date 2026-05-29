import PageLayout from "../components/layout/PageLayout";

/**
 * 강재 조합 페이지 (/combine)
 * 화면설계서 §8 기준 / 접근 권한: Fabricator, Admin
 * Phase 11에서 완전 구현 예정 (combineSteel 트랜잭션 + 새 PDF 업로드)
 */
export default function CombinePage() {
  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">강재 조합 (N → 1)</h2>

      <div className="max-w-2xl space-y-5">
        {/* 부모 강재 선택 */}
        <div className="section-card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">부모 강재 선택 <span className="text-gray-400 normal-case">(2개 이상)</span></p>
            <button className="btn-ghost text-xs" disabled>+ 강재 추가</button>
          </div>
          <p className="text-xs text-gray-400 text-center py-4">
            Phase 11에서 강재 추가 + 소유 확인 구현 예정
          </p>
        </div>

        {/* 결과물 강재 정보 */}
        <div className="section-card">
          <p className="section-title">결과물 강재 정보</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">강재 ID</label>
              <input type="text" placeholder="PIPE_001" className="input" disabled />
            </div>
            <div>
              <label className="label">무게 <span className="font-mono text-xs">(kg)</span></label>
              <input type="number" step="0.1" placeholder="0.0" className="input" disabled />
            </div>
            <div className="col-span-2">
              <label className="label">강재 등급 <span className="text-gray-400 text-xs">(서버 저장)</span></label>
              <input type="text" placeholder="SM490" className="input" disabled />
            </div>
          </div>
        </div>

        {/* 새 MTC PDF */}
        <div className="section-card">
          <p className="section-title">새 MTC PDF 업로드 <span className="text-gray-400 normal-case text-xs">(결과물 자재증명서)</span></p>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center text-gray-400 text-xs">
            Phase 11에서 결합 강재 MTC PDF 업로드 구현 예정
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled>초기화</button>
          <button className="btn-blue" disabled>
            MetaMask로 조합 ✍ (Phase 11 구현 예정)
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
