/**
 * 강재 조합 컴포넌트
 * 화면설계서 §8 기준
 *
 * - 부모 강재 동적 추가/제거 (최소 2개, 본인 소유 + ACTIVE 검증)
 * - 결과물 강재 정보 입력 (ID, 등급, 무게)
 * - 실시간 무게 검증: 결과물 ≤ 부모합계, 손실률 ≤ 15%
 * - 새 MTC PDF 업로드 (IPFS + SHA-256)
 * - combineSteel(parentIds, childId, childWeight, ipfsCid, pdfHash) 트랜잭션
 * - 성공 후 Workers KV에 결과물 메타데이터 저장
 */

import { useState, useRef, useCallback } from "react";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { useTx } from "../../contexts/TxContext";
import { uploadPdfToIpfs } from "../../utils/ipfs";
import { saveSteelMeta } from "../../utils/api";
import { fetchSteelMeta } from "../../utils/api";
import { gramsToKg, kgToGrams, STATUS_LABEL } from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../../utils/logger";
import { IPFS_GATEWAY } from "../../constants/addresses";

const GRADE_OPTIONS   = ["SS400", "SM490", "SMA490W", "A36", "S355"];
const MAX_PARENTS     = 10;
const MAX_LOSS_PCT    = 15; // 조합 허용 손실률 (분할은 10%, 조합은 15%)
const MAX_PDF_MB      = 10;

