/**
 * 사용 매핑 컴포넌트
 * 화면설계서 §9 기준
 *
 * - 강재 조회: getSteel 뷰 + KV 메타데이터 (본인 소유 + ACTIVE 검증)
 * - 부품 ID (블록체인 저장) + 부품 설명 (Workers KV 저장)
 * - 불가역 경고: 등록 후 강재 상태 USED로 변경
 * - markAsUsed(steelId, productId) 트랜잭션
 * - 성공 후 Workers POST /api/product (부품 설명 저장)
 *   ※ 트랜잭션 실패 시 saveProductDesc 절대 호출하지 않음
 */

import { useState } from "react";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { useTx } from "../../contexts/TxContext";
import { fetchSteelMeta, saveProductDesc } from "../../utils/api";
import { gramsToKg, STATUS_LABEL } from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../../utils/logger";

export default function SteelUsage() {
  // ── 강재 조회 상태 ─────────────────────────────────────────────────────────
  const [steelInput, setSteelInput]     = useState("");
  const [isLoadingSteel, setLoadingSteel] = useState(false);
  const [steelData, setSteelData]       = useState(null);
  const [steelMeta, setSteelMeta]       = useState(null);
  const [steelError, setSteelError]     = useState("");

  // ── 부품 정보 입력 상태 ────────────────────────────────────────────────────
  const [productId, setProductId]       = useState("");
  const [productDesc, setProductDesc]   = useState("");

  // ── 트랜잭션 상태 ─────────────────────────────────────────────────────────
  const [isSending, setIsSending]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { readContract, getSignedContract } = useContract();
  const { account, isConnected }            = useWallet();
  const { pushTx, updateTx }                = useTx();

  // ── 강재 조회 ──────────────────────────────────────────────────────────────
  async function handleQuerySteel() {
    const id = steelInput.trim();
    if (!id) return;

    setSteelData(null);
    setSteelMeta(null);
    setSteelError("");
    setLoadingSteel(true);

    try {
      const [steel, meta] = await Promise.all([
        readContract.getSteel(id),
        fetchSteelMeta(id).catch(() => null),
      ]);

      setSteelData(steel);
      setSteelMeta(meta);

      const ownerMatch = steel.owner?.toLowerCase() === account?.toLowerCase();
      const isActive   = Number(steel.status) === 0;

      if (!ownerMatch) {
        setSteelError("본인이 소유한 강재가 아닙니다");
      } else if (!isActive) {
        setSteelError(`사용 등록 불가: 강재 상태가 ${STATUS_LABEL[Number(steel.status)]}입니다`);
      }

      console.log("[SteelUsage] 강재 조회:", { id, owner: steel.owner, status: steel.status });
    } catch (err) {
      const msg = parseContractError(err);
      setSteelError(msg);
      console.warn("[SteelUsage] 강재 조회 실패:", err.message);
    } finally {
      setLoadingSteel(false);
    }
  }

  // ── markAsUsed 트랜잭션 ────────────────────────────────────────────────────
  async function handleMarkUsed() {
    if (!canSubmit || isSending) return;

    const finalSteelId   = steelInput.trim();
    const finalProductId = productId.trim();
    const finalDesc      = productDesc.trim();

    setIsSending(true);
    const txId = pushTx({
      label: `사용 등록: ${finalSteelId} → ${finalProductId}`,
    });

    try {
      const contract = await getSignedContract();
      const tx = await contract.markAsUsed(finalSteelId, finalProductId);
      logTxSent("markAsUsed", { steelId: finalSteelId, productId: finalProductId, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log("[SteelUsage] markAsUsed 완료:", {
        steelId: finalSteelId, productId: finalProductId, block: receipt.blockNumber,
      });

      // 트랜잭션 성공 후에만 Workers KV에 부품 설명 저장
      if (finalDesc) {
        try {
          await saveProductDesc({ productId: finalProductId, description: finalDesc });
          console.log("[SteelUsage] Workers KV 부품 설명 저장 완료:", finalProductId);
        } catch (apiErr) {
          console.error("[SteelUsage] Workers KV 저장 실패 (온체인은 성공):", apiErr.message);
        }
      }

      handleReset(true);
    } catch (err) {
      const msg = parseContractError(err);
      logContractError("markAsUsed", msg, { steelId: finalSteelId, productId: finalProductId });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[SteelUsage] markAsUsed 실패:", err);
      // ↑ 실패 시 saveProductDesc 호출하지 않음 (위 로직 구조상 보장)
    } finally {
      setIsSending(false);
    }
  }

  // ── 폼 초기화 ─────────────────────────────────────────────────────────────
  function handleReset(silent = false) {
    if (!silent) setResetConfirm(false);
    setSteelInput("");
    setSteelData(null);
    setSteelMeta(null);
    setSteelError("");
    setProductId("");
    setProductDesc("");
  }

  // ── 버튼 활성 조건 ─────────────────────────────────────────────────────────
  const steelConfirmed = !!steelData && !steelError
    && Number(steelData.status) === 0
    && steelData.owner?.toLowerCase() === account?.toLowerCase();

  const canSubmit = steelConfirmed
    && productId.trim() !== ""
    && isConnected
    && !isSending;

  return (
    <div className="max-w-lg space-y-5">

      {/* ── 사용할 강재 선택 ─────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">사용할 강재 선택</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={steelInput}
            onChange={(e) => {
              setSteelInput(e.target.value);
              setSteelData(null);
              setSteelError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleQuerySteel()}
            placeholder="강재 ID  (예: PIPE_001)"
            className="input"
            disabled={isSending}
          />
          <button
            onClick={handleQuerySteel}
            disabled={!steelInput.trim() || isLoadingSteel || isSending}
            className="btn-ghost shrink-0"
          >
            {isLoadingSteel
              ? <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
              : "조회"}
          </button>
        </div>

        {steelData && !steelError && (
          <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm">
            <span className="text-green-600 font-bold shrink-0">✓</span>
            <span className="font-mono font-semibold text-gray-900">{steelData.steelId}</span>
            {steelMeta?.grade && <span className="text-gray-600">{steelMeta.grade}</span>}
            <span className="text-gray-700 font-medium">
              {gramsToKg(steelData.weight)} kg
            </span>
            <span className="text-gray-500 text-xs">소유자: 본인</span>
            <span className="badge-active ml-auto">ACTIVE</span>
          </div>
        )}
        {steelError && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
            <span className="text-red-600 font-bold shrink-0">✗</span>
            <span className="text-red-700">{steelError}</span>
          </div>
        )}
      </div>

      {/* ── 부품 정보 입력 ────────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">부품 정보 입력</p>
        <div className="space-y-3">
          <div>
            <label className="label">
              부품 ID{" "}
              <span className="text-blue-600 text-xs font-normal">(블록체인)</span>
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="P_001"
              className="input"
              disabled={isSending}
            />
          </div>
          <div>
            <label className="label">
              부품 설명{" "}
              <span className="text-amber-600 text-xs font-normal">(서버 저장)</span>
            </label>
            <input
              type="text"
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              placeholder="자동화 설비 A 프레임"
              className="input"
              disabled={isSending}
            />
          </div>
        </div>
      </div>

      {/* ── 불가역 경고 ───────────────────────────────────────────────────── */}
      <div className="warning-box">
        ⚠ 등록 완료 후 해당 강재의 상태는 <strong>USED</strong>로 변경됩니다.
        이 작업은 <strong>되돌릴 수 없습니다.</strong>
      </div>

      {/* ── 버튼 영역 ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <button onClick={() => setResetConfirm(true)} className="btn-ghost" disabled={isSending}>
          초기화
        </button>
        <button onClick={handleMarkUsed} disabled={!canSubmit} className="btn-blue min-w-[180px]">
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              트랜잭션 전송 중...
            </span>
          ) : "MetaMask로 사용 등록 ✍"}
        </button>
      </div>

      {!isConnected && (
        <p className="text-xs text-amber-600 text-center -mt-2">
          MetaMask 연결 후 사용 등록할 수 있습니다
        </p>
      )}

      {/* ── 초기화 확인 모달 ─────────────────────────────────────────────── */}
      {resetConfirm && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResetConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-2">폼을 초기화하시겠습니까?</h3>
            <p className="text-sm text-gray-600 mb-5">입력된 모든 정보가 초기화됩니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirm(false)} className="btn-ghost flex-1">취소</button>
              <button onClick={() => handleReset()} className="btn-blue flex-1">초기화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
