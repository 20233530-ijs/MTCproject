import PageLayout from "../components/layout/PageLayout";

/**
 * MTC 발행 페이지 (/issue)
 * 화면설계서 §6 기준 / 접근 권한: Mill, Admin
 * Phase 9에서 완전 구현 예정 (issueMtc 트랜잭션 + Pinata IPFS 업로드)
 */
export default function IssuePage() {
  const GRADE_OPTIONS = ["SS400", "SM490", "SMA490W", "A36", "S355"];

  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">MTC 발행</h2>

      <div className="max-w-2xl space-y-5">
        {/* ① 강재 기본 정보 */}
        <div className="section-card">
          <p className="section-title">① 강재 기본 정보 <span className="text-blue-600 normal-case">(블록체인 저장)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">강재 ID <span className="text-gray-400 font-mono text-xs">(Heat No.)</span></label>
              <input type="text" placeholder="H_001" className="input" disabled />
            </div>
            <div>
              <label className="label">무게 <span className="text-gray-400 font-mono text-xs">(kg)</span></label>
              <input type="number" placeholder="1000.0" step="0.1" min="0.1" className="input" disabled />
            </div>
            <div className="sm:col-span-2">
              <label className="label">강재 등급</label>
              <div className="flex gap-2">
                <select className="input" disabled>
                  <option value="">등급 선택</option>
                  {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                </select>
                <input type="text" placeholder="직접 입력" className="input" disabled />
              </div>
            </div>
          </div>
        </div>

        {/* ② 화학 성분 */}
        <div className="section-card">
          <p className="section-title">
            ② 화학 성분 (%)
            <span className="text-amber-600 normal-case ml-2 text-xs">※ 서버(KV) 저장 / 진본증명: PDF 해시</span>
          </p>
          <div className="grid grid-cols-5 gap-3">
            {["C", "Si", "Mn", "P", "S"].map((el) => (
              <div key={el}>
                <label className="label font-mono">{el}</label>
                <input type="number" step="0.001" placeholder="0.000" className="input" disabled />
              </div>
            ))}
          </div>
        </div>

        {/* ③ 기계적 성질 */}
        <div className="section-card">
          <p className="section-title">
            ③ 기계적 성질
            <span className="text-amber-600 normal-case ml-2 text-xs">※ 서버(KV) 저장 / 진본증명: PDF 해시</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">항복강도 <span className="font-mono text-xs">(MPa)</span></label>
              <input type="number" placeholder="245" className="input" disabled />
            </div>
            <div>
              <label className="label">인장강도 <span className="font-mono text-xs">(MPa)</span></label>
              <input type="number" placeholder="400" className="input" disabled />
            </div>
            <div>
              <label className="label">연신율 <span className="font-mono text-xs">(%)</span></label>
              <input type="number" placeholder="21" className="input" disabled />
            </div>
          </div>
        </div>

        {/* ④ PDF 업로드 */}
        <div className="section-card">
          <p className="section-title">④ MTC PDF 업로드 <span className="text-blue-600 normal-case">(블록체인 해시 저장)</span></p>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
            PDF 파일 선택 (.pdf, 최대 10MB)<br />
            <span className="text-xs">Phase 9에서 Pinata IPFS 업로드 + SHA-256 해시 구현 예정</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled>초기화</button>
          <button className="btn-blue" disabled>
            MetaMask로 발행 ✍ (Phase 9 구현 예정)
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
