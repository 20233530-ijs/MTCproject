/**
 * SHA-256 해시 유틸리티 (Web Crypto API 사용)
 * §11.2 PDF 업로드 플로우 / §11.3 PDF 검증 플로우
 * 브라우저 내장 crypto.subtle 사용 — 서버에 파일 전송 없음
 */

/**
 * File 또는 ArrayBuffer에서 SHA-256 해시 계산
 * @returns {string} "0x" 접두사 포함 hex 문자열 (bytes32 형식)
 */
export async function sha256(input) {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "0x" + hex;
}

/**
 * IPFS에서 PDF를 다운로드하여 SHA-256 해시 계산 후 온체인 해시와 비교
 * @param {string} cid IPFS CID
 * @param {string} onchainHash 온체인 pdfHash (bytes32 hex)
 * @param {function} onProgress 진행률 콜백 (0~100)
 * @returns {{ isValid: boolean, calculatedHash: string, onchainHash: string }}
 */
export async function verifyPdf(cid, onchainHash, onProgress) {
  const gateway = import.meta.env.VITE_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
  const url = `${gateway}/${cid}`;

  onProgress?.(10);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`IPFS 다운로드 실패: ${response.status}`);

  // 진행률 시뮬레이션 (실제 스트리밍은 Phase 12에서 구현)
  onProgress?.(50);
  const arrayBuffer = await response.arrayBuffer();
  onProgress?.(80);

  const calculatedHash = await sha256(arrayBuffer);
  onProgress?.(100);

  return {
    isValid: calculatedHash.toLowerCase() === onchainHash.toLowerCase(),
    calculatedHash,
    onchainHash,
  };
}
