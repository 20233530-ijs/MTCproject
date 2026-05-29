/**
 * MTC Chain 로깅 유틸리티
 * §13.2 프론트엔드 콘솔 로그 형식 준수
 *
 * 로그 형식:
 *   [MTC] TX Sent:      { function, steelId, txHash }
 *   [MTC] TX Confirmed: { txHash, blockNumber, gasUsed }
 *   [MTC] Contract Error: { function, reason, data }
 *   [IPFS] Upload:      { filename, size, cid, sha256 }
 *   [PDF] Verify:       { cid, onchainHash, calculatedHash, isValid }
 *   [Query] Steel:      { steelId, depth, nodesLoaded }
 *
 * 이벤트 로그는 localStorage에 저장되며 7일 이상 지난 항목은 자동 삭제된다.
 */

const STORAGE_KEY = "mtc_event_logs";
const LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const MAX_LOGS = 200;

// ── 콘솔 로그 함수 ────────────────────────────────────────────────────────

/** 트랜잭션 전송 로그 */
export function logTxSent(functionName, data) {
  console.log("[MTC] TX Sent:", { function: functionName, ...data });
  _storeLog("TX", `Sent: ${functionName}`, data, "info");
}

/** 트랜잭션 확인 완료 로그 */
export function logTxConfirmed(data) {
  console.log("[MTC] TX Confirmed:", data);
  _storeLog("TX", "Confirmed", data, "info");
}

/** 컨트랙트 에러 로그 */
export function logContractError(functionName, reason, data = {}) {
  console.error("[MTC] Contract Error:", { function: functionName, reason, ...data });
  _storeLog("TX", `Error: ${functionName}`, { reason, ...data }, "error");
}

/** IPFS 업로드 로그 */
export function logIpfsUpload(data) {
  console.log("[IPFS] Upload:", data);
  _storeLog("IPFS", "Upload", data, "info");
}

/** PDF 해시 검증 로그 */
export function logPdfVerify(data) {
  console.log("[PDF] Verify:", data);
  _storeLog("PDF", "Verify", data, data.isValid ? "info" : "warn");
}

/** 강재 이력 조회 로그 */
export function logQuery(data) {
  console.log("[Query] Steel:", data);
}

/** 일반 정보 로그 */
export function logInfo(prefix, message, data = {}) {
  console.log(`[${prefix}] ${message}`, data);
  _storeLog(prefix, message, data, "info");
}

/** 경고 로그 */
export function logWarn(prefix, message, data = {}) {
  console.warn(`[${prefix}] ${message}`, data);
  _storeLog(prefix, message, data, "warn");
}

// ── localStorage 이벤트 로그 관리 ────────────────────────────────────────

/** 저장된 로그 목록 반환 (7일 미만 항목만) */
export function getLogs() {
  const logs = _readLogs();
  const now = Date.now();
  return logs.filter((l) => now - l.timestamp < LOG_TTL_MS);
}

/** 7일 이상 지난 로그 삭제 (앱 시작 시 호출) */
export function clearOldLogs() {
  try {
    const fresh = getLogs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // localStorage 접근 불가 환경 무시
  }
}

/** 전체 로그 삭제 */
export function clearAllLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────

function _storeLog(prefix, action, data, level) {
  try {
    const logs = _readLogs();
    const now = Date.now();
    // 7일 초과 항목 먼저 정리
    const fresh = logs.filter((l) => now - l.timestamp < LOG_TTL_MS);
    // 새 항목 추가 (최신순)
    fresh.unshift({
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      prefix,
      action,
      data,
      level,
    });
    // 최대 200개 유지
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh.slice(0, MAX_LOGS)));
  } catch {
    // localStorage 용량 초과 등 무시
  }
}

function _readLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
