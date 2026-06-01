/**
 * MTC 발행 컴포넌트
 * 화면설계서 §6 기준
 *
 * 섹션 ①: 강재 기본정보 (블록체인 저장) — steelId, grade, weight
 * 섹션 ②: 화학성분 (%) — KV 저장, PDF 해시로 진본증명
 * 섹션 ③: 기계적 성질 — KV 저장, PDF 해시로 진본증명
 * 섹션 ④: PDF 업로드 — Pinata IPFS + SHA-256 → 블록체인 해시 저장
 *
 * 버튼 활성 조건: ①~④ 모두 완료 (PDF CID 발급까지)
 * 트랜잭션 순서: issueMtc(contract) → 성공 후 saveSteelMeta(Workers KV)
 */

import { useState, useRef, useCallback } from "react";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { useTx } from "../../contexts/TxContext";
import { uploadPdfToIpfs } from "../../utils/ipfs";
import { saveSteelMeta } from "../../utils/api";
import { kgToGrams } from "../../utils/format";
import { parseContractError } from "../../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../../utils/logger";
import { IPFS_GATEWAY } from "../../constants/addresses";

const GRADE_OPTIONS = ["SS400", "SM490", "SMA490W", "A36", "S355"];
const MAX_PDF_MB = 10;

const CHEM_FIELDS = [
  { key: "c",  label: "C",  placeholder: "0.170" },
  { key: "si", label: "Si", placeholder: "0.250" },
  { key: "mn", label: "Mn", placeholder: "1.200" },
  { key: "p",  label: "P",  placeholder: "0.035" },
  { key: "s",  label: "S",  placeholder: "0.030" },
];

const MECH_FIELDS = [
  { key: "yieldStrength",  label: "항복강도", unit: "MPa", placeholder: "245" },
  { key: "tensileStrength",label: "인장강도", unit: "MPa", placeholder: "400" },
  { key: "elongation",     label: "연신율",   unit: "%",   placeholder: "21" },
];

const INITIAL_CHEM  = { c: "", si: "", mn: "", p: "", s: "" };
const INITIAL_MECH  = { yieldStrength: "", tensileStrength: "", elongation: "" };

