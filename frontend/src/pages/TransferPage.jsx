/**
 * 소유권 이전 페이지 (/transfer)
 * 화면설계서 §10 기준 / 접근 권한: Mill, Fabricator, Admin
 *
 * 플로우:
 *   ① 강재 ID 조회 → 본인 소유 + ACTIVE 확인
 *   ② 수신자 주소 확인 → 시스템 등록 여부 + 역할 표시
 *   ③ transferOwnership 트랜잭션 → TxStatus 토스트
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import { useRole, ROLE_LABEL } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useTx } from "../contexts/TxContext";
import { fetchSteelMeta } from "../utils/api";
import { gramsToKg, shortenAddress, STATUS_LABEL } from "../utils/format";
import { parseContractError } from "../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../utils/logger";

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// 역할 해시 → role 키 (수신자 표시용)
const ROLE_KEY_LABEL = {
  mill:        "Mill (제강사)",
  fabricator:  "Fabricator (가공사)",
  integrator:  "Integrator (통합사)",
};
const ROLE_KEY_BADGE = {
  mill:        "badge-role-mill",
  fabricator:  "badge-role-fabricator",
  integrator:  "badge-role-integrator",
};

export default function TransferPage() {
  const navigate = useNavigate();
  const { account, isConnected } = useWallet();
  const { isAdmin, isMill, isFabricator, effectiveRole, isLoading: roleLoading } = useRole();
  const { readContract, getSignedContract } = useContract();
  const { pushTx, updateTx } = useTx();

  // ── 권한 가드 ──────────────────────────────────────────────────────────────
  const hasAccess = isAdmin || isMill || isFabricator
    || effectiveRole === "mill" || effectiveRole === "fabricator";

  useEffect(() => {
    if (!roleLoading && isConnected && !hasAccess) {
      console.warn("[TransferPage] 권한 없음 → 홈 리다이렉트");
      navigate("/", { replace: true });
    }
  }, [hasAccess, isConnected, roleLoading, navigate]);

  // ── 강재 조회 상태 ─────────────────────────────────────────────────────────
  const [steelInput, setSteelInput]     = useState("");
  const [isLoadingSteel, setLoadingSteel] = useState(false);
  const [steelData, setSteelData]       = useState(null);  // getSteel() 결과
  const [steelMeta, setSteelMeta]       = useState(null);  // KV 메타데이터
  const [steelError, setSteelError]     = useState("");

  // ── 수신자 확인 상태 ───────────────────────────────────────────────────────
  const [recipient, setRecipient]       = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [isCheckingRecipient, setCheckingRecipient] = useState(false);
  const [recipientRoles, setRecipientRoles] = useState(null); // { mill, fabricator, integrator }
  const [recipientVerified, setRecipientVerified] = useState(false);

  // ── 트랜잭션 상태 ──────────────────────────────────────────────────────────
  const [isSending, setIsSending]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

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
        setSteelError(`이전 불가: 강재 상태가 ${STATUS_LABEL[Number(steel.status)]}입니다`);
      }

      console.log("[TransferPage] 강재 조회:", { id, owner: steel.owner, status: steel.status });
    } catch (err) {
      const msg = parseContractError(err);
      setSteelError(msg);
      console.warn("[TransferPage] 강재 조회 실패:", err.message);
    } finally {
      setLoadingSteel(false);
    }
  }

  // ── 수신자 주소 확인 ───────────────────────────────────────────────────────
  async function handleCheckRecipient() {
    const addr = recipient.trim();
    if (!isValidAddress(addr)) {
      setRecipientError("0x로 시작하는 42자리 주소를 입력하세요");
      return;
    }
    if (addr.toLowerCase() === account?.toLowerCase()) {
      setRecipientError("본인 주소로는 이전할 수 없습니다");
      return;
    }

    setRecipientError("");
    setRecipientRoles(null);
    setRecipientVerified(false);
    setCheckingRecipient(true);

    try {
      const [mill, fabricator, integrator] = await Promise.all([
        readContract.hasMillRole(addr),
        readContract.hasFabricatorRole(addr),
        readContract.hasIntegratorRole(addr),
      ]);

      const roles = { mill, fabricator, integrator };
      setRecipientRoles(roles);
      setRecipientVerified(true);

      const hasAny = mill || fabricator || integrator;
      if (!hasAny) {
        setRecipientError("시스템에 등록되지 않은 주소입니다");
      }

      console.log("[TransferPage] 수신자 역할 조회:", { addr, mill, fabricator, integrator });
    } catch (err) {
      setRecipientError("역할 조회 실패: " + err.message);
      console.warn("[TransferPage] 수신자 역할 조회 실패:", err.message);
    } finally {
      setCheckingRecipient(false);
    }
  }

  // 수신자 입력 변경 시 검증 상태 초기화
  function handleRecipientChange(e) {
    setRecipient(e.target.value);
    setRecipientRoles(null);
    setRecipientVerified(false);
    setRecipientError("");
  }

  // ── transferOwnership 트랜잭션 ────────────────────────────────────────────
  async function handleTransfer() {
    if (!canTransfer || isSending) return;

    const id        = steelInput.trim();
    const toAddress = recipient.trim();

    setIsSending(true);
    const txId = pushTx({ label: `소유권 이전: ${id} → ${shortenAddress(toAddress)}` });

    try {
      const contract = await getSignedContract();
      const tx = await contract.transferOwnership(id, toAddress);
      logTxSent("transferOwnership", { steelId: id, to: toAddress, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log("[TransferPage] transferOwnership 완료:", { id, to: toAddress, block: receipt.blockNumber });

      handleReset(true);
    } catch (err) {
      const msg = parseContractError(err);
      logContractError("transferOwnership", msg, { steelId: id, to: toAddress });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[TransferPage] transferOwnership 실패:", err);
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
    setRecipient("");
    setRecipientRoles(null);
    setRecipientVerified(false);
    setRecipientError("");
  }

  // ── 버튼 활성화 조건 ──────────────────────────────────────────────────────
  const steelConfirmed  = !!steelData && !steelError
    && Number(steelData.status) === 0
    && steelData.owner?.toLowerCase() === account?.toLowerCase();

  const recipientOk     = recipientVerified && !recipientError
    && recipientRoles
    && (recipientRoles.mill || recipientRoles.fabricator || recipientRoles.integrator);

  const canTransfer = steelConfirmed && recipientOk && isConnected && !isSending;

  // ── 수신자 역할 표시 ──────────────────────────────────────────────────────
  function getRecipientRoleKey() {
    if (!recipientRoles) return null;
    if (recipientRoles.fabricator) return "fabricator";
    if (recipientRoles.integrator) return "integrator";
    if (recipientRoles.mill) return "mill";
    return null;
  }
  const recipientRoleKey = getRecipientRoleKey();

  // ── 미연결 / 로딩 / 권한없음 가드 ────────────────────────────────────────
  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-sm mb-1">MetaMask 연결이 필요합니다</p>
          <p className="text-xs text-gray-400">Mill 또는 Fabricator 계정으로 연결 후 이용 가능합니다</p>
        </div>
      </PageLayout>
    );
  }

  if (roleLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-24">
          <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">권한 확인 중...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">소유권 이전</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          강재 소유권을 다른 주소로 이전합니다. 이전 후에는 되돌릴 수 없습니다.
        </p>
      </div>

      <div className="max-w-lg space-y-5">

        {/* ── ① 이전할 강재 선택 ─────────────────────────────────────────── */}
        <div className="section-card">
          <p className="section-title">이전할 강재 선택</p>
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
              placeholder="강재 ID  (예: H_001)"
              className="input"
              disabled={isSending}
            />
            <button
              onClick={handleQuerySteel}
              disabled={!steelInput.trim() || isLoadingSteel || isSending}
              className="btn-ghost shrink-0"
            >
              {isLoadingSteel ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
              ) : "조회"}
            </button>
          </div>

          {/* 강재 정보 표시 */}
          {steelData && !steelError && (
            <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              <span className="font-mono font-semibold text-gray-900">{steelData.steelId}</span>
              {steelMeta?.grade && (
                <span className="text-gray-600">{steelMeta.grade}</span>
              )}
              <span className="text-gray-600">{gramsToKg(steelData.weight)} kg</span>
              <span className="text-gray-500 text-xs">소유자: 본인</span>
              <span className="badge-active ml-auto">
                {STATUS_LABEL[Number(steelData.status)] || "ACTIVE"}
              </span>
            </div>
          )}
          {steelError && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
              <span className="text-red-600 font-bold shrink-0">✗</span>
              <span className="text-red-700">{steelError}</span>
            </div>
          )}
        </div>

        {/* ── ② 수신자 정보 ──────────────────────────────────────────────── */}
        <div className="section-card">
          <p className="section-title">수신자 정보</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={recipient}
              onChange={handleRecipientChange}
              onKeyDown={(e) => e.key === "Enter" && handleCheckRecipient()}
              placeholder="0x5678...abcd"
              className="input font-mono text-sm"
              disabled={isSending}
            />
            <button
              onClick={handleCheckRecipient}
              disabled={!recipient.trim() || isCheckingRecipient || isSending}
              className="btn-ghost shrink-0"
            >
              {isCheckingRecipient ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
              ) : "확인"}
            </button>
          </div>

          {/* 수신자 역할 표시 */}
          {recipientVerified && !recipientError && recipientRoleKey && (
            <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              <span className="font-mono text-gray-700 text-xs">
                {recipient.slice(0, 8)}…{recipient.slice(-6)}
              </span>
              <span className="text-gray-500 text-xs">역할:</span>
              <span className={ROLE_KEY_BADGE[recipientRoleKey]}>
                {ROLE_KEY_LABEL[recipientRoleKey]}
              </span>
              <span className="text-gray-500 text-xs ml-auto">시스템 등록 주소 ✓</span>
            </div>
          )}
          {recipientError && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
              <span className="text-red-600 font-bold shrink-0">✗</span>
              <span className="text-red-700 font-mono text-xs">
                {recipient.slice(0, 8)}…{recipient.slice(-6)}
              </span>
              <span className="text-red-700 ml-2">{recipientError}</span>
            </div>
          )}
        </div>

        {/* ── ③ 불가역 경고 ──────────────────────────────────────────────── */}
        <div className="warning-box">
          ⚠ 이전 완료 후 해당 강재에 대한 모든 권한이 수신자에게 이동됩니다.
          이 작업은 되돌릴 수 없습니다.
        </div>

        {/* ── 버튼 영역 ──────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setResetConfirm(true)}
            className="btn-ghost"
            disabled={isSending}
          >
            초기화
          </button>
          <button
            onClick={handleTransfer}
            disabled={!canTransfer}
            className="btn-blue min-w-[160px]"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                트랜잭션 전송 중...
              </span>
            ) : (
              "MetaMask로 이전 ✍"
            )}
          </button>
        </div>
      </div>

      {/* ── 초기화 확인 모달 ──────────────────────────────────────────────── */}
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
    </PageLayout>
  );
}
