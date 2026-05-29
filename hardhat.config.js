require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Sepolia RPC URL — Alchemy/Infura/공개 RPC 중 선택
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
// 배포 지갑 개인키 (.env에서 로드, 절대 하드코딩 금지)
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
// Etherscan API 키 (소스코드 Verify용)
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // 로컬 테스트 네트워크 — 기본값 사용
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
