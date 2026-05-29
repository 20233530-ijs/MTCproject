/**
 * 단위 변환 및 포맷 유틸리티
 * §5.3 데이터 명세 기준: 무게는 g 단위(uint256)로 컨트랙트 전송, UI는 kg 표시
 */

/** kg → g 변환 (컨트랙트 전송용) */
export function kgToGrams(kg) {
  // 소수점 1자리까지만 허용 → 반올림 후 정수 변환
  return Math.round(parseFloat(kg) * 1000);
}

/** g → kg 변환 (UI 표시용) */
export function gramsToKg(grams) {
  return (Number(grams) / 1000).toFixed(1);
}

/** 지갑 주소 축약 표시: 0x1234...5678 */
export function shortenAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** bytes32 해시 축약 표시: 0xabc1…ef34 */
export function shortenHash(hash) {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** 타임스탬프 → 한국 시간 포맷: YYYY-MM-DD HH:mm */
export function formatTimestamp(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 타임스탬프 → 상대 시간 표시: "2분 전", "1시간 전" */
export function timeAgo(unixSeconds) {
  const diffMs = Date.now() - Number(unixSeconds) * 1000;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
}

/** 무게에 천 단위 콤마 추가: 1,000 kg */
export function formatWeight(grams) {
  return Number(gramsToKg(grams)).toLocaleString("ko-KR") + " kg";
}

/** 강재 상태 → 한국어 레이블 */
export const STATUS_LABEL = {
  0: "ACTIVE",
  1: "SPLIT",
  2: "COMBINED",
  3: "USED",
};

/** 강재 상태 → Tailwind 배지 클래스 */
export const STATUS_BADGE_CLASS = {
  0: "badge-active",
  1: "badge-split",
  2: "badge-combined",
  3: "badge-used",
};
