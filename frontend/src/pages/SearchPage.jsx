/**
 * 강재/부품 ID 조회 페이지 (/search)
 * 화면설계서 §4 기준
 */

import { useState, useEffect, useCallback } from "react";
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

  const urlId   = searchParams.get("id")   || "";
  const urlType = searchParams.get("type") || "steel";

  const [isSearching,   setIsSearching]   = useState(false);
  const [searchError,   setSearchError]   = useState("");
  const [rootSteelId,   setRootSteelId]   = useState(urlId);
  const [detailSteelId, setDetailSteelId] = useState(urlId);
  const [selectedNodeId,setSelectedNodeId]= useState(urlId);
  const [metaMap,       setMetaMap]       = useState(() => new Map());

  useEffect(() => {
    if (!urlId) {
      setRootSteelId(""); setDetailSteelId(""); setSelectedNodeId("");
      setMetaMap(new Map()); setSearchError(""); return;
    }
    setRootSteelId(urlId); setDetailSteelId(urlId); setSelectedNodeId(urlId);
    setMetaMap(new Map()); setSearchError("");
  }, [urlId]);

  const handleSearch = useCallback(async (id, type) => {
    if (!id) return;
    setSearchError("");
    if (type === "product") {
      if (!readContract) { setSearchError("컨트랙트 연결 필요"); return; }
      setIsSearching(true);
      try {
        const steelId = await readContract.getSteelByProduct(id);
        if (!steelId || steelId === "") throw new Error("등록된 강재 없음");
        logQuery({ productId: id, resolvedSteelId: steelId, type: "product-resolve" });
        setSearchParams({ id: steelId, type: "steel" });
      } catch (err) {
        setSearchError(`부품 ID 조회 실패: ${parseContractError(err)}`);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchParams({ id, type: "steel" });
    }
  }, [readContract, setSearchParams]);

  const handleSteelLoaded = useCallback(async (onchain) => {
    const sid = onchain?.steelId;
    if (!sid) return;
    try {
      const kv = await fetchSteelMeta(sid);
      if (kv) setMetaMap((prev) => {
        if (prev.get(sid) === kv) return prev;
        const next = new Map(prev); next.set(sid, kv); return next;
      });
    } catch { /* grade 없이도 트리 정상 동작 */ }
  }, []);

  const handleNodeSelect = useCallback((steelId) => {
    setDetailSteelId(steelId); setSelectedNodeId(steelId);
  }, []);

  const handleBackToRoot = useCallback(() => {
    setDetailSteelId(rootSteelId); setSelectedNodeId(rootSteelId);
  }, [rootSteelId]);

  return (
    <PageLayout>

      {/* ── 페이지 헤더 ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-surface">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4.25V10.75L7 14L1.5 10.75V4.25L7 1Z"
                fill="none" stroke="#93c5fd" strokeWidth="1.2"/>
            </svg>
          </span>
          <h2 className="text-base font-bold text-gray-900">강재 이력 조회</h2>
        </div>
        <p className="text-xs text-gray-500 ml-8">
          강재 ID 또는 부품 ID로 온체인 데이터·화학 성분·MTC PDF·이력 트리를 조회합니다
        </p>
      </div>

      {/* ── 검색 패널 ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 shadow-sm">
        <SearchPanel
          searchId={urlId}
          searchType={urlType}
          onSearch={handleSearch}
          isLoading={isSearching}
        />
        {searchError && (
          <p className="mt-2.5 text-sm text-red-600 flex items-center gap-1.5">
            <span className="font-bold">✗</span>{searchError}
          </p>
        )}
      </div>

      {/* ── 결과 없음 ─────────────────────────────────────────────────────── */}
      {!rootSteelId && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl
                        flex flex-col items-center justify-center py-20 gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-300">
            <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2"/>
            <path d="M27 27L34 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm text-gray-400">강재 ID 또는 부품 ID를 입력하여 이력을 조회하세요</p>
          <p className="text-xs text-gray-300">예: H_STS304_001 · P_001</p>
        </div>
      )}

      {/* ── 검색 결과 ─────────────────────────────────────────────────────── */}
      {rootSteelId && (
        <div className="flex gap-5 items-start">

          {/* 좌측: 강재 상세 */}
          <div className="shrink-0 w-[380px]">
            {detailSteelId !== rootSteelId && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] text-gray-400 font-mono truncate">{detailSteelId}</span>
                <button
                  onClick={handleBackToRoot}
                  className="text-[11px] text-blue-600 hover:text-blue-800
                             flex items-center gap-1 shrink-0 ml-2 font-medium"
                >
                  ← 루트로
                </button>
              </div>
            )}
            <SteelDetail steelId={detailSteelId} onSteelLoaded={handleSteelLoaded} />
          </div>

          {/* 우측: 이력 트리 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                이력 트리
              </p>
              <p className="text-[10px] text-gray-400">
                노드 클릭 → 상세 전환 · 휠 줌 · 드래그
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
