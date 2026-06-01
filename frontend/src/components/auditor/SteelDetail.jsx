/**
 * 강재 상세 정보 패널
 * 화면설계서 §4 기준
 */

import { useState, useEffect } from "react";
import { useContract } from "../../hooks/useContract";
import { fetchSteelMeta } from "../../utils/api";
import {
  gramsToKg,
  shortenAddress,
  formatTimestamp,
  STATUS_LABEL,
} from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { IPFS_GATEWAY, ETHERSCAN_BASE } from "../../constants/addresses";
import { logQuery } from "../../utils/logger";
import PdfVerifier from "./PdfVerifier";

// 상태 → 배지 스타일
const STATUS_BADGE = {
  0: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  1: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  2: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  3: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

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

  // ── 빈 상태 ──────────────────────────────────────────────────────────────
  if (!steelId) return (
    <div className="bg-white border border-gray-200 rounded-xl flex items-center
                    justify-center py-12 text-sm text-gray-400">
      강재 ID를 검색하면 상세 정보가 표시됩니다
    </div>
  );

  if (isLoading) return (
    <div className="bg-white border border-gray-200 rounded-xl
                    flex items-center justify-center gap-3 py-12">
      <span className="w-5 h-5 border-2 border-gray-200 border-t-blue-500
                       rounded-full animate-spin inline-block" />
      <span className="text-sm text-gray-500">조회 중...</span>
    </div>
  );

  if (error) return (
    <div className="bg-white border border-red-200 rounded-xl px-5 py-4">
      <p className="text-sm text-red-600 flex items-center gap-2">
        <span className="font-bold text-base">✗</span>{error}
      </p>
      <p className="text-xs text-gray-400 mt-1 font-mono">{steelId}</p>
    </div>
  );

  if (!steel) return null;

  const statusN  = Number(steel.status);
  const hasPdf   = steel.ipfsCid?.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5
                      bg-gray-50 border-b border-gray-200">
        <span className="font-mono font-bold text-sm text-gray-900 tracking-tight">
          {steel.steelId}
        </span>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[statusN]}`}>
          {STATUS_LABEL[statusN]}
        </span>
      </div>

      {/* ── 기본 정보 ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 space-y-2.5">
        <Row label="등급">
          {meta?.grade
            ? <span className="font-semibold text-gray-800 text-sm">{meta.grade}</span>
            : <span className="text-gray-400 text-xs">미조회</span>}
        </Row>
        <Row label="무게">
          <span className="font-mono text-sm font-semibold text-gray-800">
            {Number(gramsToKg(steel.weight)).toLocaleString("ko-KR")} kg
          </span>
        </Row>
        <Row label="발행사">
          <EthLink href={`${ETHERSCAN_BASE}/address/${steel.mill}`}>
            {shortenAddress(steel.mill)}
          </EthLink>
        </Row>
        <Row label="현 소유자">
          <EthLink href={`${ETHERSCAN_BASE}/address/${steel.owner}`}>
            {shortenAddress(steel.owner)}
          </EthLink>
        </Row>
        <Row label="발행일">
          <span className="font-mono text-xs text-gray-600">
            {formatTimestamp(steel.createdAt)}
          </span>
        </Row>
        {steel.parentIds?.length > 0 && (
          <Row label="부모">
            <span className="font-mono text-xs text-gray-500">
              {steel.parentIds.join(", ")}
            </span>
          </Row>
        )}
        {steel.childIds?.length > 0 && (
          <Row label="자식">
            <span className="text-xs text-gray-500">{steel.childIds.length}개</span>
          </Row>
        )}
      </div>

      {/* ── 화학 성분 ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <SectionHead label="화학 성분 (%)" warn />
        {meta ? (
          <div className="grid grid-cols-5 gap-1.5 mt-2.5">
            {[
              { el: "C",  v: meta.chemC },
              { el: "Si", v: meta.chemSi },
              { el: "Mn", v: meta.chemMn },
              { el: "P",  v: meta.chemP },
              { el: "S",  v: meta.chemS },
            ].map(({ el, v }) => (
              <div key={el} className="bg-gray-50 border border-gray-100
                                       rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-400 font-mono mb-0.5">{el}</p>
                <p className="text-xs font-semibold text-gray-800">
                  {v != null ? Number(v).toFixed(3) : "—"}
                </p>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-xs text-gray-400">서버 메타데이터 없음</p>}
      </div>

      {/* ── 기계적 성질 ───────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <SectionHead label="기계적 성질" warn />
        {meta ? (
          <div className="grid grid-cols-3 gap-1.5 mt-2.5">
            {[
              { label: "항복강도", v: meta.yieldStrength,  unit: "MPa" },
              { label: "인장강도", v: meta.tensileStrength, unit: "MPa" },
              { label: "연신율",   v: meta.elongation,      unit: "%" },
            ].map(({ label, v, unit }) => (
              <div key={label} className="bg-gray-50 border border-gray-100
                                          rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className="text-xs font-semibold text-gray-800">
                  {v ?? "—"}
                  <span className="font-normal text-gray-400 ml-0.5 text-[10px]">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-xs text-gray-400">서버 메타데이터 없음</p>}
      </div>

      {/* ── MTC PDF ───────────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <SectionHead label="MTC PDF" />
        {hasPdf ? (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100
                            rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 font-mono flex-1 truncate">
                {steel.ipfsCid.slice(0, 16)}…
              </span>
              <a href={`${IPFS_GATEWAY}/${steel.ipfsCid}`}
                 target="_blank" rel="noopener noreferrer"
                 className="text-[11px] text-blue-600 hover:text-blue-800 shrink-0 font-medium">
                IPFS ↗
              </a>
            </div>
            <PdfVerifier cid={steel.ipfsCid} pdfHash={steel.pdfHash} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-400">PDF 미등록</p>
        )}
      </div>

    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-gray-400 shrink-0 w-14 pt-0.5 font-medium">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function EthLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="font-mono text-xs text-blue-600 hover:text-blue-800
                  hover:underline transition-colors">
      {children}
    </a>
  );
}

function SectionHead({ label, warn }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      {warn && (
        <span className="text-[10px] text-amber-500 font-medium">⚠ 서버 데이터</span>
      )}
    </div>
  );
}
