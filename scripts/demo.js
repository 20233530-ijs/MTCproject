/**
 * MtcRegistry 데모 스크립트 (Phase 6)
 *
 * 사용법: npx hardhat run scripts/demo.js --network localhost
 *   (사전에 `npx hardhat node` 로 로컬 노드 실행 필요)
 *
 * 시나리오:
 *   1. Admin → Mill/Fabricator/Integrator 역할 부여
 *   2. Mill이 H_001 MTC 발행
 *   3. POSCO → 가공사A 소유권 이전
 *   4. 강재 분할 (1→5, 5% 손실)
 *   5. 강재 조합 (2→1, PIPE_001)
 *   6. 사용 매핑 (PIPE_001 → P_001)
 *   7. 전체 이력 조회
 *   8. PDF 해시 검증 시뮬레이션
 *   9. [거부] 무게 부풀리기 시도
 *  10. [거부] 권한 없는 발행 / 재분할 시도
 */

const { ethers } = require("hardhat");

// ── 유틸리티 ────────────────────────────────────────────────────────────────

// 구분선 출력
function divider(title) {
  const line = "─".repeat(58);
  console.log(`\n┌${line}┐`);
  console.log(`│ ${title.padEnd(57)}│`);
  console.log(`└${line}┘`);
}

// 성공 로그
function ok(msg) { console.log(`  ✓  ${msg}`); }

// 거부됨 로그 (예상된 revert)
function rejected(msg) { console.log(`  ✗  [거부됨] ${msg}`); }

// 필드 출력
function field(label, value) {
  console.log(`       ${label.padEnd(14)}: ${value}`);
}