export default function SteelCombine() {
  // ── 부모 강재 목록 ─────────────────────────────────────────────────────────
  const [parents, setParents]           = useState([]); // { steelId, weight(g), grade }
  const [addInput, setAddInput]         = useState("");
  const [isAddingVisible, setAddVisible] = useState(false);
  const [isLoadingAdd, setLoadingAdd]   = useState(false);
  const [addError, setAddError]         = useState("");

  // ── 결과물 강재 정보 ───────────────────────────────────────────────────────
  const [childId, setChildId]           = useState("");
  const [gradeSelect, setGradeSelect]   = useState("");
  const [gradeCustom, setGradeCustom]   = useState("");
  const [childWeightKg, setChildWeightKg] = useState("");

  // ── PDF 업로드 상태 ───────────────────────────────────────────────────────
  const [pdfFile, setPdfFile]           = useState(null);
  const [pdfError, setPdfError]         = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState]   = useState("idle"); // idle|uploading|done|error
  const [cid, setCid]                   = useState("");
  const [pdfHash, setPdfHash]           = useState("");
  const fileInputRef                    = useRef(null);

  // ── 트랜잭션 상태 ─────────────────────────────────────────────────────────
  const [isSending, setIsSending]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { readContract, getSignedContract } = useContract();
  const { account, isConnected }            = useWallet();
  const { pushTx, updateTx }                = useTx();

  // ── 부모 강재 추가 ─────────────────────────────────────────────────────────
  async function handleAddParent() {
    const id = addInput.trim();
    if (!id) return;

    // 중복 체크
    if (parents.some((p) => p.steelId === id)) {
      setAddError("이미 추가된 강재입니다");
      return;
    }

    setAddError("");
    setLoadingAdd(true);

    try {
      const [steel, meta] = await Promise.all([
        readContract.getSteel(id),
        fetchSteelMeta(id).catch(() => null),
      ]);

      const ownerMatch = steel.owner?.toLowerCase() === account?.toLowerCase();
      const isActive   = Number(steel.status) === 0;

      if (!ownerMatch) {
        setAddError("본인이 소유한 강재가 아닙니다");
        return;
      }
      if (!isActive) {
        setAddError(`추가 불가: 강재 상태가 ${STATUS_LABEL[Number(steel.status)]}입니다`);
        return;
      }

      setParents((prev) => [...prev, {
        steelId: steel.steelId,
        weight: Number(steel.weight), // BigInt → Number (grams)
        grade: meta?.grade || "",
      }]);
      setAddInput("");
      setAddVisible(false);
      setAddError("");
      console.log("[SteelCombine] 부모 강재 추가:", { id, weight: Number(steel.weight) });
    } catch (err) {
      const msg = parseContractError(err);
      setAddError(msg);
      console.warn("[SteelCombine] 부모 강재 조회 실패:", err.message);
    } finally {
      setLoadingAdd(false);
    }
  }

  function removeParent(steelId) {
    setParents((prev) => prev.filter((p) => p.steelId !== steelId));
  }

  // ── PDF 업로드 ─────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfError("");
    if (file.type !== "application/pdf") {
      setPdfError("PDF 파일만 선택 가능합니다 (.pdf)");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setPdfError(`파일 크기는 ${MAX_PDF_MB}MB 이하여야 합니다`);
      return;
    }

    setPdfFile(file);
    setCid("");
    setPdfHash("");
    setUploadProgress(0);
    setUploadState("uploading");

    try {
      const result = await uploadPdfToIpfs(file, (progress) => setUploadProgress(progress));
      setCid(result.cid);
      setPdfHash(result.pdfHash);
      setUploadState("done");
      console.log("[SteelCombine] PDF 업로드 완료:", { cid: result.cid });
    } catch (err) {
      console.error("[SteelCombine] PDF 업로드 실패:", err.message);
      setPdfError(`업로드 실패: ${err.message}`);
      setUploadState("error");
      setUploadProgress(0);
    }
  }, []);

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── 무게 검증 계산 ─────────────────────────────────────────────────────────
  const parentSumG  = parents.reduce((s, p) => s + p.weight, 0);
  const parentSumKg = parentSumG / 1000;

  const childKg     = parseFloat(childWeightKg) || 0;
  const childG      = Math.round(childKg * 1000);

  const lossKg      = parentSumKg - childKg;
  const lossPct     = parentSumKg > 0 ? (lossKg / parentSumKg) * 100 : 0;

  const exceedsParent = childG > parentSumG && parentSumG > 0;
  const exceedsLoss   = lossPct > MAX_LOSS_PCT && !exceedsParent && childKg > 0;
  const weightValid   = childKg > 0 && parentSumG > 0
    && !exceedsParent && !exceedsLoss;

  const barPct   = parentSumG > 0 ? Math.min(100, (childG / parentSumG) * 100) : 0;
  const barColor = exceedsParent || exceedsLoss ? "bg-red-500" : "bg-green-500";

  // ── 등급 ───────────────────────────────────────────────────────────────────
  const grade = gradeCustom.trim() || gradeSelect;

  // ── combineSteel 트랜잭션 ──────────────────────────────────────────────────
  async function handleCombine() {
    if (!canCombine || isSending) return;

    const parentIds    = parents.map((p) => p.steelId);
    const finalChildId = childId.trim();

    setIsSending(true);
    const txId = pushTx({
      label: `강재 조합: [${parentIds.join(", ")}] → ${finalChildId}`,
    });

    try {
      const contract = await getSignedContract();
      const tx = await contract.combineSteel(
        parentIds,
        finalChildId,
        BigInt(childG),
        cid,
        pdfHash
      );
      logTxSent("combineSteel", {
        parentIds, childId: finalChildId, childWeight: childG, txHash: tx.hash,
      });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log("[SteelCombine] combineSteel 완료:", {
        childId: finalChildId, block: receipt.blockNumber,
      });

      // 트랜잭션 성공 후 Workers KV에 결과물 메타데이터 저장
      try {
        await saveSteelMeta({
          steelId:  finalChildId,
          grade:    grade || "",
          chemC:    0, chemSi: 0, chemMn: 0, chemP: 0, chemS: 0,
          yieldStrength: 0, tensileStrength: 0, elongation: 0,
          cid,
          pdfHash,
          issuedAt: new Date().toISOString(),
        });
        console.log("[SteelCombine] Workers KV 메타데이터 저장 완료:", finalChildId);
      } catch (apiErr) {
        console.error("[SteelCombine] Workers KV 저장 실패 (온체인은 성공):", apiErr.message);
      }

      handleReset(true);
    } catch (err) {
      const msg = parseContractError(err);
      logContractError("combineSteel", msg, { parentIds, childId: finalChildId });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[SteelCombine] combineSteel 실패:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── 폼 초기화 ─────────────────────────────────────────────────────────────
  function handleReset(silent = false) {
    if (!silent) setResetConfirm(false);
    setParents([]);
    setAddInput("");
    setAddVisible(false);
    setAddError("");
    setChildId("");
    setGradeSelect("");
    setGradeCustom("");
    setChildWeightKg("");
    setPdfFile(null);
    setPdfError("");
    setUploadProgress(0);
    setUploadState("idle");
    setCid("");
    setPdfHash("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── 버튼 활성 조건 ─────────────────────────────────────────────────────────
  const canCombine =
    parents.length >= 2 &&
    childId.trim() !== "" &&
    weightValid &&
    uploadState === "done" &&
    isConnected &&
    !isSending;

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── ① 부모 강재 선택 ────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">
            부모 강재 선택{" "}
            <span className="text-gray-400 normal-case text-xs">(2개 이상)</span>
          </p>
          {parents.length < MAX_PARENTS && !isAddingVisible && (
            <button
              onClick={() => { setAddVisible(true); setAddError(""); }}
              className="btn-ghost text-xs py-1.5 px-3"
              disabled={isSending}
            >
              + 강재 추가
            </button>
          )}
        </div>

        {/* 인라인 추가 입력 */}
        {isAddingVisible && (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={addInput}
                onChange={(e) => { setAddInput(e.target.value); setAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddParent()}
                placeholder="강재 ID"
                className="input text-sm"
                autoFocus
                disabled={isLoadingAdd}
              />
              <button
                onClick={handleAddParent}
                disabled={!addInput.trim() || isLoadingAdd}
                className="btn-ghost shrink-0 text-sm"
              >
                {isLoadingAdd
                  ? <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
                  : "조회"}
              </button>
              <button
                onClick={() => { setAddVisible(false); setAddInput(""); setAddError(""); }}
                className="text-gray-400 hover:text-gray-600 text-sm px-1"
              >
                ✕
              </button>
            </div>
            {addError && <p className="field-error mt-1">{addError}</p>}
          </div>
        )}

        {/* 부모 목록 */}
        {parents.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            강재를 추가하세요 (최소 2개)
          </p>
        ) : (
          <div className="space-y-2">
            {parents.map((p) => (
              <div
                key={p.steelId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm"
              >
                <span className="text-green-600 font-bold shrink-0">✓</span>
                <span className="font-mono font-semibold text-gray-900">{p.steelId}</span>
                {p.grade && <span className="text-gray-600">{p.grade}</span>}
                <span className="text-gray-700 font-medium">
                  {(p.weight / 1000).toLocaleString("ko-KR")} kg
                </span>
                <span className="text-gray-500 text-xs">소유자: 본인</span>
                <span className="badge-active ml-auto shrink-0">ACTIVE</span>
                <button
                  onClick={() => removeParent(p.steelId)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-xs font-bold shrink-0"
                  disabled={isSending}
                  title="제거"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 부모 합계 */}
        {parents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">부모 합계</span>
            <span className="font-mono font-semibold text-gray-800">
              {parentSumKg.toLocaleString("ko-KR")} kg
            </span>
          </div>
        )}
      </div>

      {/* ── ② 결과물 강재 정보 ──────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">결과물 강재 정보</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">강재 ID</label>
            <input
              type="text"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              placeholder="PIPE_001"
              className="input"
              disabled={isSending}
            />
          </div>
          <div>
            <label className="label">
              무게 <span className="font-mono text-xs text-gray-400">(kg)</span>
            </label>
            <input
              type="number"
              value={childWeightKg}
              onChange={(e) => setChildWeightKg(e.target.value)}
              step="0.1"
              min="0.1"
              placeholder="0.0"
              className="input"
              disabled={isSending}
            />
          </div>
          <div className="col-span-2">
            <label className="label">
              강재 등급{" "}
              <span className="text-amber-600 text-xs font-normal">(서버 저장)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={gradeSelect}
                onChange={(e) => { setGradeSelect(e.target.value); setGradeCustom(""); }}
                className="input"
                disabled={isSending || gradeCustom !== ""}
              >
                <option value="">등급 선택</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                type="text"
                value={gradeCustom}
                onChange={(e) => { setGradeCustom(e.target.value); setGradeSelect(""); }}
                placeholder="직접 입력"
                className="input"
                disabled={isSending}
              />
            </div>
            {grade && (
              <p className="text-xs text-green-600 mt-1">
                선택: <span className="font-mono font-semibold">{grade}</span>
              </p>
            )}
          </div>
        </div>

        {/* 무게 검증 프리뷰 */}
        {parents.length >= 2 && childKg > 0 && (
          <div className={[
            "mt-4 rounded-lg p-4 border",
            exceedsParent || exceedsLoss
              ? "bg-red-50 border-red-200"
              : weightValid
              ? "bg-green-50 border-green-200"
              : "bg-gray-50 border-gray-200",
          ].join(" ")}>
            <p className="text-xs font-semibold text-gray-600 mb-2">무게 검증</p>
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">부모 합계</span>
                <span className="font-mono font-medium">{parentSumKg.toLocaleString("ko-KR")} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">결과물 무게</span>
                <span className={[
                  "font-mono font-semibold",
                  exceedsParent ? "text-red-600" : "text-gray-800",
                ].join(" ")}>
                  {childKg.toFixed(1)} kg
                  <span className="ml-2 text-xs font-normal">({barPct.toFixed(1)}%)</span>
                </span>
              </div>
              {!exceedsParent && (
                <div className="flex justify-between">
                  <span className="text-gray-600">손실</span>
                  <span className={[
                    "font-mono font-semibold",
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
                  ✗ 결과물 무게가 부모 합계를 초과합니다
                </p>
              )}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── ③ 새 MTC PDF 업로드 ─────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          새 MTC PDF 업로드{" "}
          <span className="text-blue-600 normal-case text-xs">(결과물 자재증명서)</span>
        </p>

        <div
          className={[
            "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
            uploadState === "done"
              ? "border-green-400 bg-green-50"
              : uploadState === "error"
              ? "border-red-300 bg-red-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50",
          ].join(" ")}
          onClick={() => !isSending && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isSending}
          />
          {uploadState === "idle" && (
            <p className="text-sm text-gray-500">
              PDF 파일 선택 <span className="font-mono text-xs">(.pdf, 최대 10MB)</span>
            </p>
          )}
          {uploadState === "uploading" && (
            <p className="text-sm text-blue-600">{pdfFile?.name} — 업로드 중...</p>
          )}
          {uploadState === "done" && (
            <p className="text-sm text-green-700 font-medium">✓ {pdfFile?.name}</p>
          )}
          {uploadState === "error" && (
            <p className="text-sm text-red-600">✗ {pdfFile?.name || "파일 선택"}</p>
          )}
        </div>

        {pdfError && <p className="field-error mt-2">{pdfError}</p>}

        {uploadState === "uploading" && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>IPFS 업로드 중...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState === "done" && cid && (
          <div className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 shrink-0 w-20">IPFS CID</span>
              <span className="text-gray-800 truncate flex-1">{cid}</span>
              <button onClick={() => copyToClipboard(cid)} className="text-blue-500 hover:text-blue-700 shrink-0">[복사]</button>
              <a href={`${IPFS_GATEWAY}/${cid}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 shrink-0">[↗]</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 shrink-0 w-20">SHA-256</span>
              <span className="text-gray-800 truncate flex-1">{pdfHash.slice(0, 10)}…{pdfHash.slice(-8)}</span>
              <button onClick={() => copyToClipboard(pdfHash)} className="text-blue-500 hover:text-blue-700 shrink-0">[복사]</button>
            </div>
          </div>
        )}
      </div>

      {/* ── 버튼 영역 ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <button onClick={() => setResetConfirm(true)} className="btn-ghost" disabled={isSending}>
          초기화
        </button>
        <button onClick={handleCombine} disabled={!canCombine} className="btn-blue min-w-[160px]">
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              트랜잭션 전송 중...
            </span>
          ) : "MetaMask로 조합 ✍"}
        </button>
      </div>

      {!isConnected && (
        <p className="text-xs text-amber-600 text-center -mt-2">
          MetaMask 연결 후 조합할 수 있습니다
        </p>
      )}

      {/* ── 초기화 확인 모달 ────────────────────────────────────────────── */}
      {resetConfirm && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResetConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-2">폼을 초기화하시겠습니까?</h3>
            <p className="text-sm text-gray-600 mb-5">입력된 모든 정보와 업로드된 PDF가 초기화됩니다.</p>
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
