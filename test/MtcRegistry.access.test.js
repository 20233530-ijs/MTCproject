/**
 * MtcRegistry — 역할 관리 단위 테스트 (Phase 2)
 *
 * 테스트 대상: grantMill/Fabricator/Integrator, revoke*, hasRole* view
 * 검증 항목:
 *   TC-001: Admin이 Mill 역할 부여 → RoleGranted 이벤트, hasMillRole true
 *   TC-002: 비Admin이 역할 부여 시도 → AccessControlUnauthorizedAccount revert
 *   TC-추가: 역할 해제 후 hasRole false
 *   TC-추가: 중복 부여 시 revert 없음 (idempotent)
 *   TC-추가: constructor에서 Admin이 모든 역할 자동 보유
 *   TC-추가: 복수 역할 동시 보유 가능
 *   TC-추가: 비Admin의 revoke 시도 → revert
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MtcRegistry — 역할 관리 (Phase 2)", function () {

  // ── 공통 픽스처 ──────────────────────────────────────────────────────────
  async function deployFixture() {
    // Hardhat 로컬 계정: deployer = Admin, 나머지는 역할 없는 일반 주소
    const [deployer, millUser, fabricatorUser, integratorUser, stranger] =
      await ethers.getSigners();

    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const registry    = await MtcRegistry.deploy();
    await registry.waitForDeployment();

    // 역할 상수 캐시 (매 테스트마다 재조회 비용 절감)
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
    const MILL_ROLE          = await registry.MILL_ROLE();
    const FABRICATOR_ROLE    = await registry.FABRICATOR_ROLE();
    const INTEGRATOR_ROLE    = await registry.INTEGRATOR_ROLE();

    return {
      registry,
      deployer,
      millUser,
      fabricatorUser,
      integratorUser,
      stranger,
      DEFAULT_ADMIN_ROLE,
      MILL_ROLE,
      FABRICATOR_ROLE,
      INTEGRATOR_ROLE,
    };
  }

  // ── 배포 초기 상태 ───────────────────────────────────────────────────────
  describe("배포 초기 상태", function () {

    it("배포자(deployer)에게 DEFAULT_ADMIN_ROLE이 부여되어야 한다", async function () {
      const { registry, deployer, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("§4.2: Admin은 모든 역할(Mill/Fabricator/Integrator)을 constructor에서 자동 보유해야 한다", async function () {
      const { registry, deployer } = await loadFixture(deployFixture);
      expect(await registry.hasMillRole(deployer.address)).to.be.true;
      expect(await registry.hasFabricatorRole(deployer.address)).to.be.true;
      expect(await registry.hasIntegratorRole(deployer.address)).to.be.true;
    });

    it("초기 상태에서 stranger(미등록 주소)는 어떤 역할도 없어야 한다", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      expect(await registry.hasMillRole(stranger.address)).to.be.false;
      expect(await registry.hasFabricatorRole(stranger.address)).to.be.false;
      expect(await registry.hasIntegratorRole(stranger.address)).to.be.false;
    });

  });

  // ── TC-001: Admin이 Mill 역할 부여 ──────────────────────────────────────
  describe("TC-001: Admin → Mill 역할 부여", function () {

    it("grantMill 호출 시 RoleGranted 이벤트가 발생해야 한다", async function () {
      const { registry, deployer, millUser, MILL_ROLE } = await loadFixture(deployFixture);
      await expect(registry.grantMill(millUser.address))
        .to.emit(registry, "RoleGranted")
        .withArgs(MILL_ROLE, millUser.address, deployer.address);
    });

    it("grantMill 이후 hasMillRole이 true를 반환해야 한다", async function () {
      const { registry, millUser } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      expect(await registry.hasMillRole(millUser.address)).to.be.true;
    });

    it("grantFabricator 이후 hasFabricatorRole이 true를 반환해야 한다", async function () {
      const { registry, fabricatorUser, FABRICATOR_ROLE, deployer } =
        await loadFixture(deployFixture);
      await expect(registry.grantFabricator(fabricatorUser.address))
        .to.emit(registry, "RoleGranted")
        .withArgs(FABRICATOR_ROLE, fabricatorUser.address, deployer.address);
      expect(await registry.hasFabricatorRole(fabricatorUser.address)).to.be.true;
    });

    it("grantIntegrator 이후 hasIntegratorRole이 true를 반환해야 한다", async function () {
      const { registry, integratorUser, INTEGRATOR_ROLE, deployer } =
        await loadFixture(deployFixture);
      await expect(registry.grantIntegrator(integratorUser.address))
        .to.emit(registry, "RoleGranted")
        .withArgs(INTEGRATOR_ROLE, integratorUser.address, deployer.address);
      expect(await registry.hasIntegratorRole(integratorUser.address)).to.be.true;
    });

  });

  // ── TC-002: 비Admin이 역할 부여 시도 ────────────────────────────────────
  describe("TC-002: 비Admin → 역할 부여 시도 (revert 확인)", function () {

    it("비Admin이 grantMill 호출 시 AccessControlUnauthorizedAccount로 revert 되어야 한다", async function () {
      const { registry, stranger, millUser } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).grantMill(millUser.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("비Admin이 grantFabricator 호출 시 revert 되어야 한다", async function () {
      const { registry, stranger, fabricatorUser } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).grantFabricator(fabricatorUser.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("비Admin이 grantIntegrator 호출 시 revert 되어야 한다", async function () {
      const { registry, stranger, integratorUser } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).grantIntegrator(integratorUser.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

  });

  // ── TC-추가: 역할 해제 ───────────────────────────────────────────────────
  describe("TC-추가: Admin → 역할 해제", function () {

    it("revokeMill 이후 hasMillRole이 false를 반환해야 한다", async function () {
      const { registry, millUser, MILL_ROLE, deployer } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      await expect(registry.revokeMill(millUser.address))
        .to.emit(registry, "RoleRevoked")
        .withArgs(MILL_ROLE, millUser.address, deployer.address);
      expect(await registry.hasMillRole(millUser.address)).to.be.false;
    });

    it("revokeFabricator 이후 hasFabricatorRole이 false를 반환해야 한다", async function () {
      const { registry, fabricatorUser } = await loadFixture(deployFixture);
      await registry.grantFabricator(fabricatorUser.address);
      await registry.revokeFabricator(fabricatorUser.address);
      expect(await registry.hasFabricatorRole(fabricatorUser.address)).to.be.false;
    });

    it("revokeIntegrator 이후 hasIntegratorRole이 false를 반환해야 한다", async function () {
      const { registry, integratorUser } = await loadFixture(deployFixture);
      await registry.grantIntegrator(integratorUser.address);
      await registry.revokeIntegrator(integratorUser.address);
      expect(await registry.hasIntegratorRole(integratorUser.address)).to.be.false;
    });

    it("비Admin이 revokeMill 호출 시 revert 되어야 한다", async function () {
      const { registry, millUser, stranger } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      await expect(registry.connect(stranger).revokeMill(millUser.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

  });

  // ── TC-추가: 중복 역할 부여 (idempotent) ─────────────────────────────────
  describe("TC-추가: 중복 역할 부여 (idempotent)", function () {

    it("이미 부여된 역할을 다시 부여해도 revert 없이 처리되어야 한다", async function () {
      const { registry, millUser } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      // 두 번째 부여 — OpenZeppelin v5에서 이미 보유한 역할은 무시
      await expect(registry.grantMill(millUser.address)).to.not.be.reverted;
      expect(await registry.hasMillRole(millUser.address)).to.be.true;
    });

    it("부여하지 않은 역할을 해제해도 revert 없이 처리되어야 한다", async function () {
      const { registry, millUser } = await loadFixture(deployFixture);
      // 역할 없는 상태에서 revoke — OpenZeppelin v5에서 silently ignored
      await expect(registry.revokeMill(millUser.address)).to.not.be.reverted;
      expect(await registry.hasMillRole(millUser.address)).to.be.false;
    });

  });

  // ── TC-추가: 복수 역할 동시 보유 ────────────────────────────────────────
  describe("TC-추가: 복수 역할 동시 보유 (§4.2 Admin 전용)", function () {

    it("한 주소에 Mill과 Fabricator 역할을 동시에 부여할 수 있어야 한다", async function () {
      const { registry, millUser } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      await registry.grantFabricator(millUser.address);
      expect(await registry.hasMillRole(millUser.address)).to.be.true;
      expect(await registry.hasFabricatorRole(millUser.address)).to.be.true;
    });

    it("한 역할 해제가 다른 역할에 영향을 주지 않아야 한다", async function () {
      const { registry, millUser } = await loadFixture(deployFixture);
      await registry.grantMill(millUser.address);
      await registry.grantFabricator(millUser.address);
      await registry.revokeMill(millUser.address);
      // Mill만 해제 — Fabricator는 유지
      expect(await registry.hasMillRole(millUser.address)).to.be.false;
      expect(await registry.hasFabricatorRole(millUser.address)).to.be.true;
    });

  });

  // ── TC-추가: 역할 상수 검증 ──────────────────────────────────────────────
  describe("역할 상수 (keccak256 해시값 검증)", function () {

    it("MILL_ROLE이 keccak256('MILL_ROLE')과 일치해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);
      const expected = ethers.keccak256(ethers.toUtf8Bytes("MILL_ROLE"));
      expect(await registry.MILL_ROLE()).to.equal(expected);
    });

    it("FABRICATOR_ROLE이 keccak256('FABRICATOR_ROLE')과 일치해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);
      const expected = ethers.keccak256(ethers.toUtf8Bytes("FABRICATOR_ROLE"));
      expect(await registry.FABRICATOR_ROLE()).to.equal(expected);
    });

    it("INTEGRATOR_ROLE이 keccak256('INTEGRATOR_ROLE')과 일치해야 한다", async function () {
      const { registry } = await loadFixture(deployFixture);
      const expected = ethers.keccak256(ethers.toUtf8Bytes("INTEGRATOR_ROLE"));
      expect(await registry.INTEGRATOR_ROLE()).to.equal(expected);
    });

  });

});
