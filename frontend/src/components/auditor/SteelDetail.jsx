/**
 * 강재 상세 패널 — Claude Design DetailPanel 스타일 적용
 */

import { useState, useEffect } from "react";
import { useContract } from "../../hooks/useContract";
import { fetchSteelMeta } from "../../utils/api";
import {
  gramsToKg, shortenAddress, formatTimestamp, STATUS_LABEL,
} from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { IPFS_GATEWAY, ETHERSCAN_BASE } from "../../constants/addresses";
import { logQuery } from "../../utils/logger";
import PdfVerifier from "./PdfVerifier";

const STATUS_KEY = { 0: "active", 1: "split", 2: "combined", 3: "used" };
const STATUS_KO  = { 0: "발행·유효", 1: "분할됨", 2: "조합됨", 3: "사용완료" };

export default function SteelDetail({ steelId, onSteelLoaded }) {
  const [isLoading, setLoading] = useState(false);
  const [steel, setSteel]       = useState(null);
  const [meta,  setMeta]        = useState(null);
  const [error, setError]       = useState("");

  const { readContract } = useContract();

  useEffect(() => {
    if (!steelId || !readContract) return;
    let cancelled = false;
    setLoading(true); setSteel(null); setMeta(null); setError("");

    (async () => {
      try {
        const [onchain, kv] = await Promise.all([
          readContract.getSteel(steelId),
          fetchSteelMeta(steelId).catch(() => null),
        ]);
        if (cancelled) return;
        setSteel(onchain); setMeta(kv);
        onSteelLoaded?.(onchain);
        logQuery({ steelId, status: Number(onchain.status), hasKvMeta: !!kv });
      } catch (err) {
        if (cancelled) return;
        setError(parseContractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [steelId, readContract]);

  // ── 빈 상태 ─────────────────────────────────────────────────────────────
  if (!steelId) return (
    <div className="detail" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px" }}>
      <span style={{ fontSize: "13px", color: "#80868f" }}>강재 ID를 검색하면 상세 정보가 표시됩니다</span>
    </div>
  );

  if (isLoading) return (
    <div className="detail" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "48px 20px" }}>
      <span style={{
        display: "inline-block", width: "18px", height: "18px",
        border: "2px solid #e1e2e5", borderTop: "2px solid #4b5160",
        borderRadius: "999px", animation: "spin 0.9s linear infinite",
      }} />
      <span style={{ fontSize: "13px", color: "#80868f" }}>조회 중...</span>
    </div>
  );

  if (error) return (
    <div className="detail">
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#b42318" }}>
          <span style={{ fontWeight: 700 }}>✗</span>{error}
        </div>
        <p style={{ fontSize: "11px", color: "#80868f", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
          {steelId}
        </p>
      </div>
    </div>
  );

  if (!steel) return null;

  const statusN  = Number(steel.status);
  const statusKey = STATUS_KEY[statusN] ?? "used";
  const hasPdf    = steel.ipfsCid?.length > 0;

  return (
    <div className="detail">

      {/* ── 헤더 ──────────────────────────────────────────────────────── */}
      <div className="detail-head">
        <div className="id">
          {steel.steelId}
          <span className="sub">
            {STATUS_KO[statusN]} · {meta?.grade || "—"}
          </span>
        </div>
        <span className={`badge badge-${statusKey}`}>
          <span className="dot"></span>
          {STATUS_LABEL[statusN]}
        </span>
      </div>

      {/* ── 핵심 정보 (온체인) ─────────────────────────────────────────── */}
      <div className="detail-section">
        <div className="sec-label">
          <span>핵심 정보</span>
          <span className="onchain-note">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
            온체인
          </span>
        </div>

        <div className="prop">
          <span className="k">발행사</span>
          <span className="v">
            <a href={`${ETHERSCAN_BASE}/address/${steel.mill}`}
               target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--text-primary)", textDecoration: "none" }}>
              POSCO
              <span className="addr">{shortenAddress(steel.mill)}</span>
            </a>
          </span>
        </div>
        <div className="prop">
          <span className="k">현 소유</span>
          <span className="v">
            <a href={`${ETHERSCAN_BASE}/address/${steel.owner}`}
               target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--text-primary)", textDecoration: "none" }}>
              <span className="addr" style={{ marginLeft: 0 }}>{shortenAddress(steel.owner)}</span>
            </a>
          </span>
        </div>
        <div className="prop">
          <span className="k">무게</span>
          <span className="v mono">
            {Number(gramsToKg(steel.weight)).toLocaleString("ko-KR")} kg
          </span>
        </div>
        <div className="prop">
          <span className="k">발행일</span>
          <span className="v mono">{formatTimestamp(steel.createdAt)}</span>
        </div>
        {steel.parentIds?.length > 0 && (
          <div className="prop">
            <span className="k">부모</span>
            <span className="v mono" style={{ fontSize: "11px", color: "#4b5160" }}>
              {steel.parentIds.join(", ")}
            </span>
          </div>
        )}
        {steel.childIds?.length > 0 && (
          <div className="prop">
            <span className="k">자식</span>
            <span className="v" style={{ fontSize: "12px" }}>
              {steel.childIds.length}개
            </span>
          </div>
        )}
      </div>

      {/* ── 화학 성분 ─────────────────────────────────────────────────── */}
      <div className="detail-section">
        <div className="sec-label">
          <span>화학 성분 (%)</span>
          <span className="src-note">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            서버 데이터 · 참고용
          </span>
        </div>
        {meta ? (
          <div className="spec-grid">
            {[
              { el: "C",  v: meta.chemC },
              { el: "Si", v: meta.chemSi },
              { el: "Mn", v: meta.chemMn },
              { el: "P",  v: meta.chemP },
              { el: "S",  v: meta.chemS },
            ].map(({ el, v }) => (
              <div className="spec-cell" key={el}>
                <div className="el">{el}</div>
                <div className="num">{v != null ? Number(v).toFixed(3) : "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: "#80868f", margin: 0 }}>서버 메타데이터 없음</p>
        )}
      </div>

      {/* ── 기계적 성질 ───────────────────────────────────────────────── */}
      <div className="detail-section">
        <div className="sec-label">
          <span>기계적 성질</span>
          <span className="src-note">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            서버 데이터 · 참고용
          </span>
        </div>
        {meta ? (
          <div className="spec-grid mech">
            <div className="spec-cell">
              <div className="el">항복강도</div>
              <div className="num">{meta.yieldStrength ?? "—"}<span className="unit"> MPa</span></div>
            </div>
            <div className="spec-cell">
              <div className="el">인장강도</div>
              <div className="num">{meta.tensileStrength ?? "—"}<span className="unit"> MPa</span></div>
            </div>
            <div className="spec-cell">
              <div className="el">연신율</div>
              <div className="num">{meta.elongation ?? "—"}<span className="unit"> %</span></div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: "#80868f", margin: 0 }}>서버 메타데이터 없음</p>
        )}
      </div>

      {/* ── MTC PDF ───────────────────────────────────────────────────── */}
      <div className="detail-section">
        <div className="sec-label">
          <span>MTC PDF</span>
          <span className="onchain-note">SHA-256 온체인 검증</span>
        </div>
        {hasPdf ? (
          <div>
            <div className="ipfs-row">
              <span>IPFS</span>
              <span className="cid">{steel.ipfsCid.slice(0, 20)}…</span>
              <a href={`${IPFS_GATEWAY}/${steel.ipfsCid}`} target="_blank" rel="noopener noreferrer">
                열기
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 2 }}>
                  <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </a>
            </div>
            <PdfVerifier cid={steel.ipfsCid} pdfHash={steel.pdfHash} />
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: "#80868f", margin: 0 }}>PDF 미등록</p>
        )}
      </div>

    </div>
  );
}
