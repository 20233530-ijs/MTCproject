/**
 * MtcRegistry — 강재 분할 단위 테스트 (Phase 4)
 *
 * 테스트 대상: splitSteel
 * 검증 항목:
 *   TC-007: 10% 이내 손실 분할 (5조각) → SteelSplit 이벤트, 자식 5개 생성
 *   TC-008: 무게 부풀리기 시도 (sum > parent) → WeightExceedsParent revert
 *   TC-009: 10% 초과 손실 분할 시도 → WeightLossExceeded revert
 *   TC-010: SPLIT 상태 강재 재분할 시도 → SteelNotActive revert
 *   TC-011: 11개 조각 분할 시도 → InvalidChildCount revert
 *   TC-추가: 자식 무게 중 0 포함 → InvalidWeight revert
 *   TC-추가: 비소유자 분할 시도 → NotOwner revert
 *   TC-추가: 비Fabricator 분할 시도 → NotFabricator revert
 *   TC-추가: 자식 ID 자동 생성 검증 ({parentId}_{순번} 형식)
 *   TC-추가: 부모 childIds ↔ 자식 parentIds 트리 연결 검증
 *   TC-추가: 정확히 10% 손실 (경계값) → 성공
 *   TC-추가: 딱 2개 분할 (최소값) → 성공
 *   TC-추가: 딱 10개 분할 (최대값) → 성공
 *   TC-추가: 분할 후 부모 steelId 재발행 → SteelExists revert
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue }    = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("MtcRegistry — 강재 분할 (Phase 4)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    const [deployer, millUser, fabricatorUser, stranger] =
      await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    await registry.grantMill(millUser.address);
    await registry.grantFabricator(fabricatorUser.address);

    const FABRICATOR_ROLE = await registry.FABRICATOR_ROLE();

    // 기본 강재 발행 (소유권 이전: millUser → fabricatorUser)
    const STEEL_ID = "POSCO-2024-SPLIT";
    const WEIGHT   = 2_000_000n;   // 2,000kg → 2,000,000g
    const IPFS_CID = "QmSplitTestCid";
    const PDF_HASH = ethers.keccak256(ethers.toUtf8Bytes("split-test-pdf"));

    await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);
    // fabricatorUser가 소유권 가져야 분할 가능 — millUser → fabricatorUser 이전
    await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);

    return {
      registry,
      deployer,
      millUser,
      fabricatorUser,
      stranger,
      FABRICATOR_ROLE,
      STEEL_ID,
      WEIGHT,
      IPFS_CID,
      PDF_HASH,
    };
  }

  // ── TC-007: 정상 분할 ─────────────────────────────────────────────────────
  describe("TC-007: 10% 이내 손실 분할 (5조각)", function () {

    it("SteelSplit 이벤트가 올바른 인자와 함께 발생해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID, WEIGHT } =
        await loadFixture(deployFixture);

      // 부모 2,000,000g → 자식 합계 1,900,000g (5% 손실, 허용 범위)
      const childWeights = [400_000n, 400_000n, 380_000n, 380_000n, 340_000n];

      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights)
      )
        .to.emit(registry, "SteelSplit")
        .withArgs(
          STEEL_ID,
          anyValue,          // childIds 배열
          WEIGHT,
          anyValue,          // childWeights 배열
          fabricatorUser.address,
          anyValue           // timestamp
        );
    });

    it("자식 강재 5개가 생성되고 getSteel로 조회 가능해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      const childWeights = [400_000n, 400_000n, 380_000n, 380_000n, 340_000n];
      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights);

      for (let i = 1; i <= 5; i++) {
        const childId = `${STEEL_ID}_${i}`;
        const child   = await registry.getSteel(childId);
        expect(child.steelId).to.equal(childId);
        expect(child.weight).to.equal(childWeights[i - 1]);
        expect(child.status).to.equal(0n); // ACTIVE
        expect(child.owner).to.equal(fabricatorUser.address);
      }
    });

    it("분할 후 부모 상태가 SPLIT(1)이어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      const childWeights = [1_000_000n, 1_000_000n];
      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights);

      const parent = await registry.getSteel(STEEL_ID);
      expect(parent.status).to.equal(1n); // SPLIT
    });

    it("자식의 parentIds[0]이 부모 ID여야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      const child = await registry.getSteel(`${STEEL_ID}_1`);
      expect(child.parentIds).to.deep.equal([STEEL_ID]);
    });

    it("부모의 childIds가 자식 ID 배열과 일치해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      const parent = await registry.getSteel(STEEL_ID);
      expect(parent.childIds).to.deep.equal([`${STEEL_ID}_1`, `${STEEL_ID}_2`]);
    });

    it("자식의 mill 필드가 원래 제강사 주소여야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      const child = await registry.getSteel(`${STEEL_ID}_1`);
      expect(child.mill).to.equal(millUser.address);
    });

    it("자식의 ipfsCid와 pdfHash가 부모로부터 상속되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      const child = await registry.getSteel(`${STEEL_ID}_1`);
      expect(child.ipfsCid).to.equal(IPFS_CID);
      expect(child.pdfHash).to.equal(PDF_HASH);
    });

  });

  // ── 경계값 테스트 ─────────────────────────────────────────────────────────
  describe("TC-추가: 경계값 (정확히 10% 손실 / 2개 / 10개)", function () {

    it("정확히 10% 손실 분할 (합계 = parent * 90%)은 성공해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID, WEIGHT } =
        await loadFixture(deployFixture);

      // 2,000,000 * 90% = 1,800,000
      const childWeights = [900_000n, 900_000n];
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights)
      ).to.not.be.reverted;
    });

    it("딱 2개 분할 (최소값)은 성공해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n])
      ).to.not.be.reverted;
    });

    it("딱 10개 분할 (최대값)은 성공해야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      // 200,000g × 10 = 2,000,000g (손실 없음)
      const tenWeights = Array(10).fill(200_000n);
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, tenWeights)
      ).to.not.be.reverted;

      // 자식 10개 생성 확인
      for (let i = 1; i <= 10; i++) {
        const child = await registry.getSteel(`${STEEL_ID}_${i}`);
        expect(child.steelId).to.equal(`${STEEL_ID}_${i}`);
      }
    });

  });

  // ── TC-008: 무게 부풀리기 ─────────────────────────────────────────────────
  describe("TC-008: 무게 부풀리기 시도 → WeightExceedsParent revert", function () {

    it("자식 합계가 부모 무게를 초과하면 WeightExceedsParent로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      // 부모 2,000,000g, 자식 합계 2,000,001g
      const childWeights = [1_000_001n, 1_000_000n];
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights)
      )
        .to.be.revertedWithCustomError(registry, "WeightExceedsParent")
        .withArgs(2_000_001n, 2_000_000n);
    });

  });

  // ── TC-009: 10% 초과 손실 ─────────────────────────────────────────────────
  describe("TC-009: 10% 초과 손실 분할 시도 → WeightLossExceeded revert", function () {

    it("손실률이 10%를 초과하면 WeightLossExceeded로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      // 2,000,000g의 10% = 200,000g → 허용 최소 = 1,800,000g
      // 1,799,999g 이하면 revert
      const childWeights = [900_000n, 899_999n]; // 합계 1,799,999g
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, childWeights)
      ).to.be.revertedWithCustomError(registry, "WeightLossExceeded");
    });

  });

  // ── TC-010: SPLIT 상태 강재 재분할 ───────────────────────────────────────
  describe("TC-010: SPLIT 상태 강재 재분할 시도 → SteelNotActive revert", function () {

    it("이미 분할된(SPLIT) 강재를 다시 분할 시도 시 SteelNotActive로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      // 1차 분할
      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      // 2차 분할 시도
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n])
      )
        .to.be.revertedWithCustomError(registry, "SteelNotActive")
        .withArgs(STEEL_ID, 1n); // SteelStatus.SPLIT = 1
    });

  });

  // ── TC-011: 자식 개수 초과 ────────────────────────────────────────────────
  describe("TC-011: 자식 개수 범위 위반 → InvalidChildCount revert", function () {

    it("11개 조각 분할 시도 시 InvalidChildCount(11)로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      const elevenWeights = Array(11).fill(100_000n);
      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, elevenWeights)
      )
        .to.be.revertedWithCustomError(registry, "InvalidChildCount")
        .withArgs(11n);
    });

    it("1개 분할 시도 시 InvalidChildCount(1)로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, [2_000_000n])
      )
        .to.be.revertedWithCustomError(registry, "InvalidChildCount")
        .withArgs(1n);
    });

  });

  // ── TC-추가: 입력 유효성 ──────────────────────────────────────────────────
  describe("TC-추가: 입력 유효성 검사", function () {

    it("자식 무게 중 0이 있으면 InvalidWeight로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 0n])
      ).to.be.revertedWithCustomError(registry, "InvalidWeight");
    });

    it("존재하지 않는 parentId → SteelNotFound revert", async function () {
      const { registry, fabricatorUser } = await loadFixture(deployFixture);

      await expect(
        registry.connect(fabricatorUser).splitSteel("NONEXISTENT", [1_000_000n, 1_000_000n])
      )
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("NONEXISTENT");
    });

  });

  // ── TC-추가: 역할 / 소유권 검증 ──────────────────────────────────────────
  describe("TC-추가: 역할 및 소유권 검증", function () {

    it("비Fabricator가 splitSteel 호출 시 NotFabricator로 revert 되어야 한다", async function () {
      const { registry, stranger, STEEL_ID } = await loadFixture(deployFixture);

      await expect(
        registry.connect(stranger).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n])
      ).to.be.revertedWithCustomError(registry, "NotFabricator");
    });

    it("소유자가 아닌 Fabricator가 분할 시도 시 NotOwner로 revert 되어야 한다", async function () {
      const { registry, deployer, STEEL_ID } = await loadFixture(deployFixture);
      // deployer는 Fabricator 역할 있지만 STEEL_ID의 소유자가 아님 (fabricatorUser가 소유)

      // deployer 역할 Fabricator 확인: constructor에서 자동 부여됨
      await expect(
        registry.connect(deployer).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n])
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });

  });

  // ── TC-추가: 분할 후 사이드 이펙트 ──────────────────────────────────────
  describe("TC-추가: 분할 후 사이드 이펙트", function () {

    it("분할 후 부모 steelId로 재발행 시도 시 SteelExists로 revert 되어야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH)
      )
        .to.be.revertedWithCustomError(registry, "SteelExists")
        .withArgs(STEEL_ID);
    });

    it("분할된 자식 강재를 다시 분할(2단계 분할)할 수 있어야 한다", async function () {
      const { registry, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      // 1차 분할: 부모 → 자식 2개
      await registry.connect(fabricatorUser).splitSteel(STEEL_ID, [1_000_000n, 1_000_000n]);

      // 2차 분할: 자식 1 → 손자 2개
      const childId = `${STEEL_ID}_1`;
      await expect(
        registry.connect(fabricatorUser).splitSteel(childId, [500_000n, 500_000n])
      ).to.not.be.reverted;

      const grandchild = await registry.getSteel(`${childId}_1`);
      expect(grandchild.steelId).to.equal(`${childId}_1`);
      expect(grandchild.parentIds).to.deep.equal([childId]);
    });

  });

});
