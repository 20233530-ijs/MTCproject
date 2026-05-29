/**
 * MtcRegistry — MTC 발행 단위 테스트 (Phase 3)
 *
 * 테스트 대상: issueMtc, getSteel
 * 검증 항목:
 *   TC-003: Mill이 issueMtc 호출 → SteelMinted 이벤트, getSteel 데이터 일치
 *   TC-004: 비Mill이 issueMtc 호출 → NotMill revert
 *   TC-005: 중복 steelId로 issueMtc 호출 → SteelExists revert
 *   TC-추가: weight=0 → InvalidWeight revert
 *   TC-추가: pdfHash=0x00 → InvalidPdfHash revert
 *   TC-추가: ipfsCid="" → InvalidCid revert
 *   TC-추가: getSteel 존재하지 않는 ID → SteelNotFound revert
 *   TC-추가: status 초기값 ACTIVE(0) 확인
 *   TC-추가: mill / owner 필드 = 발행자 주소 확인
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue }    = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("MtcRegistry — MTC 발행 (Phase 3)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    const [deployer, millUser, stranger] = await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    // millUser에게 Mill 역할 부여
    await registry.grantMill(millUser.address);

    const MILL_ROLE = await registry.MILL_ROLE();

    // 테스트용 고정 파라미터
    const STEEL_ID  = "POSCO-2024-0001";
    const WEIGHT    = 5_000_000n;             // 5,000kg → 5,000,000g
    const IPFS_CID  = "QmTestCidHash1234567890";
    const PDF_HASH  = ethers.keccak256(ethers.toUtf8Bytes("dummy-pdf-content"));

    return {
      registry,
      deployer,
      millUser,
      stranger,
      MILL_ROLE,
      STEEL_ID,
      WEIGHT,
      IPFS_CID,
      PDF_HASH,
    };
  }

  // ── TC-003: 정상 발행 ─────────────────────────────────────────────────────
  describe("TC-003: Mill이 issueMtc 호출 → 정상 발행", function () {

    it("SteelMinted 이벤트가 올바른 인자와 함께 발생해야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH)
      )
        .to.emit(registry, "SteelMinted")
        .withArgs(STEEL_ID, millUser.address, WEIGHT, IPFS_CID, PDF_HASH, anyValue);
    });

    it("getSteel로 조회한 steelId, weight, ipfsCid, pdfHash가 발행 파라미터와 일치해야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.steelId).to.equal(STEEL_ID);
      expect(steel.weight).to.equal(WEIGHT);
      expect(steel.ipfsCid).to.equal(IPFS_CID);
      expect(steel.pdfHash).to.equal(PDF_HASH);
    });

    it("발행 직후 status는 ACTIVE(0)이어야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.status).to.equal(0n); // SteelStatus.ACTIVE
    });

    it("발행 직후 mill과 owner가 모두 발행자 주소여야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.mill).to.equal(millUser.address);
      expect(steel.owner).to.equal(millUser.address);
    });

    it("발행 직후 parentIds와 childIds는 빈 배열이어야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.parentIds).to.deep.equal([]);
      expect(steel.childIds).to.deep.equal([]);
    });

    it("Admin(deployer)도 Mill 역할을 보유하므로 issueMtc를 호출할 수 있어야 한다", async function () {
      const { registry, deployer, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(deployer).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH)
      ).to.not.be.reverted;
    });

  });

  // ── TC-004: 비Mill 발행 시도 ──────────────────────────────────────────────
  describe("TC-004: 비Mill이 issueMtc 호출 → NotMill revert", function () {

    it("Mill 역할 없는 stranger가 issueMtc 호출 시 NotMill로 revert 되어야 한다", async function () {
      const { registry, stranger, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(stranger).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH)
      ).to.be.revertedWithCustomError(registry, "NotMill");
    });

  });

  // ── TC-005: 중복 steelId ───────────────────────────────────────────────────
  describe("TC-005: 중복 steelId → SteelExists revert", function () {

    it("이미 발행된 steelId로 issueMtc 호출 시 SteelExists로 revert 되어야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);

      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH)
      )
        .to.be.revertedWithCustomError(registry, "SteelExists")
        .withArgs(STEEL_ID);
    });

  });

  // ── TC-추가: 입력 유효성 검사 ─────────────────────────────────────────────
  describe("TC-추가: 입력 유효성 검사", function () {

    it("weight=0이면 InvalidWeight로 revert 되어야 한다", async function () {
      const { registry, millUser, STEEL_ID, IPFS_CID, PDF_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, 0n, IPFS_CID, PDF_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidWeight");
    });

    it("pdfHash=bytes32(0)이면 InvalidPdfHash로 revert 되어야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, IPFS_CID } =
        await loadFixture(deployFixture);

      const ZERO_HASH = ethers.ZeroHash; // 0x0000...0000
      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, ZERO_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidPdfHash");
    });

    it("ipfsCid=빈 문자열이면 InvalidCid로 revert 되어야 한다", async function () {
      const { registry, millUser, STEEL_ID, WEIGHT, PDF_HASH } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, "", PDF_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidCid");
    });

  });

  // ── TC-추가: getSteel 에러 처리 ───────────────────────────────────────────
  describe("TC-추가: getSteel 에러 처리", function () {

    it("존재하지 않는 steelId 조회 시 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);

      await expect(registry.getSteel("NONEXISTENT-ID"))
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("NONEXISTENT-ID");
    });

  });

});

