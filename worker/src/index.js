/**
 * MTC Chain — Cloudflare Workers API
 * Phase 1: Hello World 검증용 스켈레톤
 * Phase 7에서 실제 엔드포인트 구현 예정
 *
 * 엔드포인트 목록 (Phase 7 구현 예정):
 *   GET  /api/metadata/:steelId   — 강재 메타데이터 조회
 *   POST /api/metadata            — 강재 메타데이터 저장
 *   GET  /api/product/:productId  — 부품 설명 조회
 *   POST /api/product             — 부품 설명 저장
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

export default {
  async fetch(request, env, ctx) {
    // CORS preflight 처리
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Phase 1: 상태 확인 엔드포인트
    if (path === "/" || path === "/health") {
      return json({ ok: true, service: "mtc-api", phase: 1, message: "Hello from MTC Workers!" });
    }

    // Phase 7에서 구현될 라우트 플레이스홀더
    if (path.startsWith("/api/metadata")) {
      return json({ error: "not implemented yet — Phase 7" }, 501);
    }
    if (path.startsWith("/api/product")) {
      return json({ error: "not implemented yet — Phase 7" }, 501);
    }

    return json({ error: "not found" }, 404);
  },
};

// JSON 응답 헬퍼
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
