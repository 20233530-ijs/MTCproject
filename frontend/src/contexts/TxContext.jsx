/**
 * 트랜잭션 Toast 알림 Context
 * 화면설계서 §2.2 트랜잭션 Toast 알림
 *
 * 상태 전이: sending → pending → success | rejected
 *
 * 사용법:
 *   const { pushTx, updateTx, dismissTx } = useTx();
 *
 *   const id = pushTx({ label: "MTC 발행" });          // sending 상태로 추가
 *   updateTx(id, { status: "pending", txHash });       // pending 전환
 *   updateTx(id, { status: "success", blockNumber });  // 완료 (5초 후 자동 삭제)
 *   updateTx(id, { status: "rejected", errorMsg });    // 거부 (수동 닫기)
 */

import { createContext, useContext, useReducer, useCallback } from "react";

export const TxContext = createContext(null);

function txReducer(state, action) {
  switch (action.type) {
    case "PUSH":
      return [action.toast, ...state];
    case "UPDATE":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t
      );
    case "DISMISS":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

export function TxProvider({ children }) {
  const [toasts, dispatch] = useReducer(txReducer, []);

  /** 새 Toast 추가 → sending 상태. 고유 ID 반환 */
  const pushTx = useCallback(({ label = "트랜잭션" } = {}) => {
    const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dispatch({
      type: "PUSH",
      toast: { id, label, status: "sending", txHash: null, blockNumber: null, errorMsg: null },
    });
    return id;
  }, []);

  /** Toast 상태 업데이트 */
  const updateTx = useCallback((id, patch) => {
    dispatch({ type: "UPDATE", id, patch });
    // 완료 상태는 5초 후 자동 삭제
    if (patch.status === "success") {
      setTimeout(() => dispatch({ type: "DISMISS", id }), 5000);
    }
  }, []);

  /** Toast 수동 삭제 */
  const dismissTx = useCallback((id) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  return (
    <TxContext.Provider value={{ toasts, pushTx, updateTx, dismissTx }}>
      {children}
    </TxContext.Provider>
  );
}

export function useTx() {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error("useTx: TxProvider 안에서 호출하세요");
  return ctx;
}
