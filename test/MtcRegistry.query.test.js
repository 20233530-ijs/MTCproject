/**
 * MtcRegistry — 조회 함수 단위 테스트 (Phase 5)
 *
 * 테스트 대상: getSteel, getParents, getChildren, getSteelByProduct
 * 검증 항목:
 *   TC-016: getSteelByProduct → steelId 역추적 성공
 *   TC-추가: getParents — 루트 강재 (빈 배열)
 *   TC-추가: getParents — 분할 자식 (부모 ID 포함)
 *   TC-추가: getParents — 조합 자식 (복수 부모 ID)
 *   TC-추가: getChildren — 잎 강재 (빈 배열)
 *   TC-추가: getChildren — 분할 후 자식 IDs
 *   TC-추가: getChildren — 조합 후 자식 IDs
 *   TC-추가: getParents / getChildren — 존재하지 않는 ID → SteelNotFound revert
 *   TC-추가: getSteel 전체 필드 — 발행 / 분할자식 / 조합자식 각각
 *   TC-추가: 완전한 트리 탐색 (2단계 분할 → getParents 재귀 가능 확인)
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MtcRegistry — 조회 함수 (Phase 5)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    const [deployer, millUser, fabricatorUser, integratorUser] =
      await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    await registry.grantMill(millUser.address);
    await registry.grantFabricator(fabricatorUser.address);
    await registry.grantIntegrator(integratorUser.address);

    const PDF_HASH = ethers.keccak256(ethers.toUtf8Bytes("query-test-pdf"));

    // ROOT_A 발행 → fabricatorUser에게 이전 → 분할 (ROOT_A_1, ROOT_A_2)
    await registry.connect(millUser).issueMtc("ROOT_A", 2_000_000n, "QmRootA", PDF_HASH);
    await registry.connect(millUser).transferOwnership("ROOT_A", fabricatorUser.address);
    await registry.connect(fabricatorUser).splitSteel("ROOT_A", [1_000_000n, 1_000_000n]);

    // ROOT_B 발행 → fabricatorUser에게 이전
    await registry.connect(millUser).issueMtc("ROOT_B", 1_000_000n, "QmRootB", PDF_HASH);
    await registry.connect(millUser).transferOwnership("ROOT_B", fabricatorUser.address);

    // ROOT_A_1 + ROOT_B 조합 → COMBINED_C
    const COMBO_HASH = ethers.keccak256(ethers.toUtf8Bytes("combined-pdf"));
    await registry.connect(fabricatorUser).combineSteel(
      ["ROOT_A_1", "ROOT_B"],
      "COMBINED_C",
      1_700_000n,    // 2,000,000의 85% = 1,700,000 (정확히 15% 손실)
      "QmCombined",
      COMBO_HASH
    );

    // COMBINED_C → integratorUser에게 이전 → 사용 매핑
    await registry.connect(fabricatorUser).transferOwnership("COMBINED_C", integratorUser.address);
    await registry.connect(integratorUser).markAsUsed("COMBINED_C", "PRODUCT_X");

    return {
      registry,
      deployer,
      millUser,
      fabricatorUser,
      integratorUser,
      PDF_HASH,
      COMBO_HASH,
    };
  }

  // ── TC-016: getSteelByProduct ─────────────────────────────────────────────
  describe("TC-016: getSteelByProduct → 강재 역추적", function () {

    it("등록된 productId로 강재 ID를 반환해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const steelId = await registry.getSteelByProduct("PRODUCT_X");
      expect(steelId).to.equal("COMBINED_C");
    });

    it("미등록 productId는 빈 문자열을 반환해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const steelId = await registry.getSteelByProduct("NO_SUCH_PRODUCT");
      expect(steelId).to.equal("");
    });

  });

  // ── getParents ─────────────────────────────────────────────────────────────
  describe("getParents", function () {

    it("루트 강재(ROOT_A)의 parentIds는 빈 배열이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const parents = await registry.getParents("ROOT_A");
      expect(parents).to.deep.equal([]);
    });

    it("분할 자식(ROOT_A_1)의 parentIds는 [ROOT_A]이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const parents = await registry.getParents("ROOT_A_1");
      expect(parents).to.deep.equal(["ROOT_A"]);
    });

    it("조합 자식(COMBINED_C)의 parentIds는 [ROOT_A_1, ROOT_B]이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const parents = await registry.getParents("COMBINED_C");
      expect(parents).to.deep.equal(["ROOT_A_1", "ROOT_B"]);
    });

    it("존재하지 않는 steelId 조회 시 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      await expect(registry.getParents("NONEXISTENT"))
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("NONEXISTENT");
    });

  });

  // ── getChildren ───────────────────────────────────────────────────────────
  describe("getChildren", function () {

    it("잎 강재(ROOT_A_2)의 childIds는 빈 배열이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const children = await registry.getChildren("ROOT_A_2");
      expect(children).to.deep.equal([]);
    });

    it("분할 부모(ROOT_A)의 childIds는 [ROOT_A_1, ROOT_A_2]이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const children = await registry.getChildren("ROOT_A");
      expect(children).to.deep.equal(["ROOT_A_1", "ROOT_A_2"]);
    });

    it("조합에 사용된 ROOT_A_1의 childIds는 [COMBINED_C]이어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      const children = await registry.getChildren("ROOT_A_1");
      expect(children).to.deep.equal(["COMBINED_C"]);
    });

    it("존재하지 않는 steelId 조회 시 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      await expect(registry.getChildren("NONEXISTENT"))
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("NONEXISTENT");
    });

  });

  // ── getSteel 전체 필드 검증 ───────────────────────────────────────────────
  describe("getSteel 전체 필드 검증", function () {

    it("루트 강재(ROOT_B) 전체 필드가 발행 데이터와 일치해야 한다", async function () {
      const { registry, millUser, PDF_HASH } = await loadFixture(deployFixture);

      const steel = await registry.getSteel("ROOT_B");
      // ROOT_B는 COMBINED에 사용되어 COMBINED 상태
      expect(steel.steelId).to.equal("ROOT_B");
      expect(steel.weight).to.equal(1_000_000n);
      expect(steel.ipfsCid).to.equal("QmRootB");
      expect(steel.pdfHash).to.equal(PDF_HASH);
      expect(steel.status).to.equal(2n); // COMBINED
      expect(steel.mill).to.equal(millUser.address);
    });

    it("조합 자식(COMBINED_C) 전체 필드가 조합 데이터와 일치해야 한다", async function () {
      const { registry, COMBO_HASH } = await loadFixture(deployFixture);

      const steel = await registry.getSteel("COMBINED_C");
      expect(steel.steelId).to.equal("COMBINED_C");
      expect(steel.weight).to.equal(1_700_000n);
      expect(steel.ipfsCid).to.equal("QmCombined");
      expect(steel.pdfHash).to.equal(COMBO_HASH);
      expect(steel.status).to.equal(3n); // USED
      expect(steel.mill).to.equal(ethers.ZeroAddress); // 조합재는 원산지 없음
    });

    it("존재하지 않는 steelId 조회 시 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      await expect(registry.getSteel("DOES_NOT_EXIST"))
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("DOES_NOT_EXIST");
    });

  });

  // ── 완전한 트리 탐색 시나리오 ───────────────────────────────────────────
  describe("TC-추가: 완전한 트리 탐색 시나리오", function () {

    it("ROOT_A → ROOT_A_1 → COMBINED_C 전방향 탐색이 가능해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      // 1단계: ROOT_A의 자식
      const rootAChildren = await registry.getChildren("ROOT_A");
      expect(rootAChildren).to.include("ROOT_A_1");

      // 2단계: ROOT_A_1의 자식
      const rootA1Children = await registry.getChildren("ROOT_A_1");
      expect(rootA1Children).to.include("COMBINED_C");

      // COMBINED_C의 상태
      const combined = await registry.getSteel("COMBINED_C");
      expect(combined.status).to.equal(3n); // USED
    });

    it("COMBINED_C → ROOT_A_1 → ROOT_A 역방향 탐색이 가능해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      // 1단계: COMBINED_C의 부모
      const combinedParents = await registry.getParents("COMBINED_C");
      expect(combinedParents).to.include("ROOT_A_1");

      // 2단계: ROOT_A_1의 부모
      const rootA1Parents = await registry.getParents("ROOT_A_1");
      expect(rootA1Parents).to.include("ROOT_A");

      // 3단계: ROOT_A는 루트
      const rootAParents = await registry.getParents("ROOT_A");
      expect(rootAParents).to.deep.equal([]);
    });

    it("2단계 분할 후 손자 강재의 parentIds가 자식 ID여야 한다", async function () {
      const { registry, fabricatorUser } = await loadFixture(deployFixture);

      // ROOT_A_2(잎)를 다시 분할
      await registry.connect(fabricatorUser).splitSteel(
        "ROOT_A_2",
        [450_000n, 450_000n, 100_000n]
      );

      const grandchild = await registry.getSteel("ROOT_A_2_1");
      expect(grandchild.parentIds).to.deep.equal(["ROOT_A_2"]);

      // 손자의 부모의 부모가 ROOT_A인지 확인
      const child = await registry.getSteel("ROOT_A_2");
      expect(child.parentIds).to.deep.equal(["ROOT_A"]);
    });

  });

});
