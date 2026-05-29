/**
 * MTC Chain — Cloudflare Workers API (Phase 7)
 *
 * 엔드포인트:
 *   GET  /api/metadata/:steelId   — 강재 메타데이터 조회 (인증 불필요)
 *   POST /api/metadata            — 강재 메타데이터 저장 (X-Api-Key 필요)
 *   GET  /api/product/:productId  — 부품 설명 조회 (인증 불필요)
 *   POST /api/product             — 부품 설명 저장 (X-Api-Key 필요)
 *   GET  /health                  — 상태 확인
 *
 * KV 키 형식 (MTC_METADATA 네임스페이스):
 *   강재 메타데이터: steel:{steelId}
 *   부품 설명:      product:{productId}
 *
 * 인증:
 *   POST 엔드포인트: X-Api-Key 헤더 == env.WORKERS_API_KEY
 *   불일치 시 401 Unauthorized 반환
 *
 * CORS:
 *   Origin: env.ALLOWED_ORIGIN 또는 * (개발용)
 *   모든 응답에 CORS 헤더 포함 (OPTIONS preflight 처리)
 *
 * KV 일관성 주의:
 *   Cloudflare KV는 최종 일관성 모델 — POST 직후 GET이 이전 값을 반환할 수 있음
 *   프론트엔드에서 1~2회 재시도 권장
 */

// ── CORS 헬퍼 ───────────────────────────────────────────────────────────────

function corsHeaders(env) {
  // ALLOWED_ORIGIN 미설정 시 와일드카드 (로컬 개발 전용)
  const origin = env?.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    "Access-Control-Max-Age":       "86400",
  };
}

// JSON 응답 헬퍼
function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// ── 인증 ────────────────────────────────────────────────────────────────────

function isAuthorized(request, env) {
  const provided = request.headers.get("X-Api-Key");
  const expected = env?.WORKERS_API_KEY;
  // WORKERS_API_KEY 미설정 시 로컬 개발 환경으로 간주 — 인증 통과
  if (!expected) return true;
  return provided === expected;
}

// ── 입력 유효성 검사 ─────────────────────────────────────────────────────────

// 강재 메타데이터 필수 필드 검증
function validateMetadata(body) {
  if (!body.steelId || typeof body.steelId !== "string" || !body.steelId.trim()) {
    return "steelId 필드가 필요합니다";
  }
  if (!body.grade || typeof body.grade !== "string") {
    return "grade 필드가 필요합니다";
  }
  // 수치 필드 타입 검증 (선택 필드는 있으면 숫자여야 함)
  const numFields = ["chemC","chemSi","chemMn","chemP","chemS",
                     "yieldStrength","tensileStrength","elongation"];
  for (const f of numFields) {
    if (body[f] !== undefined && typeof body[f] !== "number") {
      return `${f} 필드는 숫자여야 합니다`;
    }
  }
  return null; // 유효
}

// 부품 설명 필수 필드 검증
function validateProduct(body) {
  if (!body.productId || typeof body.productId !== "string" || !body.productId.trim()) {
    return "productId 필드가 필요합니다";
  }
  if (!body.description || typeof body.description !== "string") {
    return "description 필드가 필요합니다";
  }
  return null;
}

// ── 로거 ────────────────────────────────────────────────────────────────────

function log(level, method, path, detail) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, level, method, path, detail }));
}

// ── 핸들러 ──────────────────────────────────────────────────────────────────

// GET /api/metadata/:steelId
async function getMetadata(steelId, env) {
  const key  = `steel:${steelId}`;
  const data = await env.MTC_METADATA.get(key, { type: "json" });
  if (!data) {
    log("warn", "GET", `/api/metadata/${steelId}`, "not found");
    return { status: 404, body: { error: "not found" } };
  }
  log("info", "GET", `/api/metadata/${steelId}`, "ok");
  return { status: 200, body: data };
}

// POST /api/metadata
async function saveMetadata(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: "유효하지 않은 JSON" } };
  }

  const err = validateMetadata(body);
  if (err) return { status: 400, body: { error: err } };

  const steelId = body.steelId.trim();
  const key     = `steel:${steelId}`;

  // 중복 방지 (409)
  const existing = await env.MTC_METADATA.get(key);
  if (existing) {
    log("warn", "POST", "/api/metadata", `duplicate: ${steelId}`);
    return { status: 409, body: { error: "already exists" } };
  }

  // steelId는 KV 키에 포함되므로 저장 값에서 제외
  const { steelId: _, ...meta } = body;
  await env.MTC_METADATA.put(key, JSON.stringify(meta));

  log("info", "POST", "/api/metadata", `saved: ${steelId}`);
  return { status: 200, body: { ok: true } };
}

// GET /api/product/:productId
async function getProduct(productId, env) {
  const key  = `product:${productId}`;
  const data = await env.MTC_METADATA.get(key, { type: "json" });
  if (!data) {
    log("warn", "GET", `/api/product/${productId}`, "not found");
    return { status: 404, body: { error: "not found" } };
  }
  log("info", "GET", `/api/product/${productId}`, "ok");
  return { status: 200, body: data };
}

// POST /api/product
async function saveProduct(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: "유효하지 않은 JSON" } };
  }

  const err = validateProduct(body);
  if (err) return { status: 400, body: { error: err } };

  const productId = body.productId.trim();
  const key       = `product:${productId}`;

  await env.MTC_METADATA.put(key, JSON.stringify({ description: body.description }));

  log("info", "POST", "/api/product", `saved: ${productId}`);
  return { status: 200, body: { ok: true } };
}

// ── 라우터 ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // /health
    if (path === "/" || path === "/health") {
      return json({ ok: true, service: "mtc-api", phase: 7 }, 200, env);
    }

    // ── /api/metadata ────────────────────────────────────────────────────────

    // GET /api/metadata/:steelId
    if (method === "GET" && path.startsWith("/api/metadata/")) {
      const steelId = decodeURIComponent(path.slice("/api/metadata/".length));
      if (!steelId) return json({ error: "steelId 필요" }, 400, env);
      const { status, body } = await getMetadata(steelId, env);
      return json(body, status, env);
    }

    // POST /api/metadata
    if (method === "POST" && path === "/api/metadata") {
      if (!isAuthorized(request, env)) {
        log("warn", "POST", "/api/metadata", "unauthorized");
        return json({ error: "Unauthorized" }, 401, env);
      }
      const { status, body } = await saveMetadata(request, env);
      return json(body, status, env);
    }

    // ── /api/product ─────────────────────────────────────────────────────────

    // GET /api/product/:productId
    if (method === "GET" && path.startsWith("/api/product/")) {
      const productId = decodeURIComponent(path.slice("/api/product/".length));
      if (!productId) return json({ error: "productId 필요" }, 400, env);
      const { status, body } = await getProduct(productId, env);
      return json(body, status, env);
    }

    // POST /api/product
    if (method === "POST" && path === "/api/product") {
      if (!isAuthorized(request, env)) {
        log("warn", "POST", "/api/product", "unauthorized");
        return json({ error: "Unauthorized" }, 401, env);
      }
      const { status, body } = await saveProduct(request, env);
      return json(body, status, env);
    }

    // ── 404 ─────────────────────────────────────────────────────────────────
    log("warn", method, path, "route not found");
    return json({ error: "not found" }, 404, env);
  },
};
