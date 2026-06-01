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
import { ethers } from "ethers";
import { FormCard, Field, TxtInput, ActionFooter, ConfirmModal } from "../TxShared";
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

      // pdfHash 형식 보정: sha256()은 "0x"+64hex를 반환하지만
      // 만약 32바이트 미만이면 zeroPadValue로 bytes32 맞춤
      let safeHash = pdfHash;
      if (!safeHash.startsWith("0x") || safeHash.length !== 66) {
        console.error("[issueMtc] pdfHash 형식 오류:", safeHash);
        throw new Error(`pdfHash 형식이 올바르지 않습니다: ${safeHash.slice(0, 20)}...`);
      }
      // ethers.getBytes로 bytes32 타입 명시 변환 (IPFS CID 문자열이 혼입되는 것 방지)
      const pdfHashBytes32 = ethers.zeroPadValue(ethers.getBytes(safeHash), 32);

      // 컨트랙트 시그니처: issueMtc(steelId, weight, ipfsCid, pdfHash)
      // ipfsCid = string, pdfHash = bytes32
      const tx = await contract.issueMtc(finalSteelId, weightGrams, cid, pdfHashBytes32);
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
    <div className="tx-wrap">
      <div className="form-stack">

        {/* ① 강재 기본 정보 */}
        <FormCard step="①" title="강재 기본 정보" src="chain">
          <Field label="강재 ID" en="Heat No." req hint="중복 여부는 컨트랙트가 최종 검증합니다.">
            <TxtInput value={steelId} onChange={setSteelId} placeholder="H_001" disabled={isSending} />
          </Field>
          <Field label="무게" en="kg" req hint="소수점 1자리 · 내부적으로 g 단위로 변환 후 전송">
            <TxtInput value={weight} onChange={setWeight} type="number" suffix="kg" placeholder="1000.0" disabled={isSending} />
          </Field>
          <Field label="강재 등급" en="Grade" hint="서버(KV) 저장">
            <div className="select-or">
              <select className="sel" value={gradeSelect}
                onChange={(e) => { setGradeSelect(e.target.value); setGradeCustom(""); }}
                disabled={isSending || gradeCustom !== ""}>
                <option value="">등급 선택</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="or">또는</span>
              <TxtInput value={gradeCustom} onChange={(v) => { setGradeCustom(v); setGradeSelect(""); }}
                placeholder="직접 입력" disabled={isSending} mono={false} />
            </div>
            {grade && <div className="fld-hint" style={{ color: "var(--status-active)" }}>선택된 등급: <b>{grade}</b></div>}
          </Field>
        </FormCard>

        {/* ② 화학 성분 */}
        <FormCard step="②" title="화학 성분 (%)" src="kv">
          <div className="inline-fields">
            {CHEM_FIELDS.map(({ key, label, placeholder }) => (
              <div className="mini" key={key}>
                <span className="ml">{label}</span>
                <TxtInput value={chem[key]}
                  onChange={(v) => setChem((prev) => ({ ...prev, [key]: v }))}
                  type="number" placeholder={placeholder} disabled={isSending} />
              </div>
            ))}
          </div>
          <div className="fld-hint" style={{ marginTop: 12 }}>소수점 3자리 · 블록체인 미기록 (진본성은 ④ PDF 해시로 보증)</div>
        </FormCard>

        {/* ③ 기계적 성질 */}
        <FormCard step="③" title="기계적 성질" src="kv">
          <div className="inline-fields">
            {MECH_FIELDS.map(({ key, label, unit, placeholder }) => (
              <div className="mini" key={key}>
                <span className="ml">{label}</span>
                <TxtInput value={mech[key]}
                  onChange={(v) => setMech((prev) => ({ ...prev, [key]: v }))}
                  type="number" suffix={unit} placeholder={placeholder} disabled={isSending} />
              </div>
            ))}
          </div>
        </FormCard>

        {/* ④ PDF 업로드 */}
        <FormCard step="④" title="MTC PDF 업로드" src="chain">
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
            onChange={handleFileChange} disabled={isSending} />

          {uploadState === "idle" || uploadState === "error" ? (
            <div className={"file-drop" + (uploadState === "error" ? " has-file" : "")}
                 onClick={() => !isSending && fileInputRef.current?.click()}>
              <span className="fd-ico">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 16V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="fd-main">PDF 파일 선택</span>
              <span className="fd-sub">.pdf · 최대 10MB · 선택 즉시 SHA-256 계산 + IPFS 업로드</span>
              {pdfError && <div className="fld-error" style={{ justifyContent: "center" }}>{pdfError}</div>}
            </div>
          ) : (
            <div className="file-drop has-file">
              <div className="file-meta">
                <span className="ficon">PDF</span>
                <div>
                  <div className="fn">{pdfFile?.name}</div>
                  <div className="fsz">{pdfFile ? (pdfFile.size / 1024 / 1024).toFixed(1) + " MB" : ""}</div>
                </div>
                <button className="btn-add swap" onClick={() => handleReset()} disabled={isSending}>변경</button>
              </div>
              {uploadState === "uploading" && (
                <div className="upload-progress">
                  <div className="label"><span>IPFS 업로드 중 · Pinata</span><span>{uploadProgress}%</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: uploadProgress + "%" }}></div></div>
                </div>
              )}
              {uploadState === "done" && cid && (
                <div className="kv-result">
                  <div className="kv-row">
                    <span className="k">IPFS CID</span>
                    <span className="val">{cid.slice(0, 16)}…</span>
                    <span className="acts">
                      <button className="btn-add" onClick={() => copyToClipboard(cid)}>복사</button>
                      <a className="btn-add" href={`${IPFS_GATEWAY}/${cid}`} target="_blank" rel="noopener noreferrer">열기 ↗</a>
                    </span>
                  </div>
                  <div className="kv-row">
                    <span className="k">SHA-256</span>
                    <span className="val">{pdfHash.slice(0, 10)}…{pdfHash.slice(-8)}</span>
                    <span className="acts"><button className="btn-add" onClick={() => copyToClipboard(pdfHash)}>복사</button></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </FormCard>

        <ActionFooter
          canSubmit={isFormComplete && isConnected}
          gateNote={!isConnected ? "지갑 연결 필요" : uploadState !== "done" ? "PDF 업로드 완료 후 활성화" : "필수 항목을 입력하세요"}
          submitLabel="MetaMask로 발행"
          onReset={() => setResetConfirm(true)}
          onSubmit={handleIssue}
          loading={isSending}
        />
      </div>

      {resetConfirm && (
        <ConfirmModal
          title="폼을 초기화하시겠습니까?"
          body="입력된 모든 정보와 업로드된 PDF가 초기화됩니다."
          confirmLabel="초기화"
          onConfirm={() => handleReset()}
          onCancel={() => setResetConfirm(false)}
        />
      )}
    </div>
  );
}
