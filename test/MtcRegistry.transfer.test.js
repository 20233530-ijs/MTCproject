/**
 * MtcRegistry — 소유권 이전 단위 테스트 (Phase 3)
 *
 * 테스트 대상: transferOwnership
 * 검증 항목:
 *   TC-006: 소유자가 Fabricator에게 이전 → SteelOwnershipTransferred 이벤트, owner 변경
 *   TC-추가: 소유자가 Integrator에게 이전
 *   TC-추가: 소유자가 Admin에게 이전
 *   TC-추가: 비소유자가 이전 시도 → NotOwner revert
 *   TC-추가: 등록되지 않은 수신자(stranger) → InvalidRecipient revert
 *   TC-추가: 존재하지 않는 steelId 이전 → SteelNotFound revert
 *   TC-추가: ACTIVE 아닌 강재 이전 → SteelNotActive revert (Split 후 시나리오는 Phase 4에서 검증)
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue }    = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("MtcRegistry — 소유권 이전 (Phase 3)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    const [deployer, millUser, fabricatorUser, integratorUser, stranger] =
      await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    // 역할 부여
    await registry.grantMill(millUser.address);
    await registry.grantFabricator(fabricatorUser.address);
    await registry.grantIntegrator(integratorUser.address);

    const STEEL_ID  = "POSCO-2024-0001";
    const WEIGHT    = 5_000_000n;
    const IPFS_CID  = "QmTransferTestCid";
    const PDF_HASH  = ethers.keccak256(ethers.toUtf8Bytes("transfer-test-pdf"));

    // 강재 사전 발행
    await registry.connect(millUser).issueMtc(STEEL_ID, WEIGHT, IPFS_CID, PDF_HASH);

    return {
      registry,
      deployer,
      millUser,
      fabricatorUser,
      integratorUser,
      stranger,
      STEEL_ID,
      WEIGHT,
      IPFS_CID,
      PDF_HASH,
    };
  }

  // ── TC-006: 정상 이전 ─────────────────────────────────────────────────────
  describe("TC-006: 소유자 → Fabricator 이전", function () {

    it("transferOwnership 호출 시 SteelOwnershipTransferred 이벤트가 발생해야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address)
      )
        .to.emit(registry, "SteelOwnershipTransferred")
        .withArgs(STEEL_ID, millUser.address, fabricatorUser.address, anyValue);
    });

    it("이전 후 getSteel().owner가 수신자 주소로 변경되어야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.owner).to.equal(fabricatorUser.address);
    });

    it("이전 후 mill 필드는 원래 발행자로 유지되어야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.mill).to.equal(millUser.address);
    });

    it("이전 후 status는 여전히 ACTIVE(0)이어야 한다", async function () {
      const { registry, millUser, fabricatorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);
      const steel = await registry.getSteel(STEEL_ID);

      expect(steel.status).to.equal(0n);
    });

  });

  // ── TC-추가: 다른 역할로 이전 ─────────────────────────────────────────────
  describe("TC-추가: Integrator / Admin 수신 허용", function () {

    it("소유자가 Integrator에게 이전할 수 있어야 한다", async function () {
      const { registry, millUser, integratorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, integratorUser.address)
      ).to.not.be.reverted;

      const steel = await registry.getSteel(STEEL_ID);
      expect(steel.owner).to.equal(integratorUser.address);
    });

    it("소유자가 Admin에게 이전할 수 있어야 한다", async function () {
      const { registry, millUser, deployer, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, deployer.address)
      ).to.not.be.reverted;

      const steel = await registry.getSteel(STEEL_ID);
      expect(steel.owner).to.equal(deployer.address);
    });

    it("Fabricator가 수신 후 다시 Integrator에게 이전(연속 이전)할 수 있어야 한다", async function () {
      const { registry, millUser, fabricatorUser, integratorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);
      await registry.connect(fabricatorUser).transferOwnership(STEEL_ID, integratorUser.address);

      const steel = await registry.getSteel(STEEL_ID);
      expect(steel.owner).to.equal(integratorUser.address);
    });

  });

  // ── TC-추가: 오류 케이스 ──────────────────────────────────────────────────
  describe("TC-추가: 오류 케이스", function () {

    it("비소유자가 transferOwnership 호출 시 NotOwner로 revert 되어야 한다", async function () {
      const { registry, fabricatorUser, stranger, STEEL_ID } =
        await loadFixture(deployFixture);

      // stranger는 소유자가 아님
      await expect(
        registry.connect(stranger).transferOwnership(STEEL_ID, fabricatorUser.address)
      )
        .to.be.revertedWithCustomError(registry, "NotOwner")
        .withArgs(STEEL_ID, stranger.address, anyValue);
    });

    it("역할 없는 stranger에게 이전 시도 시 InvalidRecipient로 revert 되어야 한다", async function () {
      const { registry, millUser, stranger, STEEL_ID } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, stranger.address)
      )
        .to.be.revertedWithCustomError(registry, "InvalidRecipient")
        .withArgs(stranger.address);
    });

    it("존재하지 않는 steelId 이전 시 SteelNotFound로 revert 되어야 한다", async function () {
      const { registry, millUser, fabricatorUser } =
        await loadFixture(deployFixture);

      await expect(
        registry.connect(millUser).transferOwnership("NONEXISTENT-ID", fabricatorUser.address)
      )
        .to.be.revertedWithCustomError(registry, "SteelNotFound")
        .withArgs("NONEXISTENT-ID");
    });

    it("자기 자신에게 이전 시도 시 InvalidRecipient로 revert 되어야 한다 (Mill은 Mill/Fab/Int 아님)", async function () {
      // millUser는 MILL_ROLE만 있고 FABRICATOR/INTEGRATOR/ADMIN 없으므로 InvalidRecipient
      // → Admin은 허용되므로 deployer(Admin)는 이 테스트에서 제외
      const { registry, millUser, stranger, STEEL_ID } =
        await loadFixture(deployFixture);

      // millUser는 FABRICATOR/INTEGRATOR/ADMIN 없음
      // 자기 자신(millUser → millUser)도 허용 역할이 없으면 revert
      // 단, millUser는 MILL_ROLE을 가지므로 수신자 역할 조건(FABRICATOR/INTEGRATOR/ADMIN) 불충족
      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, millUser.address)
      ).to.be.revertedWithCustomError(registry, "InvalidRecipient");
    });

  });

  // ── TC-추가: 연속 이전 후 원래 소유자 이전 불가 ───────────────────────────
  describe("TC-추가: 이전 후 이전 권한 소멸", function () {

    it("이전 후 이전 전 소유자(millUser)가 다시 이전 시도 시 NotOwner로 revert 되어야 한다", async function () {
      const { registry, millUser, fabricatorUser, integratorUser, STEEL_ID } =
        await loadFixture(deployFixture);

      await registry.connect(millUser).transferOwnership(STEEL_ID, fabricatorUser.address);

      // millUser는 더 이상 소유자가 아님
      await expect(
        registry.connect(millUser).transferOwnership(STEEL_ID, integratorUser.address)
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });

  });

});

