/**
 * MTC Chain — Workers API 로컬 통합 테스트 (Phase 7)
 *
 * 전제: wrangler dev 가 포트 8787에서 실행 중이어야 함
 *   cd worker && npx wrangler dev --local
 *
 * 실행:
 *   node worker/test/api.test.js
 *   또는 (worker 디렉터리에서)
 *   node test/api.test.js
 *
 * 테스트 항목:
 *   TC-W01: GET /health → 200 { ok: true }
 *   TC-W02: OPTIONS preflight → 204 + CORS 헤더
 *   TC-W03: POST /api/metadata 인증 없이 → 401
 *   TC-W04: POST /api/metadata 정상 저장 → 200 { ok: true }
 *   TC-W05: POST /api/metadata 중복 저장 → 409
 *   TC-W06: GET /api/metadata/:steelId 존재하는 키 → 200 + 데이터
 *   TC-W07: GET /api/metadata/:steelId 없는 키 → 404
 *   TC-W08: POST /api/product 정상 저장 → 200 { ok: true }
 *   TC-W09: GET /api/product/:productId 존재하는 키 → 200 + 데이터
 *   TC-W10: GET /api/product/:productId 없는 키 → 404
 *   TC-W11: GET /unknown → 404
 *   TC-W12: POST /api/metadata 유효성 검사 실패 → 400
 */

const BASE_URL = process.env.WORKER_URL || "http://localhost:8787";
const API_KEY  = process.env.WORKERS_API_KEY || "local-dev-key";

// ── 테스트 유틸리티 ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function req(method, path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, headers: res.headers, data };
}

// ── 테스트 실행 ───────────────────────────────────────────────────────────────