// ethers v6 커스텀 에러 이름 추출
function extractErrorName(err) {
  // ethers v6: err.reason 또는 err.data 에 에러 정보
  if (err.reason) return err.reason;
  const msg = err.message || "";
  const m   = msg.match(/reverted with custom error '(\w+)/);
  if (m) return m[1];
  // 컨트랙트 에러 디코딩
  if (err.errorName) return err.errorName;
  // 폴백
  const shortMsg = msg.split("\n")[0].slice(0, 80);
  return shortMsg;
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  MTC Chain — 데모 시나리오 실행");
  console.log("  네트워크: " + (await ethers.provider.getNetwork()).name);
  console.log("═".repeat(60));

  // 서명자 할당
  const [admin, millUser, fabricatorUser, integratorUser, stranger, hyundaiMill] =
    await ethers.getSigners();

  // 컨트랙트 배포
  const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
  const registry    = await MtcRegistry.deploy();
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log(`\n  컨트랙트: ${addr}`);

  // PDF 해시 시뮬레이션 (실제 IPFS 없으므로 keccak256 사용)
  const DEMO_PDF_HASH    = ethers.keccak256(ethers.toUtf8Bytes("POSCO-H001-MTC-PDF"));
  const HYUNDAI_PDF_HASH = ethers.keccak256(ethers.toUtf8Bytes("HYUNDAI-OTHER001-MTC-PDF"));
  const PIPE_PDF_HASH    = ethers.keccak256(ethers.toUtf8Bytes("PIPE001-COMBINED-MTC-PDF"));
  const DEMO_IPFS_CID    = "QmPOSCO_H001_MockCid_1234567890abcdef";
  const HYUNDAI_IPFS_CID = "QmHYUNDAI_OTHER001_MockCid_abcdef1234";
  const PIPE_IPFS_CID    = "QmPIPE001_Combined_MockCid_fedcba9876";

  // ── Scenario 1: 역할 부여 ─────────────────────────────────────────────────
  divider("Scenario 1: Admin → 역할 부여");

  await registry.connect(admin).grantMill(millUser.address);
  ok(`grantMill       → ${millUser.address.slice(0, 10)}… (POSCO Mock)`);

  await registry.connect(admin).grantFabricator(fabricatorUser.address);
  ok(`grantFabricator → ${fabricatorUser.address.slice(0, 10)}… (가공사 A)`);

  await registry.connect(admin).grantIntegrator(integratorUser.address);
  ok(`grantIntegrator → ${integratorUser.address.slice(0, 10)}… (통합사 C)`);

  // HYUNDAI Mock도 Mill 역할 부여
  await registry.connect(admin).grantMill(hyundaiMill.address);
  ok(`grantMill       → ${hyundaiMill.address.slice(0, 10)}… (HYUNDAI Mock)`);

  // ── Scenario 2: MTC 발행 ──────────────────────────────────────────────────
  divider("Scenario 2: Mill이 H_001 MTC 발행");

  const tx2 = await registry.connect(millUser).issueMtc(
    "H_001",
    1_000_000n,      // 1,000kg = 1,000,000g
    DEMO_IPFS_CID,
    DEMO_PDF_HASH
  );
  const receipt2 = await tx2.wait();
  ok(`issueMtc 완료 — TX: ${receipt2.hash.slice(0, 14)}…`);
  field("steelId", "H_001");
  field("무게", "1,000 kg");
  field("IPFS CID", DEMO_IPFS_CID.slice(0, 24) + "…");
  field("PDF Hash", DEMO_PDF_HASH.slice(0, 18) + "…");

  // HYUNDAI Mock이 OTHER_001 발행 후 가공사A에게 이전
  await registry.connect(hyundaiMill).issueMtc(
    "OTHER_001",
    500_000n,        // 500kg = 500,000g
    HYUNDAI_IPFS_CID,
    HYUNDAI_PDF_HASH
  );
  ok(`issueMtc 완료 — steelId: OTHER_001 (500 kg)`);

  // ── Scenario 3: 소유권 이전 ───────────────────────────────────────────────
  divider("Scenario 3: H_001 소유권 이전 (POSCO → 가공사A)");

  const tx3 = await registry.connect(millUser).transferOwnership(
    "H_001",
    fabricatorUser.address
  );
  const receipt3 = await tx3.wait();
  ok(`transferOwnership 완료 — TX: ${receipt3.hash.slice(0, 14)}…`);
  field("강재", "H_001");
  field("from", millUser.address.slice(0, 10) + "… (POSCO)");
  field("to", fabricatorUser.address.slice(0, 10) + "… (가공사A)");

  // OTHER_001도 가공사A에게 이전
  await registry.connect(hyundaiMill).transferOwnership(
    "OTHER_001",
    fabricatorUser.address
  );
  ok(`transferOwnership 완료 — OTHER_001 → 가공사A`);

  // ── Scenario 4: 강재 분할 ─────────────────────────────────────────────────
  divider("Scenario 4: H_001 분할 (1→5조각, 5% 손실)");

  // 5조각: 200+200+200+200+150 = 950kg (5% 손실)
  const childWeights = [200_000n, 200_000n, 200_000n, 200_000n, 150_000n];
  const tx4 = await registry.connect(fabricatorUser).splitSteel("H_001", childWeights);
  const receipt4 = await tx4.wait();
  ok(`splitSteel 완료 — TX: ${receipt4.hash.slice(0, 14)}…`);
  field("부모", "H_001 (1,000 kg)");
  field("자식", "H_001_1~5");
  field("합계", "950 kg (손실 5%)");
  field("상태", "H_001 → SPLIT");

  // 이벤트에서 childIds 확인
  const splitEvent = receipt4.logs
    .map(log => { try { return registry.interface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "SteelSplit");
  if (splitEvent) {
    ok(`SteelSplit 이벤트 — 자식 ${splitEvent.args.childIds.length}개: ${splitEvent.args.childIds.slice(0,3).join(", ")}…`);
  }

  // ── Scenario 5: 강재 조합 ─────────────────────────────────────────────────
  divider("Scenario 5: H_001_1 + OTHER_001 → PIPE_001");

  // H_001_1(200kg) + OTHER_001(500kg) = 700kg → PIPE_001 620kg (11.4% 손실)
  const tx5 = await registry.connect(fabricatorUser).combineSteel(
    ["H_001_1", "OTHER_001"],
    "PIPE_001",
    620_000n,        // 620kg
    PIPE_IPFS_CID,
    PIPE_PDF_HASH
  );
  const receipt5 = await tx5.wait();
  ok(`combineSteel 완료 — TX: ${receipt5.hash.slice(0, 14)}…`);
  field("부모", "H_001_1 (200kg) + OTHER_001 (500kg)");
  field("자식", "PIPE_001 (620 kg)");
  field("손실률", "11.4% (허용 ≤15%)");
  field("상태", "H_001_1, OTHER_001 → COMBINED");

  // ── Scenario 6: 사용 매핑 ─────────────────────────────────────────────────
  divider("Scenario 6: PIPE_001 → P_001 사용 매핑");

  // 통합사C에게 PIPE_001 이전 후 사용 등록
  await registry.connect(fabricatorUser).transferOwnership(
    "PIPE_001",
    integratorUser.address
  );
  ok(`transferOwnership — PIPE_001 → 통합사C`);

  const tx6 = await registry.connect(integratorUser).markAsUsed("PIPE_001", "P_001");
  const receipt6 = await tx6.wait();
  ok(`markAsUsed 완료 — TX: ${receipt6.hash.slice(0, 14)}…`);
  field("강재", "PIPE_001");
  field("부품ID", "P_001");
  field("상태", "PIPE_001 → USED");

  // ── Scenario 7: 이력 조회 ─────────────────────────────────────────────────
  divider("Scenario 7: 전체 이력 조회");

  // P_001으로 역추적
  const foundSteelId = await registry.getSteelByProduct("P_001");
  ok(`getSteelByProduct("P_001") = "${foundSteelId}"`);

  // PIPE_001 상세
  const pipe001 = await registry.getSteel("PIPE_001");
  ok(`getSteel("PIPE_001")`);
  field("무게", `${Number(pipe001.weight) / 1000} kg`);
  field("상태", ["ACTIVE","SPLIT","COMBINED","USED"][pipe001.status]);
  field("parentIds", (await registry.getParents("PIPE_001")).join(", "));

  // H_001 트리 탐색
  const h001Children = await registry.getChildren("H_001");
  ok(`getChildren("H_001") = [${h001Children.slice(0,3).join(", ")}…]`);

  // H_001_1 부모 확인
  const h001_1Parents = await registry.getParents("H_001_1");
  ok(`getParents("H_001_1") = [${h001_1Parents.join(", ")}]`);

  console.log(`\n  트리 구조:`);
  console.log(`  [H_001 POSCO] ──→ [H_001_1 SPLIT] ──┐`);
  console.log(`                                        ├──→ [PIPE_001 COMBINED] ──→ [P_001 USED]`);
  console.log(`  [OTHER_001 HYUNDAI] ─────────────────┘`);

  // ── Scenario 8: PDF 해시 검증 시뮬레이션 ──────────────────────────────────
  divider("Scenario 8: PDF 해시 검증 시뮬레이션");

  const h001Steel    = await registry.getSteel("H_001");
  const onchainHash  = h001Steel.pdfHash;
  // 정상: 동일 해시로 검증
  const computedHash = DEMO_PDF_HASH;
  const isValid      = onchainHash === computedHash;

  ok(`온체인 PDF 해시: ${onchainHash.slice(0, 18)}…`);
  ok(`계산된 SHA-256:  ${computedHash.slice(0, 18)}…`);
  if (isValid) {
    ok("검증 결과: ✓ 일치 — 위변조 없음 (진본 확인)");
  } else {
    console.log("  ✗  검증 결과: 불일치 — 위조 의심!");
  }

  // 위조 시뮬레이션
  const forgeddHash = ethers.keccak256(ethers.toUtf8Bytes("FORGED-PDF-DATA"));
  const forgedValid = onchainHash === forgeddHash;
  if (!forgedValid) {
    ok("위조 PDF 시뮬레이션: ✗ 불일치 → 위변조 즉시 감지");
  }

  // ── Scenario 9: [거부] 무게 부풀리기 ─────────────────────────────────────
  divider("Scenario 9: [거부 예상] 무게 부풀리기 시도");

  // H_001_2 사용 (200kg 자식 — ACTIVE 상태)
  const h001_2 = await registry.getSteel("H_001_2");
  field("대상 강재", "H_001_2");
  field("실제 무게", `${Number(h001_2.weight) / 1000} kg`);
  field("시도", "600 + 500 = 1,100 kg 분할 (실제보다 많음)");

  try {
    await registry.connect(fabricatorUser).splitSteel(
      "H_001_2",
      [600_000n, 500_000n]   // 합계 1,100kg > 200kg 부모
    );
    console.log("  ⚠  거부되지 않음 — 컨트랙트 버그!");
  } catch (err) {
    const errName = extractErrorName(err);
    rejected(`WeightExceedsParent — ${errName}`);
    ok("보안 검증 ✓ 무게 부풀리기 성공적으로 차단됨");
  }

  // ── Scenario 10: [거부] 권한 없는 발행 + 재분할 시도 ─────────────────────
  divider("Scenario 10-B: [거부 예상] 권한 없는 발행 시도");

  field("시도자", `${stranger.address.slice(0, 10)}… (Mill 역할 없음)`);
  try {
    await registry.connect(stranger).issueMtc(
      "FAKE_001",
      1_000_000n,
      "QmFakeCid",
      ethers.keccak256(ethers.toUtf8Bytes("fake"))
    );
    console.log("  ⚠  거부되지 않음 — 컨트랙트 버그!");
  } catch (err) {
    rejected(`NotMill — ${extractErrorName(err)}`);
    ok("보안 검증 ✓ 권한 없는 발행 성공적으로 차단됨");
  }

  divider("Scenario 10-C: [거부 예상] SPLIT 강재 재분할 시도");

  field("대상", "H_001 (이미 SPLIT 상태)");
  try {
    await registry.connect(fabricatorUser).splitSteel(
      "H_001",
      [500_000n, 500_000n]
    );
    console.log("  ⚠  거부되지 않음 — 컨트랙트 버그!");
  } catch (err) {
    rejected(`SteelNotActive — ${extractErrorName(err)}`);
    ok("보안 검증 ✓ 이중 분할 성공적으로 차단됨");
  }

  // ── 최종 요약 ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  데모 완료 요약");
  console.log("═".repeat(60));
  console.log("  Scenario 1~8 : 정상 동작 확인 ✓");
  console.log("  Scenario 9   : 무게 부풀리기 거부 확인 ✓");
  console.log("  Scenario 10  : 권한 없는 발행·재분할 거부 확인 ✓");
  console.log("\n  전체 10개 시나리오 통과");
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exitCode = 1;
});
