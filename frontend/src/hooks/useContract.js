/**
 * ethers.js 컨트랙트 인스턴스 훅
 * §8-6 Phase 8 구현 태스크
 *
 * 반환값:
 *   readContract  — BrowserProvider 기반 읽기 전용 인스턴스 (지갑 미연결 시도 가능)
 *   writeContract — Signer 기반 쓰기 인스턴스 (지갑 연결 필요)
 *   provider      — ethers BrowserProvider
 *   signer        — ethers Signer (null = 미연결)
 *
 * 주의: writeContract로 트랜잭션 전송 전 반드시 isConnected 확인
 */

import { useMemo } from "react";
import { ethers } from "ethers";
import { useWallet } from "./useWallet";
import { MTC_REGISTRY_ABI } from "../constants/abi";
import { CONTRACT_ADDRESS } from "../constants/addresses";

export function useContract() {
  const { account, isConnected } = useWallet();

  const provider = useMemo(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  // 읽기 전용 인스턴스 — 지갑 미연결 시에도 view 함수 호출 가능
  const readContract = useMemo(() => {
    if (!provider || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    return new ethers.Contract(CONTRACT_ADDRESS, MTC_REGISTRY_ABI, provider);
  }, [provider]);

  // 쓰기 인스턴스 — Signer 필요 (트랜잭션 전송용)
  // account 변경 시 재생성 (새 Signer 취득)
  const writeContract = useMemo(() => {
    if (!provider || !isConnected || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    // Signer는 비동기이므로 여기서는 provider와 함께 반환
    // 실제 사용 시: await writeContract.connect(await provider.getSigner())
    return { provider, abi: MTC_REGISTRY_ABI, address: CONTRACT_ADDRESS };
  }, [provider, isConnected, account]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Signer가 연결된 쓰기 가능 컨트랙트 인스턴스 생성
   * 트랜잭션 전송 직전에 호출
   */
  async function getSignedContract() {
    if (!provider || !isConnected) {
      throw new Error("지갑을 먼저 연결하세요");
    }
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, MTC_REGISTRY_ABI, signer);
  }

  return { readContract, provider, getSignedContract };
}
