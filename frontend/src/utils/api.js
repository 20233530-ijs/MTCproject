/**
 * Cloudflare Workers API 호출 유틸리티
 * §11-B 백엔드 API 명세 기준
 *
 * 엔드포인트:
 *   GET  /api/metadata/:steelId   — 강재 메타데이터 조회
 *   POST /api/metadata            — 강재 메타데이터 저장
 *   GET  /api/product/:productId  — 부품 설명 조회
 *   POST /api/product             — 부품 설명 저장
 *
 * KV 최종 일관성 주의: POST 직후 GET이 stale 데이터를 반환할 수 있음
 *   → fetchSteelMeta는 최대 3회 재시도 (500ms 간격)
 */

const BASE = import.meta.env.VITE_WORKERS_API_URL || "http://localhost:8787";
const API_KEY = import.meta.env.VITE_WORKERS_API_KEY || "local-dev-key";

// ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`API 오류 ${res.status}: ${path}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API 오류 ${res.status}: ${path}`);
  }
  return res.json();
}

// 재시도 헬퍼 (KV 최종 일관성 대응)
async function withRetry(fn, maxRetries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (err) {
      lastErr = err;
    }
    if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return lastErr ? Promise.reject(lastErr) : null;
}

// ── 강재 메타데이터 ─────────────────────────────────────────────────────────

/**
 * 강재 메타데이터 조회 (재시도 포함)
 * @param {string} steelId
 * @returns {{ grade, chemC, chemSi, chemMn, chemP, chemS, yieldStrength, tensileStrength, elongation } | null}
 */
export async function fetchSteelMeta(steelId) {
  return withRetry(() => apiGet(`/api/metadata/${encodeURIComponent(steelId)}`));
}

/**
 * 강재 메타데이터 저장
 * MTC 발행 트랜잭션 성공 후 호출
 * @param {{ steelId, grade, chemC, chemSi, chemMn, chemP, chemS, yieldStrength, tensileStrength, elongation }} meta
 */
export async function saveSteelMeta(meta) {
  return apiPost("/api/metadata", meta);
}

// ── 부품 설명 ──────────────────────────────────────────────────────────────

/**
 * 부품 설명 조회
 * @param {string} productId
 * @returns {{ description: string } | null}
 */
export async function fetchProductDesc(productId) {
  return apiGet(`/api/product/${encodeURIComponent(productId)}`);
}

/**
 * 부품 설명 저장
 * markAsUsed 트랜잭션 성공 후 호출
 * @param {{ productId: string, description: string }} product
 */
export async function saveProductDesc(product) {
  return apiPost("/api/product", product);
}

// ── 병렬 강재 전체 조회 ─────────────────────────────────────────────────────

/**
 * 온체인 데이터와 KV 메타데이터를 병렬로 조회하여 병합
 * §11-B.4 병렬 조회 패턴
 * @param {string} steelId
 * @param {function} getSteel 컨트랙트 view 함수
 * @returns {object} 병합된 강재 전체 데이터
 */
export async function getSteelFull(steelId, getSteel) {
  const [onchain, meta] = await Promise.all([
    getSteel(steelId),
    fetchSteelMeta(steelId).catch(() => null),
  ]);
  return { ...onchain, ...(meta || {}) };
}
