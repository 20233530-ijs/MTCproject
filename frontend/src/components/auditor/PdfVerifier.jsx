/**
 * PDF 해시 검증 컴포넌트
 * 화면설계서 §4 기준
 *
 * - IPFS에서 PDF 다운로드
 * - 브라우저 내 SHA-256 재계산 (Web Crypto API)
 * - 온체인 pdfHash와 비교 → 검증 완료 / 위조 의심 결과 표시
 */

import { useState } from "react";
import { verifyPdf } from "../../utils/hash";
import { logPdfVerify } from "../../utils/logger";

export default function PdfVerifier({ cid, pdfHash }) {
  const [state, setState]     = useState("idle"); // idle | loading | done | error
  const [progress, setProgress] = useState(0);
  const [result, setResult]   = useState(null);  // { isValid, calculatedHash, onchainHash }
  const [errMsg, setErrMsg]   = useState("");

  async function handleVerify() {
    if (!cid || !pdfHash || state === "loading") return;

    setState("loading");
    setProgress(0);
    setResult(null);
    setErrMsg("");

    try {
      const res = await verifyPdf(cid, pdfHash, (pct) => setProgress(pct));
      setResult(res);
      setState("done");
      logPdfVerify({ cid, onchainHash: pdfHash, calculatedHash: res.calculatedHash, isValid: res.isValid });
      console.log("[PdfVerifier] 검증 완료:", { cid, isValid: res.isValid });
    } catch (err) {
      console.error("[PdfVerifier] 검증 실패:", err.message);
      setErrMsg(`다운로드 실패: ${err.message}`);
      setState("error");
    }
  }

  if (!cid || !pdfHash || pdfHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return (
      <p className="text-xs text-gray-400">PDF 미등록 강재</p>
    );
  }

  return (
    <div className="mt-2">
      {state === "idle" && (
        <button
          onClick={handleVerify}
          className="btn-ghost text-xs py-1.5 px-3"
        >
          PDF 다운로드 + 해시 검증
        </button>
      )}

      {state === "loading" && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>IPFS 다운로드 + SHA-256 계산 중...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {state === "done" && result && (
        <div className={[
          "rounded-lg p-3 text-xs",
          result.isValid
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200",
        ].join(" ")}>
          {result.isValid ? (
            <p className="text-green-700 font-semibold mb-2">✓ 검증 완료 — 해시 일치</p>
          ) : (
            <p className="text-red-700 font-semibold mb-2">✗ 위조 의심 — 해시 불일치!</p>
          )}
          <div className="space-y-1 font-mono text-[10px]">
            <div className="flex gap-2">
              <span className="text-gray-500 shrink-0">온체인</span>
              <span className={result.isValid ? "text-green-700" : "text-red-700"}>
                {pdfHash.slice(0, 10)}…{pdfHash.slice(-8)}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 shrink-0">계산값</span>
              <span className={result.isValid ? "text-green-700" : "text-red-700"}>
                {result.calculatedHash.slice(0, 10)}…{result.calculatedHash.slice(-8)}
              </span>
            </div>
            <div className="flex gap-2">
              <span className={[
                "font-semibold",
                result.isValid ? "text-green-700" : "text-red-700",
              ].join(" ")}>
                [{result.isValid ? "일치" : "불일치 — 경고!"}]
              </span>
            </div>
          </div>
          {!result.isValid && (
            <p className="text-red-700 font-semibold mt-2 text-xs">
              ⚠ 이 PDF는 블록체인에 등록된 원본과 다릅니다. 위조 가능성이 있습니다.
            </p>
          )}
          <button
            onClick={() => { setState("idle"); setResult(null); }}
            className="text-gray-400 hover:text-gray-600 text-[10px] mt-2 underline"
          >
            다시 검증
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-lg p-3 text-xs bg-red-50 border border-red-200">
          <p className="text-red-700">{errMsg}</p>
          <button
            onClick={() => setState("idle")}
            className="text-gray-400 hover:text-gray-600 text-[10px] mt-1 underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