export default function MtcIssuance() {
  // ── 폼 상태 ───────────────────────────────────────────────────────────────
  const [steelId, setSteelId]       = useState("");
  const [gradeSelect, setGradeSelect] = useState("");
  const [gradeCustom, setGradeCustom] = useState("");
  const [weight, setWeight]         = useState("");
  const [chem, setChem]             = useState(INITIAL_CHEM);
  const [mech, setMech]             = useState(INITIAL_MECH);

  // ── PDF 업로드 상태 ───────────────────────────────────────────────────────
  const [pdfFile, setPdfFile]       = useState(null);
  const [pdfError, setPdfError]     = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | done | error
  const [cid, setCid]               = useState("");
  const [pdfHash, setPdfHash]       = useState("");
  const fileInputRef                = useRef(null);

  // ── 발행 상태 ─────────────────────────────────────────────────────────────
  const [isSending, setIsSending]   = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { getSignedContract }       = useContract();
  const { isConnected }             = useWallet();
  const { pushTx, updateTx }        = useTx();

  // ── 등급 계산 ─────────────────────────────────────────────────────────────
  const grade = gradeCustom.trim() || gradeSelect;

  // ── PDF 파일 선택 핸들러 ──────────────────────────────────────────────────
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
      const result = await uploadPdfToIpfs(file, (progress) => {
        setUploadProgress(progress);
      });
      setCid(result.cid);
      setPdfHash(result.pdfHash);
      setUploadState("done");
      console.log("[MtcIssuance] PDF 업로드 완료:", { cid: result.cid, hash: result.pdfHash });
    } catch (err) {
      console.error("[MtcIssuance] PDF 업로드 실패:", err.message);
      setPdfError(`업로드 실패: ${err.message}`);
      setUploadState("error");
      setUploadProgress(0);
    }
  }, []);

  // ── 텍스트 복사 ───────────────────────────────────────────────────────────
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── 폼 완성 여부 ──────────────────────────────────────────────────────────
  const isFormComplete =
    steelId.trim() !== "" &&
    grade !== "" &&
    parseFloat(weight) > 0 &&
    uploadState === "done" &&
    cid !== "" &&
    pdfHash !== "";

  // ── 발행 트랜잭션 ─────────────────────────────────────────────────────────
  async function handleIssue() {
    if (!isFormComplete || isSending) return;

    const weightGrams = kgToGrams(weight);
    const finalGrade = grade;
    const finalSteelId = steelId.trim();

    setIsSending(true);
    const txId = pushTx({ label: `MTC 발행: ${finalSteelId}` });

    try {
      const contract = await getSignedContract();

      // ── 디버그 로그 ─────────────────────────────────────────────────────────
      const signer = await contract.runner.provider?.getSigner?.() ?? contract.runner;
      const network = await contract.runner.provider?.getNetwork?.();
      console.group("[issueMtc] 호출 파라미터");
      console.log("컨트랙트 주소 :", await contract.getAddress());
      console.log("지갑 주소     :", await signer.getAddress());
      console.log("chainId       :", network?.chainId?.toString());
      console.log("steelId       :", finalSteelId);
      console.log("weight (g)    :", weightGrams, typeof weightGrams);
      console.log("ipfsCid       :", cid);
      console.log("pdfHash       :", pdfHash);
      console.groupEnd();
      // ────────────────────────────────────────────────────────────────────────

      // 컨트랙트 시그니처: issueMtc(steelId, weight, ipfsCid, pdfHash)
      const tx = await contract.issueMtc(finalSteelId, weightGrams, cid, pdfHash);
      logTxSent("issueMtc", { steelId: finalSteelId, weight: weightGrams, cid, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log("[MtcIssuance] issueMtc 완료:", { steelId: finalSteelId, block: receipt.blockNumber });

      // 트랜잭션 성공 후 Workers KV에 메타데이터 저장 (Worker API는 flat 필드 형식)
      try {
        await saveSteelMeta({
          steelId:         finalSteelId,
          grade:           finalGrade,
          chemC:           parseFloat(chem.c)               || 0,
          chemSi:          parseFloat(chem.si)              || 0,
          chemMn:          parseFloat(chem.mn)              || 0,
          chemP:           parseFloat(chem.p)               || 0,
          chemS:           parseFloat(chem.s)               || 0,
          yieldStrength:   parseFloat(mech.yieldStrength)   || 0,
          tensileStrength: parseFloat(mech.tensileStrength) || 0,
          elongation:      parseFloat(mech.elongation)      || 0,
          cid,
          pdfHash,
          issuedAt:        new Date().toISOString(),
        });
        console.log("[MtcIssuance] Workers KV 메타데이터 저장 완료:", finalSteelId);
      } catch (apiErr) {
        // 메타데이터 저장 실패는 발행 자체를 실패처리하지 않음 (온체인은 이미 확정)
        console.error("[MtcIssuance] Workers KV 저장 실패 (온체인은 성공):", apiErr.message);
      }

      handleReset(true);
    } catch (err) {
      const msg = parseContractError(err);
      logContractError("issueMtc", msg, { steelId: finalSteelId });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[MtcIssuance] issueMtc 실패:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── 폼 초기화 ─────────────────────────────────────────────────────────────
  function handleReset(silent = false) {
    if (!silent) {
      setResetConfirm(false);
    }
    setSteelId("");
    setGradeSelect("");
    setGradeCustom("");
    setWeight("");
    setChem(INITIAL_CHEM);
    setMech(INITIAL_MECH);
    setPdfFile(null);
    setPdfError("");
    setUploadProgress(0);
    setUploadState("idle");
    setCid("");
    setPdfHash("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── ① 강재 기본 정보 ────────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          ① 강재 기본 정보{" "}
          <span className="text-blue-600 normal-case">(블록체인 저장)</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">
              강재 ID <span className="text-gray-400 font-mono text-xs">(Heat No.)</span>
            </label>
            <input
              type="text"
              value={steelId}
              onChange={(e) => setSteelId(e.target.value)}
              placeholder="H_001"
              className="input"
              disabled={isSending}
            />
          </div>
          <div>
            <label className="label">
              무게 <span className="text-gray-400 font-mono text-xs">(kg)</span>
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="1000.0"
              step="0.1"
              min="0.1"
              className="input"
              disabled={isSending}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">강재 등급</label>
            <div className="flex gap-2">
              <select
                value={gradeSelect}
                onChange={(e) => { setGradeSelect(e.target.value); setGradeCustom(""); }}
                className="input"
                disabled={isSending || gradeCustom !== ""}
              >
                <option value="">등급 선택</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
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
                선택된 등급: <span className="font-mono font-semibold">{grade}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── ② 화학 성분 ────────────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          ② 화학 성분 (%)
          <span className="text-amber-600 normal-case ml-2 text-xs">
            ※ 서버(KV) 저장 / 진본증명: PDF 해시
          </span>
        </p>
        <div className="grid grid-cols-5 gap-3">
          {CHEM_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label font-mono">{label}</label>
              <input
                type="number"
                value={chem[key]}
                onChange={(e) => setChem((prev) => ({ ...prev, [key]: e.target.value }))}
                step="0.001"
                placeholder={placeholder}
                className="input text-center"
                disabled={isSending}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── ③ 기계적 성질 ───────────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          ③ 기계적 성질
          <span className="text-amber-600 normal-case ml-2 text-xs">
            ※ 서버(KV) 저장 / 진본증명: PDF 해시
          </span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {MECH_FIELDS.map(({ key, label, unit, placeholder }) => (
            <div key={key}>
              <label className="label">
                {label} <span className="font-mono text-xs">({unit})</span>
              </label>
              <input
                type="number"
                value={mech[key]}
                onChange={(e) => setMech((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="input"
                disabled={isSending}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── ④ PDF 업로드 ────────────────────────────────────────────────────── */}
      <div className="section-card">
        <p className="section-title">
          ④ MTC PDF 업로드{" "}
          <span className="text-blue-600 normal-case">(블록체인 해시 저장)</span>
        </p>

        {/* 파일 선택 영역 */}
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
            <>
              <p className="text-sm text-gray-500">
                PDF 파일 선택 <span className="font-mono text-xs">(.pdf, 최대 10MB)</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">클릭하여 파일 선택</p>
            </>
          )}
          {uploadState === "uploading" && (
            <p className="text-sm text-blue-600">
              {pdfFile?.name} — 업로드 중...
            </p>
          )}
          {uploadState === "done" && (
            <p className="text-sm text-green-700 font-medium">
              ✓ {pdfFile?.name}
            </p>
          )}
          {uploadState === "error" && (
            <p className="text-sm text-red-600">
              ✗ {pdfFile?.name || "파일 선택"}
            </p>
          )}
        </div>

        {pdfError && (
          <p className="field-error mt-2">{pdfError}</p>
        )}

        {/* 업로드 진행바 */}
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

        {/* CID · 해시 표시 */}
        {uploadState === "done" && cid && (
          <div className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 shrink-0 w-20">IPFS CID</span>
              <span className="text-gray-800 truncate flex-1">{cid}</span>
              <button
                onClick={() => copyToClipboard(cid)}
                className="text-blue-500 hover:text-blue-700 shrink-0"
              >
                [복사]
              </button>
              <a
                href={`${IPFS_GATEWAY}/${cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 shrink-0"
              >
                [↗]
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 shrink-0 w-20">SHA-256</span>
              <span className="text-gray-800 truncate flex-1">
                {pdfHash.slice(0, 10)}…{pdfHash.slice(-8)}
              </span>
              <button
                onClick={() => copyToClipboard(pdfHash)}
                className="text-blue-500 hover:text-blue-700 shrink-0"
              >
                [복사]
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 버튼 영역 ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setResetConfirm(true)}
          className="btn-ghost"
          disabled={isSending}
        >
          초기화
        </button>
        <button
          onClick={handleIssue}
          disabled={!isFormComplete || isSending || !isConnected}
          className="btn-blue min-w-[180px]"
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              트랜잭션 전송 중...
            </span>
          ) : (
            "MetaMask로 발행 ✍"
          )}
        </button>
      </div>

      {!isConnected && (
        <p className="text-xs text-amber-600 text-center -mt-2">
          MetaMask 연결 후 발행할 수 있습니다
        </p>
      )}

      {/* ── 초기화 확인 모달 ─────────────────────────────────────────────── */}
      {resetConfirm && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setResetConfirm(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-2">폼을 초기화하시겠습니까?</h3>
            <p className="text-sm text-gray-600 mb-5">
              입력된 모든 정보와 업로드된 PDF가 초기화됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(false)}
                className="btn-ghost flex-1"
              >
                취소
              </button>
              <button
                onClick={() => handleReset()}
                className="btn-blue flex-1"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
