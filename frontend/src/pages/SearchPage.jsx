/**
 * 강재/부품 ID 조회 페이지 — Claude Design search.jsx 레이아웃 적용
 * 트리 LEFT (1fr) + 상세 RIGHT (408px)
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

  const [isSearching,    setIsSearching]    = useState(false);
  const [searchError,    setSearchError]    = useState("");
  const [rootSteelId,    setRootSteelId]    = useState(urlId);
  const [detailSteelId,  setDetailSteelId]  = useState(urlId);
  const [selectedNodeId, setSelectedNodeId] = useState(urlId);
  const [metaMap,        setMetaMap]        = useState(() => new Map());

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

      {/* ── 페이지 헤더 ─────────────────────────────────────────────── */}
      <div className="search-page-head">
        <h1>
          강재 이력 조회
          <span className="en">On-chain Traceability</span>
        </h1>
        {urlId && (
          <div className="crumb">
            <span>조회</span>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>{urlId}</span>
          </div>
        )}
      </div>

      {/* ── 검색 바 ─────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--r-4)", padding: "20px", boxShadow: "0 1px 2px rgba(10,10,11,0.04)", marginBottom: "8px" }}>
        <SearchPanel
          searchId={urlId}
          searchType={urlType}
          onSearch={handleSearch}
          isLoading={isSearching}
        />
        {searchError && (
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#b42318" }}>
            <span style={{ fontWeight: 700 }}>✗</span>
            {searchError}
          </div>
        )}
      </div>

      {/* ── 빈 상태 ─────────────────────────────────────────────────── */}
      {!rootSteelId && (
        <div className="lookup-empty">
          <div className="ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>조회할 강재·부품 ID를 입력하세요</h3>
          <p>
            온체인에 기록된 MTC의 발행·분할·조합·이전·사용 이력을 조회하고,
            IPFS 원본 PDF의 해시를 컨트랙트와 대조해 진본성을 검증합니다.
          </p>
          <div className="examples">
            {["H_STS304_001", "H_001", "COMB_001", "P_001"].map((ex) => (
              <span key={ex} className="chip"
                    onClick={() => handleSearch(ex, "steel")}
                    style={{ cursor: "pointer" }}>
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 검색 결과: 트리(left) + 상세(right) ─────────────────────── */}
      {rootSteelId && (
        <div className="results">

          {/* LEFT: 이력 트리 (1fr) */}
          <div>
            {detailSteelId !== rootSteelId && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", padding: "0 2px" }}>
                <span style={{ fontSize: "11px", color: "#80868f", fontFamily: "var(--font-mono)" }}>
                  {detailSteelId}
                </span>
                <button
                  onClick={handleBackToRoot}
                  style={{ fontSize: "11px", color: "#0a0a0b", background: "none", border: "none", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  ← 루트로
                </button>
              </div>
            )}
            <AncestryTree
              rootId={rootSteelId}
              selectedId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              metaMap={metaMap}
            />
          </div>

          {/* RIGHT: 강재 상세 (408px) */}
          <div>
            <SteelDetail steelId={detailSteelId} onSteelLoaded={handleSteelLoaded} />
          </div>

        </div>
      )}

    </PageLayout>
  );
}
