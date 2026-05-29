/**
 * MetaMask 지갑 연결 Context
 * §10.2 Header 컴포넌트 / §6.4 호환성 기준
 *
 * 제공값:
 *   account       — 연결된 지갑 주소 (null = 미연결)
 *   chainId       — 현재 체인 ID (정수)
 *   isSepolia     — Sepolia(11155111) 여부
 *   isConnected   — MetaMask 연결 여부
 *   isConnecting  — 연결 시도 중 여부
 *   connect()     — MetaMask 연결 요청
 *   disconnect()  — 연결 해제 (UI 상태만, MetaMask 실제 해제 불가)
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SEPOLIA_CHAIN_ID } from "../constants/addresses";

export const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const isConnected = !!account;

  // 초기화 및 MetaMask 이벤트 구독
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;

    const init = async () => {
      try {
        // 이미 허용된 계정 조회 (팝업 없이)
        const accounts = await eth.request({ method: "eth_accounts" });
        if (accounts.length > 0) setAccount(accounts[0].toLowerCase());
        const hexChainId = await eth.request({ method: "eth_chainId" });
        setChainId(parseInt(hexChainId, 16));
      } catch (err) {
        console.warn("[Wallet] 초기화 실패:", err.message);
      }
    };
    init();

    const onAccountsChanged = (accounts) => {
      setAccount(accounts[0]?.toLowerCase() || null);
      console.log("[Wallet] 계정 변경:", accounts[0] || "연결 해제");
    };
    const onChainChanged = (hexChainId) => {
      const id = parseInt(hexChainId, 16);
      setChainId(id);
      console.log("[Wallet] 네트워크 변경:", id);
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      alert(
        "MetaMask가 설치되어 있지 않습니다.\nhttps://metamask.io 에서 설치하세요."
      );
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]?.toLowerCase());
      const hexChainId = await eth.request({ method: "eth_chainId" });
      setChainId(parseInt(hexChainId, 16));
      console.log("[Wallet] 연결 완료:", accounts[0]);
    } catch (err) {
      console.error("[Wallet] 연결 거부:", err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // MetaMask는 프로그래밍적 해제를 지원하지 않음 — UI 상태만 초기화
    setAccount(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ account, chainId, isSepolia, isConnected, isConnecting, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

/** MetaMask 지갑 상태 훅 */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet: WalletProvider 안에서 호출하세요");
  return ctx;
}
