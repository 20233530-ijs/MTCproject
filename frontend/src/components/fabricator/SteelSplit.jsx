/**
 * 강재 분할 컴포넌트
 * 화면설계서 §7 기준
 *
 * - 부모 강재 조회: getSteel 뷰 + KV 메타데이터 (본인 소유 + ACTIVE 검증)
 * - 자식 무게 배열: 최소 2개 / 최대 10개
 * - 실시간 무게 검증: 자식 합계 ≤ 부모, 손실률 ≤ 10%
 * - splitSteel(parentId, childWeights[]) 트랜잭션
 */

import { useState } from "react";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { useTx } from "../../contexts/TxContext";
import { fetchSteelMeta } from "../../utils/api";
import { gramsToKg, kgToGrams, STATUS_LABEL } from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../../utils/logger";

const MIN_CHILDREN = 2;
const MAX_CHILDREN = 10;
const MAX_LOSS_PCT  = 10; // 허용 손실률 상한 (%)

export default function SteelSplit() {
  // ── 부모 강재 상태 ─────────────────────────────────────────────────────────
  const [parentInput, setParentInput]   = useState("");
  const [isLoadingParent, setLoadingParent] = useState(false);
  const [parentData, setParentData]     = useState(null);
  const [parentMeta, setParentMeta]     = useState(null);
  const [parentError, setParentError]   = useState("");

  // ── 자식 무게 배열 ─────────────────────────────────────────────────────────
  const [childWeights, setChildWeights] = useState(["", ""]);

  // ── 트랜잭션 상태 ──────────────────────────────────────────────────────────
  const [isSending, setIsSending]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { readContract, getSignedContract } = useContract();
  const { account, isConnected }            = useWallet();
  const { pushTx, updateTx }                = useTx();

  // ── 부모 강재 조회 ─────────────────────────────────────────────────────────
  async function handleQueryParent() {
    const id = parentInput.trim();
    if (!id) return;

    setParentData(null);
    setParentMeta(null);
    setParentError("");
    setLoadingParent(true);

    try {
      const [steel, meta] = await Promise.all([
        readContract.getSteel(id),
        fetchSteelMeta(id).catch(() => null),
      ]);

      setParentData(steel);
      setParentMeta(meta);

      const ownerMatch = steel.owner?.toLowerCase() === account?.toLowerCase();
      const isActive   = Number(steel.status) === 0;

      if (!ownerMatch) {
        setParentError("본인이 소유한 강재가 아닙니다");
      } else if (!isActive) {
        setParentError(`분할 불가: 강재 상태가 ${STATUS_LABEL[Number(steel.status)]}입니다`);
      }

      console.log("[SteelSplit] 부모 강재 조회:", { id, weight: steel.weight, status: steel.status });
    } catch (err) {
      const msg = parseContractError(err);
      setParentError(msg);
      console.warn("[SteelSplit] 부모 강재 조회 실패:", err.message);
    } finally {
      setLoadingParent(false);
    }
  }

  // ── 자식 무게 입력 핸들러 ──────────────────────────────────────────────────
  function updateChild(idx, val) {
    setChildWeights((prev) => prev.map((w, i) => (i === idx ? val : w)));
  }

  function addChild() {
    if (childWeights.length >= MAX_CHILDREN) return;
    setChildWeights((prev) => [...prev, ""]);
  }

  function removeLastChild() {
    if (childWeights.length <= MIN_CHILDREN) return;
    setChildWeights((prev) => prev.slice(0, -1));
  }

  // ── 무게 검증 계산 ─────────────────────────────────────────────────────────
  const parentWeightG = parentData ? Number(parentData.weight) : 0;
  const parentWeightKg = parentWeightG / 1000;

  // 유효한 자식 무게(양수)만 합산
  const validChildKgs = childWeights
    .map((w) => parseFloat(w))
    .filter((v) => !isNaN(v) && v > 0);

  const childSumKg   = validChildKgs.reduce((a, b) => a + b, 0);
  const childSumG    = Math.round(childSumKg * 1000);
  const allFilled    = childWeights.every((w) => parseFloat(w) > 0);

  // 손실률 계산 (자식 합계가 부모보다 작을 때만 의미 있음)
  const lossKg  = parentWeightKg - childSumKg;
  const lossPct = parentWeightKg > 0 ? (lossKg / parentWeightKg) * 100 : 0;

  // 검증 상태
  const exceedsParent  = childSumG > parentWeightG;
  const exceedsLoss    = lossPct > MAX_LOSS_PCT && !exceedsParent;
  const validationOk   = !exceedsParent && !exceedsLoss && allFilled && parentWeightKg > 0;

  // 진행바 비율
  const barPct = parentWeightG > 0
    ? Math.min(100, (childSumG / parentWeightG) * 100)
    : 0;

  const barColor = exceedsParent
    ? "bg-red-500"
    : exceedsLoss
    ? "bg-red-500"
    : "bg-green-500";

  // ── splitSteel 트랜잭션 ────────────────────────────────────────────────────
  async function handleSplit() {
    if (!canSplit || isSending) return;

    const parentId = parentInput.trim();
    // 각 자식 무게를 grams 단위 uint256으로 변환
    const weightsGrams = childWeights.map((w) => kgToGrams(w));

    setIsSending(true);
    const txId = pushTx({
      label: `강재 분할: ${parentId} → ${childWeights.length}조각`,
    });

    try {
      const contract = await getSignedContract();
      const tx = await contract.splitSteel(parentId, weightsGrams);
      logTxSent("splitSteel", { parentId, childCount: weightsGrams.length, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log("[SteelSplit] splitSteel 완료:", {
        parentId,
        childCount: weightsGrams.length,
        block: receipt.blockNumber,
      });

      handleReset(true);
    } catch (err) {
      const msg = parseContractError(err);
      logContractError("splitSteel", msg, { parentId });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[SteelSplit] splitSteel 실패:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── 폼 초기화 ──────────────────────────────────────────────────────────────
  function handleReset(silent = false) {
    if (!silent) setResetConfirm(false);
    setParentInput("");
    setParentData(null);
    setParentMeta(null);
    setParentError("");
    setChildWeights(["", ""]);
  }

  const parentConfirmed = !!parentData && !parentError
    && Number(parentData.status) === 0
    && parentData.owner?.toLowerCase() === account?.toLowerCase();

  const canSplit = parentConfirmed && validationOk && isConnected && !isSending;

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── 부모 강재 선택 ──────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">부모 강재 선택</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={parentInput}
            onChange={(e) => {
              setParentInput(e.target.value);
              setParentData(null);
              setParentError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleQueryParent()}
            placeholder="강재 ID  (예: H_003)"
            className="input"
            disabled={isSending}
          />
          <button
            onClick={handleQueryParent}
            disabled={!parentInput.trim() || isLoadingParent || isSending}
            className="btn-ghost shrink-0"
          >
            {isLoadingParent ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
            ) : "조회"}
          </button>
        </div>

        {parentData && !parentError && (
          <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm">
            <span className="text-green-600 font-bold shrink-0">✓</span>
            <span className="font-mono font-semibold text-gray-900">{parentData.steelId}</span>
            {parentMeta?.grade && <span className="text-gray-600">{parentMeta.grade}</span>}
            <span className="text-gray-700 font-medium">
              {Number(gramsToKg(parentData.weight)).toLocaleString("ko-KR")} kg
            </span>
            <span className="text-gray-500 text-xs">소유자: 본인</span>
            <span className="badge-active ml-auto">ACTIVE</span>
          </div>
        )}
        {parentError && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
            <span className="text-red-600 font-bold shrink-0">✗</span>
            <span className="text-red-700">{parentError}</span>
          </div>
        )}
      </div>

      {/* ── 자식 무게 입력 ──────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          자식 무게 입력{" "}
          <span className="text-gray-400 normal-case text-xs">
            (최소 {MIN_CHILDREN}개 / 최대 {MAX_CHILDREN}개)
          </span>
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {childWeights.map((w, i) => (
            <div key={i}>
              <label className="label">
                자식 {i + 1}{" "}
                <span className="font-mono text-xs text-gray-400">(kg)</span>
              </label>
              <input
                type="number"
                value={w}
                onChange={(e) => updateChild(i, e.target.value)}
                step="0.1"
                min="0.1"
                placeholder="0.0"
                className={[
                  "input",
                  // 값이 있고 유효하지 않으면 빨강
                  w && parseFloat(w) <= 0 ? "border-red-300" : "",
                ].join(" ")}
                disabled={isSending}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={addChild}
            disabled={childWeights.length >= MAX_CHILDREN || isSending}
            className="btn-ghost text-xs py-1.5"
          >
            + 행 추가
          </button>
          <button
            onClick={removeLastChild}
            disabled={childWeights.length <= MIN_CHILDREN || isSending}
            className="btn-ghost text-xs py-1.5"
          >
            - 마지막 제거
          </button>
          <span className="ml-auto text-xs text-gray-400 self-center">
            {childWeights.length}/{MAX_CHILDREN}개
          </span>
        </div>

        {/* ── 무게 검증 프리뷰 ─────────────────────────────────────────── */}
        {parentConfirmed && (
          <div className={[
            "mt-4 rounded-lg p-4 border",
            exceedsParent || exceedsLoss
              ? "bg-red-50 border-red-200"
              : validationOk
              ? "bg-green-50 border-green-200"
              : "bg-gray-50 border-gray-200",
          ].join(" ")}>
            <p className="text-xs font-semibold text-gray-600 mb-2">무게 검증</p>

            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">부모 무게</span>
                <span className="font-mono font-medium">
                  {parentWeightKg.toLocaleString("ko-KR")} kg
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">자식 합계</span>
                <span className={[
                  "font-mono font-semibold",
                  exceedsParent ? "text-red-600"
                  : exceedsLoss  ? "text-red-600"
                  : validationOk ? "text-green-700"
                  : "text-gray-700",
                ].join(" ")}>
                  {childSumKg.toFixed(1)} kg
                  {parentWeightKg > 0 && allFilled && (
                    <span className="ml-2 text-xs font-normal">
                      ({barPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              {allFilled && !exceedsParent && parentWeightKg > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">손실</span>
                  <span className={[
                    "font-mono font-semibold text-sm",
                    exceedsLoss ? "text-red-600" : "text-green-700",
                  ].join(" ")}>
                    {Math.max(0, lossKg).toFixed(1)} kg ({Math.max(0, lossPct).toFixed(1)}%)
                    {exceedsLoss
                      ? <span className="ml-1">✗ {MAX_LOSS_PCT}% 초과</span>
                      : <span className="ml-1">✓ {MAX_LOSS_PCT}% 이하</span>}
                  </span>
                </div>
              )}
              {exceedsParent && (
                <p className="text-red-600 text-xs font-semibold">
                  ✗ 자식 합계가 부모 무게를 초과합니다 (+{(childSumKg - parentWeightKg).toFixed(1)} kg)
                </p>
              )}
            </div>

            {/* 진행바 */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 버튼 영역 ────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setResetConfirm(true)}
          className="btn-ghost"
          disabled={isSending}
        >
          초기화
        </button>
        <button
          onClick={handleSplit}
          disabled={!canSplit}
          className="btn-blue min-w-[160px]"
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              트랜잭션 전송 중...
            </span>
          ) : (
            "MetaMask로 분할 ✍"
          )}
        </button>
      </div>

      {!isConnected && (
        <p className="text-xs text-amber-600 text-center -mt-2">
          MetaMask 연결 후 분할할 수 있습니다
        </p>
      )}

      {/* ── 초기화 확인 모달 ────────────────────────────────────────────── */}
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
