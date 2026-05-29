/**
 * Pinata IPFS 업로드 유틸리티
 * §11.2 PDF 업로드 플로우
 */
import { sha256 } from "./hash";
import { logIpfsUpload } from "./logger";

/**
 * PDF 파일을 IPFS(Pinata)에 업로드하고 CID + SHA-256 해시 반환
 * @param {File} file PDF 파일
 * @param {function} onProgress 진행률 콜백 (0~100)
 * @returns {{ cid: string, pdfHash: string }}
 */
export async function uploadPdfToIpfs(file, onProgress) {
  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const apiSecret = import.meta.env.VITE_PINATA_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Pinata API 키가 설정되지 않았습니다. .env.local을 확인하세요.");
  }

  onProgress?.(10);

  // 1. SHA-256 해시 계산 (업로드 전 로컬 계산)
  const pdfHash = await sha256(file);
  onProgress?.(20);

  // 2. Pinata API로 IPFS 업로드
  const formData = new FormData();
  formData.append("file", file);
  // Pinata 메타데이터 (선택적)
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `MTC_${file.name}_${Date.now()}` })
  );

  onProgress?.(30);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinata 업로드 실패 (${response.status}): ${err}`);
  }

  const { IpfsHash: cid } = await response.json();
  onProgress?.(100);

  logIpfsUpload({ filename: file.name, size: file.size, cid, sha256: pdfHash });

  return { cid, pdfHash };
}
