/**
 * 강재/부품 ID 조회 페이지 (/search)
 * 화면설계서 §4 기준
 *
 * - URL 쿼리 ?id=&type= 와 동기화
 * - 부품 ID 입력 시: getSteelByProduct → 강재 ID 자동 변환 후 URL 갱신
 * - 좌: SteelDetail (380px), 우: AncestryTree (React Flow v11)
 * - 트리 노드 클릭 → 좌측 패널을 해당 강재 상세로 전환
 * - 루트와 다른 노드 선택 시 "루트로 돌아가기" 버튼 표시
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SearchPanel from "../components/auditor/SearchPanel";
import SteelDetail from "../components/auditor/SteelDetail";
import AncestryTree from "../components/auditor/AncestryTree";
import { useContract } from "../hooks/useContract";
import { fetchSteelMeta } from "../utils/api";
import { parseContractError } from "../utils/errorMessages";
import { logQuery } from "../utils/logger";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { readContract } = useContract();

  // URL 파라미터 (부품 ID 변환 완료 후에는 항상 강재 ID + type=steel)
  const urlId   = searchParams.get("id")   || "";
  const urlType = searchParams.get("type") || "steel";

  // 부품 ID → 강재 ID 변환 로딩 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // 트리 루트 ID: urlId 변경 시 동기화
  const [rootSteelId,    setRootSteelId]    = useState(urlId);
  // 좌측 상세 패널에 표시 중인 강재 ID (트리 노드 클릭 시 변경)
  const [detailSteelId,  setDetailSteelId]  = useState(urlId);
  // 트리에서 파란 테두리로 강조할 노드 ID
  const [selectedNodeId, setSelectedNodeId] = useState(urlId);

  // AncestryTree 노드 grade 표시용 metaMap
  // — 루트 강재의 KV 메타만 담아 안정적인 참조를 유지
  // — Map 객체를 교체하면 AncestryTree 재빌드 트리거: 최초 1회만 갱신
  const [metaMap, setMetaMap] = useState(() => new Map());

  // URL → 내부 상태 동기화 (뒤로/앞으로 이동, 직접 URL 접근 등)
  useEffect(() => {
    if (!urlId) {
      setRootSteelId("");
      setDetailSteelId("");
      setSelectedNodeId("");
      setMetaMap(new Map());
      setSearchError("");
      return;
    }
    setRootSteelId(urlId);
    setDetailSteelId(urlId);
    setSelectedNodeId(urlId);
    setMetaMap(new Map()); // 루트 변경 시 metaMap 초기화 (이전 강재 grade 제거)
    setSearchError("");
  }, [urlId]);

  // 검색 핸들러 (SearchPanel onSearch 콜백)
  const handleSearch = useCallback(async (id, type) => {
    if (!id) return;

    setSearchError("");

    if (type === "product") {
      // 부품 ID → 강재 ID 자동 변환
      if (!readContract) {
        setSearchError("컨트랙트에 연결할 수 없습니다. MetaMask를 확인하세요.");
        return;
      }
      setIsSearching(true);
      try {
        const steelId = await readContract.getSteelByProduct(id);
        if (!steelId || steelId === "") throw new Error("등록된 강재 없음");

        logQuery({ productId: id, resolvedSteelId: steelId, type: "product-resolve" });
        console.log("[SearchPage] 부품 ID → 강재 ID 변환 완료:", { productId: id, steelId });

        // URL을 강재 ID로 업데이트 (이하 urlId 변경 → useEffect 경유)
        setSearchParams({ id: steelId, type: "steel" });
      } catch (err) {
        const msg = parseContractError(err);
        setSearchError(`부품 ID 조회 실패: ${msg}`);
        console.warn("[SearchPage] getSteelByProduct 실패:", err.message);
      } finally {
        setIsSearching(false);
      }
    } else {
      // 강재 ID 직접 조회: URL 갱신만 하면 useEffect가 나머지 처리
      setSearchParams({ id, type: "steel" });
    }
  }, [readContract, setSearchParams]);

  // SteelDetail → onSteelLoaded: 루트 강재 KV 메타를 metaMap에 주입
  // (트리 노드에 grade 레이블 표시)
  const handleSteelLoaded = useCallback(async (onchain) => {
    const sid = onchain?.steelId;
    if (!sid) return;
    try {
      const kv = await fetchSteelMeta(sid);
      if (kv) {
        setMetaMap((prev) => {
          // 이미 이 강재의 KV가 담겨 있으면 교체 안 함 (AncestryTree 불필요 재빌드 방지)
          if (prev.get(sid) === kv) return prev;
          const next = new Map(prev);
          next.set(sid, kv);
          return next;
        });
        console.log("[SearchPage] 루트 강재 KV 메타 metaMap 주입:", sid);
      }
    } catch {
      // KV 조회 실패는 무시 (grade 레이블 없이 트리는 정상 동작)
    }
  }, []);

  // 트리 노드 클릭 → 좌측 상세 패널 전환
  const handleNodeSelect = useCallback((steelId) => {
    setDetailSteelId(steelId);
    setSelectedNodeId(steelId);
    console.log("[SearchPage] 트리 노드 선택 → 상세 전환:", steelId);
  }, []);

  // "루트로 돌아가기" 핸들러
  const handleBackToRoot = useCallback(() => {
    setDetailSteelId(rootSteelId);
    setSelectedNodeId(rootSteelId);
  }, [rootSteelId]);

  return (
    <PageLayout>

      {/* 페이지 헤더 */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">강재 이력 조회</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          강재 ID 또는 부품 ID로 온체인 데이터·화학 성분·MTC PDF·이력 트리를 조회합니다.
        </p>
      </div>

      {/* 검색 패널 */}
      <div className="section-card mb-5">
        <SearchPanel
          searchId={urlId}
          searchType={urlType}
          onSearch={handleSearch}
          isLoading={isSearching}
        />
        {searchError && (
          <p className="mt-2 text-sm text-red-600">{searchError}</p>
        )}
      </div>

      {/* 검색 결과 없음 */}
      {!rootSteelId && (
        <div className="section-card text-sm text-gray-400 text-center py-14">
          강재 ID 또는 부품 ID를 입력하여 이력을 조회하세요
        </div>
      )}

      {/* 검색 결과: 좌우 2열 레이아웃 */}
      {rootSteelId && (
        <div className="flex gap-5 items-start">

          {/* 좌측: 강재 상세 (고정 너비) */}
          <div className="shrink-0 w-[380px]">
            {/* 루트가 아닌 노드 선택 시 루트 복귀 버튼 */}
            {detailSteelId !== rootSteelId && (
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-mono truncate">{detailSteelId}</p>
                <button
                  onClick={handleBackToRoot}
                  className="text-xs text-blue-600 hover:text-blue-800 underline shrink-0 ml-2"
                >
                  ← 루트로 돌아가기
                </button>
              </div>
            )}
            <SteelDetail
              steelId={detailSteelId}
              onSteelLoaded={handleSteelLoaded}
            />
          </div>

          {/* 우측: 이력 트리 (가변 너비) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                이력 트리
              </p>
              <p className="text-[10px] text-gray-400">
                노드 클릭 시 좌측 패널 전환 · 휠 줌 · 드래그 이동
              </p>
            </div>
            <AncestryTree
              rootId={rootSteelId}
              selectedId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              metaMap={metaMap}
            />
          </div>

        </div>
      )}
    </PageLayout>
  );
}
