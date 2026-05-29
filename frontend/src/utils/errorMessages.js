/**
 * 컨트랙트 Custom Error → UI 한국어 메시지 변환
 * §5.11 F-10 사기 시도 거부 / §8.7 에러 코드 정의
 *
 * onlyRole 대신 수동 체크 패턴(if (!hasRole) revert NotXxx())을 사용하므로
 * Custom Error 이름으로 판별한다.
 * OpenZeppelin의 AccessControlUnauthorizedAccount는 별도 처리.
 */

/** Custom Error 이름 → UI 토스트 메시지 */
const ERROR_MESSAGES = {
  // 역할 관련
  NotMill: "거부됨: Mill(제강사) 역할이 없습니다",
  NotFabricator: "거부됨: Fabricator(가공사) 역할이 없습니다",
  NotIntegrator: "거부됨: Integrator(통합사) 역할이 없습니다",

  // 강재 존재·상태 관련
  SteelExists: "거부됨: 이미 존재하는 강재 ID입니다",
  SteelNotFound: "거부됨: 존재하지 않는 강재 ID입니다",
  SteelNotActive: "거부됨: 이미 분할·조합·사용된 강재입니다",

  // 소유권 관련
  NotOwner: "거부됨: 본인이 소유한 강재가 아닙니다",
  InvalidRecipient: "거부됨: 시스템에 등록되지 않은 수신자입니다",

  // 무게 관련
  WeightExceedsParent: "거부됨: 자식 무게 합계가 부모 무게를 초과합니다",
  WeightLossExceeded: "거부됨: 허용 손실률을 초과하였습니다",
  InvalidWeight: "거부됨: 무게는 0보다 커야 합니다",

  // 입력값 관련
  InvalidPdfHash: "거부됨: PDF 해시가 없습니다. PDF 업로드를 먼저 완료하세요",
  InvalidCid: "거부됨: IPFS CID가 없습니다. PDF 업로드를 먼저 완료하세요",
  InvalidChildCount: "거부됨: 분할 조각은 2개 이상 10개 이하여야 합니다",
  InvalidProductId: "거부됨: 부품 ID를 입력하세요",

  // 조합 관련
  NeedMultipleParents: "거부됨: 조합은 2개 이상의 부모 강재가 필요합니다",
  InvalidParentCount: "거부됨: 부모 강재는 2개 이상 10개 이하여야 합니다",

  // OpenZeppelin AccessControl 기본 에러
  AccessControlUnauthorizedAccount: "거부됨: 이 기능에 대한 권한이 없습니다",
};

/**
 * ethers.js v6 에러 객체에서 Custom Error 이름을 추출하여 한국어 메시지 반환
 * @param {Error} error ethers.js ContractError 객체
 * @returns {string} UI 표시용 에러 메시지
 */
export function parseContractError(error) {
  // ethers v6: error.reason, error.errorName, error.data
  const errorName =
    error?.errorName ||
    error?.reason ||
    _extractErrorName(error?.message || "") ||
    "UNKNOWN_ERROR";

  return (
    ERROR_MESSAGES[errorName] ||
    `거부됨: ${errorName}`
  );
}

/** 에러 메시지 문자열에서 Custom Error 이름 추출 */
function _extractErrorName(message) {
  // "execution reverted: NotMill()" 형식에서 추출
  const match = message.match(/reverted[^:]*:\s*([A-Z][a-zA-Z]+)/);
  return match?.[1] || null;
}
