import { useSearchParams } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";

/**
 * 강재/부품 ID 조회 페이지 (/search)
 * 화면설계서 §4 기준
 * Phase 12에서 완전 구현 예정 (React Flow 트리, PDF 검증)
 */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentId = searchParams.get("id") || "";

  function handleSearch(e) {
    e.preventDefault();
    const id = e.target.elements.searchId.value.trim();
    if (id) setSearchParams({ id });
  }

  return (
    <PageLayout>
      <h2 className="text-lg font-bold text-gray-900 mb-6">강재 / 부품 ID 조회</h2>

      {/* 검색 입력 */}
      <form onSubmit={handleSearch} className="flex items-center gap-3 mb-6">
        <input
          name="searchId"
          type="text"
          defaultValue={currentId}
          placeholder="조회할 ID를 입력하세요  (예: H_001)"
          className="input max-w-md"
          autoComplete="off"
        />
        {/* 조회 유형 */}
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="radio" name="idType" value="steel" defaultChecked className="accent-blue-600" />
          강재 ID
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="radio" name="idType" value="product" className="accent-blue-600" />
          부품 ID
        </label>
        <button type="submit" className="btn-blue">조회</button>
      </form>

      {currentId ? (
        <div className="section-card text-sm text-gray-400 text-center py-10">
          <p className="font-mono text-gray-600 mb-2">
            <span className="font-semibold">"{currentId}"</span> 조회
          </p>
          <p>Phase 12에서 강재 상세 정보 + React Flow 이력 트리 구현 예정</p>
        </div>
      ) : (
        <div className="section-card text-sm text-gray-400 text-center py-10">
          강재 ID 또는 부품 ID를 입력하여 이력을 조회하세요
        </div>
      )}
    </PageLayout>
  );
}
