/**
 * 트랜잭션 Toast 알림 컴포넌트
 * 화면설계서 §2.2 기준
 *
 * 화면 우측 하단 고정, 스택 가능
 * 상태별 색상:
 *   sending  — 회색 (전송 중)
 *   pending  — 파랑 (블록 확인 대기)
 *   success  — 초록 (완료, 5초 자동 닫힘)
 *   rejected — 빨강 (거부, 수동 닫기)
 */

import { useTx } from "../../contexts/TxContext";
import { ETHERSCAN_BASE } from "../../constants/addresses";

export default function TxStatus() {
  const { toasts, dismissTx } = useTx();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[9000] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissTx(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const { id, label, status, txHash, blockNumber, errorMsg } = toast;

  const config = {
    sending: {
      bg: "bg-slate-700",
      border: "border-slate-500",
      icon: <Spinner />,
      title: "트랜잭션 전송 중...",
      text: label,
    },
    pending: {
      bg: "bg-blue-700",
      border: "border-blue-500",
      icon: <RefreshIcon />,
      title: "블록 확인 대기 중...",
      text: txHash ? `TX: ${txHash.slice(0, 8)}…${txHash.slice(-6)}` : label,
    },
    success: {
      bg: "bg-green-700",
      border: "border-green-500",
      icon: <span className="text-white text-sm font-bold">✓</span>,
      title: "완료!",
      text: blockNumber ? `블록 #${Number(blockNumber).toLocaleString()} 기록` : label,
    },
    rejected: {
      bg: "bg-red-700",
      border: "border-red-500",
      icon: <span className="text-white text-sm font-bold">✗</span>,
      title: "거부됨",
      text: errorMsg || label,
    },
  }[status] || {};

  const showClose = status === "rejected" || status === "success";
  const showEtherscan = !!txHash;

  return (
    <div
      className={[
        "pointer-events-auto w-72 rounded-xl border shadow-xl",
        "px-4 py-3 flex flex-col gap-1.5",
        "animate-fade-in",
        config.bg,
        config.border,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0">{config.icon}</span>
          <span className="text-white text-sm font-semibold">{config.title}</span>
        </div>
        {showClose && (
          <button
            onClick={onDismiss}
            className="text-white/60 hover:text-white text-xs transition-colors ml-auto"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-white/80 text-xs font-mono truncate">{config.text}</p>

      {showEtherscan && (
        <a
          href={`${ETHERSCAN_BASE}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 hover:text-white text-xs underline transition-colors"
        >
          Etherscan에서 보기 ↗
        </a>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
  );
}

function RefreshIcon() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-blue-300/40 border-t-blue-300 rounded-full animate-spin" />
  );
}
