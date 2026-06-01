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
import { FormCard, Field, TxtInput, IrreversibleWarning, ActionFooter, ConfirmModal } from "../TxShared";
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
    <div className="tx-wrap">
      <div className="form-stack">

        <FormCard title="사용할 강재 선택" en="Steel">
          <div className="lookup-confirm-bar">
            <TxtInput value={steelInput}
              onChange={(v) => { setSteelInput(v); setSteelData(null); setSteelError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleQuerySteel()}
              placeholder="사용할 강재 ID — 예) PIPE_001"
              state={steelData && !steelError ? "ok" : steelError ? "error" : null}
              disabled={isSending} />
            <button className="btn-query" onClick={handleQuerySteel}
              disabled={!steelInput.trim() || isLoadingSteel || isSending}>
              {isLoadingSteel
                ? <span style={{ display:"inline-block",width:14,height:14,border:"2px solid #ccc",borderTop:"2px solid #4b5160",borderRadius:"999px",animation:"spin .9s linear infinite" }} />
                : "조회"}
            </button>
          </div>
          {steelData && !steelError && (
            <div className="confirm-chip ok">
              <span className="mk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="cid">{steelData.steelId}</span>
              <div className="pieces">
                {steelMeta?.grade && <span className="pc">{steelMeta.grade}</span>}
                <span className="pc"><b>{gramsToKg(steelData.weight)}</b> kg</span>
                <span className="pc">소유자: <b>본인</b></span>
              </div>
              <span className="badge badge-active" style={{ marginLeft: "auto" }}><span className="dot"></span>ACTIVE</span>
            </div>
          )}
          {steelError && (
            <div className="confirm-chip err">
              <span className="mk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
              <span className="cid">{steelInput.trim()}</span>
              <span className="errmsg">{steelError}</span>
            </div>
          )}
        </FormCard>

        <FormCard title="부품 정보 입력" en="Part">
          <Field label="부품 ID" en="productId · 블록체인" req
            hint="컨트랙트 productMap에 저장됩니다.">
            <TxtInput value={productId} onChange={setProductId} placeholder="P_001" disabled={isSending} />
          </Field>
          <Field label="부품 설명" en="서버(KV) 저장"
            hint="product:{productId} 키로 서버에 저장됩니다.">
            <TxtInput value={productDesc} onChange={setProductDesc}
              placeholder="예) 자동화 설비 A 프레임" disabled={isSending} mono={false} />
          </Field>
        </FormCard>

        <IrreversibleWarning>
          <b>등록 완료 후 해당 강재의 상태는 USED로 변경됩니다.</b>{" "}
          이 작업은 되돌릴 수 없으며, USED 강재는 재사용·분할·조합·이전이 모두 불가합니다.
        </IrreversibleWarning>

        <ActionFooter
          canSubmit={canSubmit}
          gateNote={!steelConfirmed ? "강재를 먼저 조회하세요" : "부품 ID를 입력하세요"}
          submitLabel="MetaMask로 사용 등록"
          onReset={() => setResetConfirm(true)}
          onSubmit={handleMarkUsed}
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
