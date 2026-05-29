/**
 * MtcRegistry — 강재 조합 단위 테스트 (Phase 5)
 *
 * 테스트 대상: combineSteel
 * 검증 항목:
 *   TC-012: 15% 이내 손실 조합 → SteelCombined 이벤트, 자식 1개 생성
 *   TC-013: 15% 초과 손실 조합 시도 → WeightLossExceeded revert
 *   TC-014: 단일 부모 조합 시도 → NeedMultipleParents revert
 *   TC-추가: >10 부모 → InvalidParentCount revert
 *   TC-추가: childId 중복 → SteelExists revert
 *   TC-추가: 부모 존재하지 않음 → SteelNotFound revert
 *   TC-추가: 부모 소유자 아님 → NotOwner revert
 *   TC-추가: 부모 ACTIVE 아님 → SteelNotActive revert
 *   TC-추가: childWeight > totalParentWeight → WeightExceedsParent revert
 *   TC-추가: 비Fabricator → NotFabricator revert
 *   TC-추가: childWeight=0 → InvalidWeight revert
 *   TC-추가: pdfHash=0x00 → InvalidPdfHash revert
 *   TC-추가: ipfsCid="" → InvalidCid revert
 *   TC-추가: 조합 후 부모 COMBINED 상태 / 자식 ACTIVE 상태
 *   TC-추가: 부모↔자식 parentIds / childIds 트리 연결
 *   TC-추가: 조합 후 부모 강재 재분할 시도 → SteelNotActive revert
 *   TC-추가: 정확히 15% 손실 (경계값) → 성공
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue }    = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("MtcRegistry — 강재 조합 (Phase 5)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    const [deployer, millUser, fabricatorUser, stranger] = await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    await registry.grantMill(millUser.address);
    await registry.grantFabricator(fabricatorUser.address);

    // 부모 강재 2개 발행 + fabricatorUser에게 이전
    const PDF_HASH = ethers.keccak256(ethers.toUtf8Bytes("combine-test-pdf"));

    await registry.connect(millUser).issueMtc("PARENT_A", 1_000_000n, "QmCidA", PDF_HASH);
    await registry.connect(millUser).issueMtc("PARENT_B",   500_000n, "QmCidB", PDF_HASH);
    await registry.connect(millUser).transferOwnership("PARENT_A", fabricatorUser.address);
    await registry.connect(millUser).transferOwnership("PARENT_B", fabricatorUser.address);

    // 조합 결과물 기본 파라미터
    const CHILD_ID     = "CHILD_AB";
    const CHILD_WEIGHT = 1_275_000n;  // 1,500,000g의 85% = 1,275,000g (정확히 15% 손실)
    const CHILD_CID    = "QmCombinedCid";
    const CHILD_HASH   = ethers.keccak256(ethers.toUtf8Bytes("combined-pdf"));

    return {
      registry,
      deployer,
      millUser,
      fabricatorUser,
      stranger,
      PDF_HASH,
      CHILD_ID,
      CHILD_WEIGHT,
      CHILD_CID,
      CHILD_HASH,
    };
  }

  // ── TC-012: 정상 조합 ─────────────────────────────────────────────────────
  describe("TC-012: 15% 이내 손실 조합", function () {

    it("SteelCombined 이벤트가 올바른 인자와 함께 발생해야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
        )
      )
        .to.emit(registry, "SteelCombined")
        .withArgs(
          anyValue,          // parentIds 배열
          CHILD_ID,
          1_500_000n,        // totalParentWeight
          CHILD_WEIGHT,
          fabricatorUser.address,
          anyValue           // timestamp
        );
    });

    it("자식 강재가 ACTIVE 상태로 생성되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      const child = await registry.getSteel(CHILD_ID);
      expect(child.steelId).to.equal(CHILD_ID);
      expect(child.weight).to.equal(CHILD_WEIGHT);
      expect(child.status).to.equal(0n); // ACTIVE
      expect(child.owner).to.equal(fabricatorUser.address);
      expect(child.ipfsCid).to.equal(CHILD_CID);
      expect(child.pdfHash).to.equal(CHILD_HASH);
    });

    it("조합 후 두 부모 모두 COMBINED(2) 상태이어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      const parentA = await registry.getSteel("PARENT_A");
      const parentB = await registry.getSteel("PARENT_B");
      expect(parentA.status).to.equal(2n); // COMBINED
      expect(parentB.status).to.equal(2n);
    });

    it("자식의 parentIds가 입력 부모 배열과 일치해야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      const child = await registry.getSteel(CHILD_ID);
      expect(child.parentIds).to.deep.equal(["PARENT_A", "PARENT_B"]);
    });

    it("각 부모의 childIds에 자식 ID가 추가되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      const parentA = await registry.getSteel("PARENT_A");
      const parentB = await registry.getSteel("PARENT_B");
      expect(parentA.childIds).to.deep.equal([CHILD_ID]);
      expect(parentB.childIds).to.deep.equal([CHILD_ID]);
    });

    it("조합재의 mill 필드는 address(0)이어야 한다 (단일 원산지 없음)", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      const child = await registry.getSteel(CHILD_ID);
      expect(child.mill).to.equal(ethers.ZeroAddress);
    });

  });

  // ── 경계값: 정확히 15% 손실 ──────────────────────────────────────────────
  describe("TC-추가: 경계값 (정확히 15% 손실)", function () {

    it("자식 무게 = totalParent × 85% (정확히 15% 손실)은 성공해야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      // totalParent = 1,500,000g, 85% = 1,275,000g
      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_BOUNDARY", 1_275_000n, CHILD_CID, CHILD_HASH
        )
      ).to.not.be.reverted;
    });

    it("자식 무게 = totalParent (손실 없음)도 성공해야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_NOLOSS", 1_500_000n, CHILD_CID, CHILD_HASH
        )
      ).to.not.be.reverted;
    });

  });

  // ── TC-013: 15% 초과 손실 ─────────────────────────────────────────────────
  describe("TC-013: 15% 초과 손실 조합 시도 → WeightLossExceeded revert", function () {

    it("손실률이 15%를 초과하면 WeightLossExceeded로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      // 1,274,999g → 1,500,000 × 85% = 1,275,000 > 1,274,999 → revert
      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_FAIL", 1_274_999n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "WeightLossExceeded");
    });

  });

  // ── TC-014: 단일 부모 ─────────────────────────────────────────────────────
  describe("TC-014: 단일 부모 조합 시도 → NeedMultipleParents revert", function () {

    it("부모 1개만 있으면 NeedMultipleParents로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A"], "CHILD_SINGLE", 1_000_000n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "NeedMultipleParents");
    });

    it("부모 0개면 NeedMultipleParents로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          [], "CHILD_EMPTY", 1_000_000n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "NeedMultipleParents");
    });

  });

  // ── TC-추가: 부모 개수 초과 ───────────────────────────────────────────────
  describe("TC-추가: 부모 11개 → InvalidParentCount revert", function () {

    it("부모 11개 조합 시도 시 InvalidParentCount(11)로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      const elevenIds = Array.from({ length: 11 }, (_, i) => `P_${i}`);
      await expect(
        registry.connect(fabricatorUser).combineSteel(
          elevenIds, "CHILD_11", 1_000_000n, CHILD_CID, CHILD_HASH
        )
      )
        .to.be.revertedWithCustomError(registry, "InvalidParentCount")
        .withArgs(11n);
    });

  });

  // ── TC-추가: 오류 케이스 ──────────────────────────────────────────────────
  describe("TC-추가: 오류 케이스", function () {

    it("childId가 이미 존재하면 SteelExists로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      // 먼저 조합 1회
      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      // 이미 발행된 다른 강재로 다시 시도 — PARENT_A는 이미 COMBINED이므로 다른 ID 사용
      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "SteelExists");
    });

    it("부모 강재가 존재하지 않으면 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "NONEXISTENT"], "CHILD_X", 500_000n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "SteelNotFound");
    });

    it("부모 강재의 소유자가 아니면 NotOwner로 revert 되어야 한다", async function () {
      const { registry, deployer, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      // deployer는 Fabricator 역할 있지만 PARENT_A/B 소유자가 아님
      await expect(
        registry.connect(deployer).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_Y", 1_275_000n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });

    it("ACTIVE가 아닌 부모 강재 포함 시 SteelNotActive로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH, PDF_HASH } =
        await loadFixture(deployFixture);

      // PARENT_A를 먼저 분할해서 SPLIT 상태로 만들기
      await registry.connect(fabricatorUser).splitSteel("PARENT_A", [500_000n, 500_000n]);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_Z", 1_275_000n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "SteelNotActive");
    });

    it("childWeight가 totalParentWeight를 초과하면 WeightExceedsParent로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_W", 1_500_001n, CHILD_CID, CHILD_HASH
        )
      )
        .to.be.revertedWithCustomError(registry, "WeightExceedsParent")
        .withArgs(1_500_001n, 1_500_000n);
    });

    it("비Fabricator가 combineSteel 호출 시 NotFabricator로 revert 되어야 한다", async function () {
      const { registry, stranger, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(stranger).combineSteel(
          ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "NotFabricator");
    });

    it("childWeight=0이면 InvalidWeight로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_0W", 0n, CHILD_CID, CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "InvalidWeight");
    });

    it("pdfHash=0x00이면 InvalidPdfHash로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_CID, CHILD_WEIGHT } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_0H", CHILD_WEIGHT, CHILD_CID, ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(registry, "InvalidPdfHash");
    });

    it("ipfsCid=빈 문자열이면 InvalidCid로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_WEIGHT, CHILD_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).combineSteel(
          ["PARENT_A", "PARENT_B"], "CHILD_0C", CHILD_WEIGHT, "", CHILD_HASH
        )
      ).to.be.revertedWithCustomError(registry, "InvalidCid");
    });

  });

  // ── TC-추가: 사이드 이펙트 ───────────────────────────────────────────────
  describe("TC-추가: 조합 후 사이드 이펙트", function () {

    it("조합 후 부모 강재를 다시 분할 시도하면 SteelNotActive로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).combineSteel(
        ["PARENT_A", "PARENT_B"], CHILD_ID, CHILD_WEIGHT, CHILD_CID, CHILD_HASH
      );

      await expect(
        registry.connect(fabricatorUser).splitSteel("PARENT_A", [500_000n, 500_000n])
      ).to.be.revertedWithCustomError(registry, "SteelNotActive");
    });

  });

});
