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
import { FormCard, TxtInput, WeightGauge, ActionFooter, ConfirmModal } from "../TxShared";
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
    <div className="tx-wrap">
      <div className="form-stack">

        {/* ── 부모 강재 선택 */}
        <FormCard title="부모 강재 선택" en="Parent">
          <div className="lookup-confirm-bar">
            <TxtInput value={parentInput}
              onChange={(v) => { setParentInput(v); setParentData(null); setParentError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleQueryParent()}
              placeholder="분할할 강재 ID — 예) H_003"
              state={parentData && !parentError ? "ok" : parentError ? "error" : null}
              disabled={isSending} />
            <button className="btn-query" onClick={handleQueryParent}
              disabled={!parentInput.trim() || isLoadingParent || isSending}>
              {isLoadingParent
                ? <span style={{ display:"inline-block",width:14,height:14,border:"2px solid #ccc",borderTop:"2px solid #4b5160",borderRadius:"999px",animation:"spin .9s linear infinite" }} />
                : "조회"}
            </button>
          </div>
          {parentData && !parentError && (
            <div className="confirm-chip ok">
              <span className="mk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="cid">{parentData.steelId}</span>
              <div className="pieces">
                {parentMeta?.grade && <span className="pc">{parentMeta.grade}</span>}
                <span className="pc"><b>{Number(gramsToKg(parentData.weight)).toLocaleString("ko-KR")}</b> kg</span>
                <span className="pc">소유자: <b>본인</b></span>
              </div>
              <span className="badge badge-active" style={{ marginLeft: "auto" }}><span className="dot"></span>ACTIVE</span>
            </div>
          )}
          {parentError && (
            <div className="confirm-chip err">
              <span className="mk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
              <span className="cid">{parentInput.trim()}</span>
              <span className="errmsg">{parentError}</span>
            </div>
          )}
        </FormCard>

        {/* ── 자식 무게 입력 */}
        <FormCard title="자식 무게 입력" en={`min ${MIN_CHILDREN} · max ${MAX_CHILDREN} · 현재 ${childWeights.length}개`}>
          <div className="child-rows">
            {childWeights.map((w, i) => (
              <div className="child-row" key={i}>
                <span className="idx">자식 {i + 1}</span>
                <TxtInput value={w} onChange={(v) => updateChild(i, v)}
                  type="number" suffix="kg" placeholder="0.0"
                  state={w && parseFloat(w) <= 0 ? "error" : null}
                  disabled={isSending} />
                {childWeights.length > MIN_CHILDREN && (
                  <button className="rm" onClick={() => setChildWeights((prev) => prev.filter((_, j) => j !== i))} aria-label="제거">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="row-ctrls">
            <button className="btn-add" onClick={addChild} disabled={childWeights.length >= MAX_CHILDREN || isSending}>+ 행 추가</button>
            <button className="btn-add" onClick={removeLastChild} disabled={childWeights.length <= MIN_CHILDREN || isSending}>− 마지막 제거</button>
          </div>
          {parentConfirmed && (
            <WeightGauge parent={parentWeightKg} child={childSumKg} threshold={MAX_LOSS_PCT} />
          )}
        </FormCard>

        <ActionFooter
          canSubmit={canSplit}
          gateNote={!parentConfirmed ? "부모 강재를 먼저 조회하세요" : "무게 검증 통과 후 활성화"}
          submitLabel="MetaMask로 분할"
          onReset={() => setResetConfirm(true)}
          onSubmit={handleSplit}
          loading={isSending}
        />
      </div>

      {resetConfirm && (
        <ConfirmModal title="폼을 초기화하시겠습니까?" body="입력된 모든 정보가 초기화됩니다."
          confirmLabel="초기화" onConfirm={() => handleReset()} onCancel={() => setResetConfirm(false)} />
      )}
    </div>
  );
}
