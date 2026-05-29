/**
 * 강재 상세 정보 패널
 * 화면설계서 §4 기준
 *
 * - 온체인 데이터(getSteel) + KV 메타데이터(fetchSteelMeta) 병렬 조회
 * - 상태 뱃지: ACTIVE=초록, SPLIT=노랑, COMBINED=주황, USED=회색
 * - 화학성분 / 기계적 성질: "⚠ 서버 데이터 (참고용)" 주석 병기
 * - IPFS CID 링크 + PdfVerifier 인라인
 */

import { useState, useEffect } from "react";
import { useContract } from "../../hooks/useContract";
import { fetchSteelMeta } from "../../utils/api";
import {
  gramsToKg,
  shortenAddress,
  formatTimestamp,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { IPFS_GATEWAY, ETHERSCAN_BASE } from "../../constants/addresses";
import { logQuery } from "../../utils/logger";
import PdfVerifier from "./PdfVerifier";

export default function SteelDetail({ steelId, onSteelLoaded }) {
  const [isLoading, setLoading]   = useState(false);
  const [steel, setSteel]         = useState(null);
  const [meta, setMeta]           = useState(null);
  const [error, setError]         = useState("");

  const { readContract } = useContract();

  useEffect(() => {
    if (!steelId || !readContract) return;

    let cancelled = false;
    setLoading(true);
    setSteel(null);
    setMeta(null);
    setError("");

    const load = async () => {
      try {
        const [onchain, kv] = await Promise.all([
          readContract.getSteel(steelId),
          fetchSteelMeta(steelId).catch(() => null),
        ]);

        if (cancelled) return;
        setSteel(onchain);
        setMeta(kv);
        onSteelLoaded?.(onchain);

        logQuery({
          steelId,
          status: Number(onchain.status),
          hasKvMeta: !!kv,
        });
        console.log("[SteelDetail] 조회 완료:", { steelId, status: onchain.status });
      } catch (err) {
        if (cancelled) return;
        const msg = parseContractError(err);
        setError(msg);
        console.warn("[SteelDetail] 조회 실패:", err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [steelId, readContract]);

  if (!steelId) {
    return (
      <div className="section-card text-sm text-gray-400 text-center py-10">
        강재 ID를 검색하면 상세 정보가 표시됩니다
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="section-card flex items-center justify-center py-10 gap-3">
        <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-gray-500">조회 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-card">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <span className="font-bold">✗</span>
          <span>{error}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1 font-mono">{steelId}</p>
      </div>
    );
  }

  if (!steel) return null;

  const statusNum  = Number(steel.status);
  const statusKey  = STATUS_BADGE_CLASS[statusNum] || "badge-used";
  const pdfHashHex = steel.pdfHash;
  const hasPdf     = steel.ipfsCid && steel.ipfsCid.length > 0;

  return (
    <div className="section-card space-y-0 !p-0 overflow-hidden">

      {/* ── 헤더: 강재 ID + 상태 뱃지 ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <span className="font-mono font-bold text-gray-900 text-base">{steel.steelId}</span>
        <span className={statusKey}>{STATUS_LABEL[statusNum]}</span>
      </div>

      {/* ── 기본 정보 ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-2 border-b border-gray-100">
        <InfoRow label="등급" value={meta?.grade || <span className="text-gray-400">미조회</span>} />
        <InfoRow
          label="발행사"
          value={
            <a
              href={`${ETHERSCAN_BASE}/address/${steel.mill}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:text-blue-800 text-xs"
            >
              {shortenAddress(steel.mill)}
            </a>
          }
        />
        <InfoRow
          label="현 소유자"
          value={
            <a
              href={`${ETHERSCAN_BASE}/address/${steel.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:text-blue-800 text-xs"
            >
              {shortenAddress(steel.owner)}
            </a>
          }
        />
        <InfoRow
          label="무게"
          value={<span className="font-mono">{Number(gramsToKg(steel.weight)).toLocaleString("ko-KR")} kg</span>}
        />
        <InfoRow
          label="발행일"
          value={<span className="font-mono text-xs">{formatTimestamp(steel.createdAt)}</span>}
        />
        {steel.parentIds?.length > 0 && (
          <InfoRow
            label="부모 강재"
            value={
              <span className="font-mono text-xs text-gray-600">
                [{steel.parentIds.join(", ")}]
              </span>
            }
          />
        )}
        {steel.childIds?.length > 0 && (
          <InfoRow
            label="자식 강재"
            value={
              <span className="font-mono text-xs text-gray-600">
                {steel.childIds.length}개
              </span>
            }
          />
        )}
      </div>

      {/* ── 화학 성분 (KV 서버 데이터) ────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">화학 성분 (%)</p>
          <span className="text-amber-600 text-[10px]">⚠ 서버 데이터 (참고용)</span>
        </div>
        {meta ? (
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { el: "C",  val: meta.chemC },
              { el: "Si", val: meta.chemSi },
              { el: "Mn", val: meta.chemMn },
              { el: "P",  val: meta.chemP },
              { el: "S",  val: meta.chemS },
            ].map(({ el, val }) => (
              <div key={el} className="bg-gray-50 rounded p-1.5">
                <p className="text-[10px] text-gray-400 font-mono">{el}</p>
                <p className="text-xs font-semibold text-gray-800">
                  {val != null ? Number(val).toFixed(3) : "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">서버 메타데이터 없음</p>
        )}
      </div>

      {/* ── 기계적 성질 (KV 서버 데이터) ──────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">기계적 성질</p>
          <span className="text-amber-600 text-[10px]">⚠ 서버 데이터 (참고용)</span>
        </div>
        {meta ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 rounded p-1.5">
              <p className="text-[10px] text-gray-400">항복강도</p>
              <p className="text-xs font-semibold">{meta.yieldStrength ?? "—"} <span className="font-normal text-[10px]">MPa</span></p>
            </div>
            <div className="text-center bg-gray-50 rounded p-1.5">
              <p className="text-[10px] text-gray-400">인장강도</p>
              <p className="text-xs font-semibold">{meta.tensileStrength ?? "—"} <span className="font-normal text-[10px]">MPa</span></p>
            </div>
            <div className="text-center bg-gray-50 rounded p-1.5">
              <p className="text-[10px] text-gray-400">연신율</p>
              <p className="text-xs font-semibold">{meta.elongation ?? "—"} <span className="font-normal text-[10px]">%</span></p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">서버 메타데이터 없음</p>
        )}
      </div>

      {/* ── PDF / IPFS ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">MTC PDF</p>
        {hasPdf ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 font-mono">
                IPFS: {steel.ipfsCid.slice(0, 12)}…
              </span>
              <a
                href={`${IPFS_GATEWAY}/${steel.ipfsCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 text-xs"
              >
                IPFS 열기 ↗
              </a>
            </div>
            <PdfVerifier cid={steel.ipfsCid} pdfHash={pdfHashHex} />
          </>
        ) : (
          <p className="text-xs text-gray-400">PDF 미등록</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 shrink-0 w-16">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}
