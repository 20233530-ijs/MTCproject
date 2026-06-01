/**
 * 검색 패널 컴포넌트
 * 화면설계서 §4 기준
 *
 * - 강재 ID / 부품 ID 라디오 선택
 * - 검색 입력 + Enter/[조회] 버튼
 * - 부품 ID 선택 시: getSteelByProduct 호출 후 강재 ID로 자동 전환
 */

import { useState, useEffect } from "react";

export default function SearchPanel({ searchId, searchType, onSearch, isLoading }) {
  const [inputValue, setInputValue]   = useState(searchId || "");
  const [idType, setIdType]           = useState(searchType || "steel");

  // 외부에서 searchId 변경 시 입력 동기화 (URL 직접 접근 등)
  useEffect(() => {
    setInputValue(searchId || "");
    setIdType(searchType || "steel");
  }, [searchId, searchType]);

  function handleSubmit(e) {
    e.preventDefault();
    const id = inputValue.trim();
    if (id) onSearch(id, idType);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      {/* 검색 입력 */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="조회할 ID를 입력하세요  (예: H_001)"
        className="input flex-1 min-w-[200px] max-w-md"
        autoComplete="off"
        disabled={isLoading}
      />

      {/* 조회 유형 라디오 */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="radio"
            name="idType"
            value="steel"
            checked={idType === "steel"}
            onChange={() => setIdType("steel")}
            className="w-3.5 h-3.5 accent-[#0a0a0b]"
          />
          강재 ID
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="radio"
            name="idType"
            value="product"
            checked={idType === "product"}
            onChange={() => setIdType("product")}
            className="w-3.5 h-3.5 accent-[#0a0a0b]"
          />
          부품 ID
        </label>
      </div>

      <button
        type="submit"
        disabled={!inputValue.trim() || isLoading}
        className="btn-blue shrink-0"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            조회 중...
          </span>
        ) : "조회"}
      </button>
    </form>
  );
}
