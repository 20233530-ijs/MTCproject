/**
 * 배포된 컨트랙트 주소
 * Phase 6 (Sepolia 배포) 완료 후 실제 주소로 교체
 */

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

/** Ethereum Sepolia Testnet Chain ID */
export const SEPOLIA_CHAIN_ID = 11155111;

/** IPFS 게이트웨이 URL */
export const IPFS_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";

/** Cloudflare Workers API URL */
export const WORKERS_API_URL =
  import.meta.env.VITE_WORKERS_API_URL || "http://localhost:8787";

/** Etherscan Sepolia 기본 URL */
export const ETHERSCAN_BASE = "https://sepolia.etherscan.io";
