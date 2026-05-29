/**
 * MtcRegistry 배포 스크립트
 *
 * 사용법:
 *   로컬:   npx hardhat run scripts/deploy.js
 *   Sepolia: npx hardhat run scripts/deploy.js --network sepolia
 *
 * 배포 후 자동으로:
 *   1. Admin 역할 보유 확인
 *   2. 컨트랙트 주소 출력 (addresses.js에 수동 반영)
 *   3. ABI는 artifacts/contracts/MtcRegistry.sol/MtcRegistry.json 에서 복사
 *
 * Etherscan 검증:
 *   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
 */

const { ethers, network } = require("hardhat");

async function main() {
  console.log("═".repeat(60));
  console.log(" MtcRegistry 배포 시작");
  console.log("═".repeat(60));

  // 배포 계정 확인
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log(`\n네트워크    : ${network.name}`);
  console.log(`배포자 주소  : ${deployer.address}`);
  console.log(`잔액        : ${ethers.formatEther(balance)} ETH`);

  if (network.name === "sepolia" && balance < ethers.parseEther("0.01")) {
    throw new Error("잔액 부족 — Sepolia Faucet에서 ETH 충전 후 재시도");
  }

  // 컨트랙트 배포
  console.log("\n[1/3] MtcRegistry 컨트랙트 배포 중...");
  const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
  const registry    = await MtcRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`      ✓ 배포 완료: ${address}`);

  // 역할 확인
  console.log("\n[2/3] 역할 초기화 확인...");
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  const MILL_ROLE          = await registry.MILL_ROLE();
  const FABRICATOR_ROLE    = await registry.FABRICATOR_ROLE();
  const INTEGRATOR_ROLE    = await registry.INTEGRATOR_ROLE();

  const hasAdmin      = await registry.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const hasMill       = await registry.hasMillRole(deployer.address);
  const hasFabricator = await registry.hasFabricatorRole(deployer.address);
  const hasIntegrator = await registry.hasIntegratorRole(deployer.address);

  console.log(`      Admin      : ${hasAdmin      ? "✓" : "✗"}`);
  console.log(`      Mill       : ${hasMill       ? "✓" : "✗"}`);
  console.log(`      Fabricator : ${hasFabricator ? "✓" : "✗"}`);
  console.log(`      Integrator : ${hasIntegrator ? "✓" : "✗"}`);

  if (!hasAdmin || !hasMill || !hasFabricator || !hasIntegrator) {
    throw new Error("역할 초기화 실패 — 컨트랙트 코드 확인 필요");
  }

  // 배포 정보 출력
  console.log("\n[3/3] 배포 정보");
  console.log("─".repeat(60));
  console.log(`컨트랙트 주소: ${address}`);
  console.log(`배포 블록    : (확인 후 Etherscan에서 조회)`);

  if (network.name === "sepolia") {
    console.log(`\nEtherscan:  https://sepolia.etherscan.io/address/${address}`);
    console.log(`\n다음 단계:`);
    console.log(`  1. frontend/src/constants/addresses.js 에 VITE_CONTRACT_ADDRESS 설정`);
    console.log(`     또는 frontend/.env.local 에 VITE_CONTRACT_ADDRESS=${address} 추가`);
    console.log(`  2. ABI 업데이트:`);
    console.log(`     artifacts/contracts/MtcRegistry.sol/MtcRegistry.json 의 "abi" 필드 복사`);
    console.log(`     → frontend/src/constants/abi.js 에 붙여넣기`);
    console.log(`  3. Etherscan 소스코드 검증:`);
    console.log(`     npx hardhat verify --network sepolia ${address}`);
  } else {
    console.log(`\n로컬 배포 완료. Sepolia 배포 시 --network sepolia 옵션 추가.`);
  }
  console.log("═".repeat(60));

  return address;
}

main()
  .then((address) => {
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error("\n[ERROR]", err.message);
    process.exitCode = 1;
  });