async function run() {
  console.log("═".repeat(60));
  console.log(" MTC Workers API — 로컬 통합 테스트");
  console.log(`  대상: ${BASE_URL}`);
  console.log("═".repeat(60));

  // 중복 방지용 고유 ID (타임스탬프 기반)
  const uid = Date.now().toString(36);
  const STEEL_ID   = `TEST_STEEL_${uid}`;
  const PRODUCT_ID = `TEST_PRODUCT_${uid}`;

  // ── 헬스 체크 ──────────────────────────────────────────────────────────────
  console.log("\n[헬스 체크]");

  await test("TC-W01: GET /health → 200 { ok: true }", async () => {
    const { status, data } = await req("GET", "/health");
    assertEqual(status, 200, "status");
    assert(data.ok === true, `ok 필드 없음: ${JSON.stringify(data)}`);
    assert(data.service === "mtc-api", `service 필드: ${data.service}`);
  });

  // ── CORS preflight ─────────────────────────────────────────────────────────
  console.log("\n[CORS]");

  await test("TC-W02: OPTIONS preflight → 204 + CORS 헤더", async () => {
    const res = await fetch(`${BASE_URL}/api/metadata`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    assertEqual(res.status, 204, "status");
    assert(
      res.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
      "CORS Allow-Methods 헤더 없음"
    );
  });

  // ── 인증 ──────────────────────────────────────────────────────────────────
  console.log("\n[인증]");

  await test("TC-W03: POST /api/metadata 인증키 없이 → 401", async () => {
    const { status } = await req("POST", "/api/metadata", {
      body: { steelId: STEEL_ID, grade: "SS400" },
    });
    assertEqual(status, 401, "status");
  });

  // ── 메타데이터 저장/조회 ────────────────────────────────────────────────────
  console.log("\n[메타데이터]");

  await test("TC-W04: POST /api/metadata 정상 저장 → 200 { ok: true }", async () => {
    const { status, data } = await req("POST", "/api/metadata", {
      headers: { "X-Api-Key": API_KEY },
      body: {
        steelId:         STEEL_ID,
        grade:           "SS400",
        chemC:           0.15,
        chemSi:          0.25,
        chemMn:          1.20,
        chemP:           0.02,
        chemS:           0.01,
        yieldStrength:   245,
        tensileStrength: 400,
        elongation:      21,
      },
    });
    assertEqual(status, 200, "status");
    assert(data.ok === true, `ok 필드: ${JSON.stringify(data)}`);
  });

  await test("TC-W05: POST /api/metadata 중복 저장 → 409", async () => {
    const { status } = await req("POST", "/api/metadata", {
      headers: { "X-Api-Key": API_KEY },
      body: { steelId: STEEL_ID, grade: "SS400" },
    });
    assertEqual(status, 409, "status");
  });

  await test("TC-W06: GET /api/metadata/:steelId 존재 → 200 + 데이터", async () => {
    const { status, data } = await req("GET", `/api/metadata/${STEEL_ID}`);
    assertEqual(status, 200, "status");
    assertEqual(data.grade, "SS400", "grade");
    assertEqual(data.yieldStrength, 245, "yieldStrength");
  });

  await test("TC-W07: GET /api/metadata/:steelId 없음 → 404", async () => {
    const { status } = await req("GET", "/api/metadata/NONEXISTENT_XYZ_99999");
    assertEqual(status, 404, "status");
  });

  // ── 부품 설명 저장/조회 ────────────────────────────────────────────────────
  console.log("\n[부품 설명]");

  await test("TC-W08: POST /api/product 정상 저장 → 200 { ok: true }", async () => {
    const { status, data } = await req("POST", "/api/product", {
      headers: { "X-Api-Key": API_KEY },
      body: {
        productId:   PRODUCT_ID,
        description: "배관용 강관 (DN150, sch40)",
      },
    });
    assertEqual(status, 200, "status");
    assert(data.ok === true, `ok 필드: ${JSON.stringify(data)}`);
  });

  await test("TC-W09: GET /api/product/:productId 존재 → 200 + 데이터", async () => {
    const { status, data } = await req("GET", `/api/product/${PRODUCT_ID}`);
    assertEqual(status, 200, "status");
    assertEqual(data.description, "배관용 강관 (DN150, sch40)", "description");
  });

  await test("TC-W10: GET /api/product/:productId 없음 → 404", async () => {
    const { status } = await req("GET", "/api/product/NONEXISTENT_PRODUCT_99999");
    assertEqual(status, 404, "status");
  });

  // ── 오류 케이스 ────────────────────────────────────────────────────────────
  console.log("\n[오류 케이스]");

  await test("TC-W11: GET /unknown/path → 404", async () => {
    const { status } = await req("GET", "/unknown/path");
    assertEqual(status, 404, "status");
  });

  await test("TC-W12: POST /api/metadata steelId 누락 → 400", async () => {
    const { status, data } = await req("POST", "/api/metadata", {
      headers: { "X-Api-Key": API_KEY },
      body: { grade: "SS400" },
    });
    assertEqual(status, 400, "status");
    assert(data.error?.includes("steelId"), `error 메시지: ${data.error}`);
  });

  await test("TC-W13: POST /api/metadata 숫자 필드에 문자열 → 400", async () => {
    const { status, data } = await req("POST", "/api/metadata", {
      headers: { "X-Api-Key": API_KEY },
      body: { steelId: `BAD_${uid}`, grade: "SS400", chemC: "NOT_A_NUMBER" },
    });
    assertEqual(status, 400, "status");
    assert(data.error?.includes("chemC"), `error 메시지: ${data.error}`);
  });

  await test("TC-W14: POST /api/product description 누락 → 400", async () => {
    const { status, data } = await req("POST", "/api/product", {
      headers: { "X-Api-Key": API_KEY },
      body: { productId: `PROD_${uid}` },
    });
    assertEqual(status, 400, "status");
    assert(data.error?.includes("description"), `error 메시지: ${data.error}`);
  });

  // ── 결과 ──────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(` 결과: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(60));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n[FATAL] 테스트 실행 실패:", err.message);
  console.error("  wrangler dev 가 실행 중인지 확인하세요:");
  console.error("    cd worker && npx wrangler dev --local");
  process.exit(1);
});
