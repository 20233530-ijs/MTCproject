import { useState } from "react";

/**
 * 이벤트 로그 패널 (화면 하단 고정, 접기/펼치기)
 * 화면설계서 §2.3 기준
 * Phase 8에서 실제 온체인 이벤트 연동 구현 예정
 * - 최신 20건 표시
 * - provider.queryFilter() 기반 실시간 갱신
 * - [TX ↗] Etherscan Sepolia 트랜잭션 링크
 */
export default function EventLogPanel() {
  const [isExpanded, setIsExpanded] = useState(true);

  // Phase 8 구현 전 플레이스홀더 데이터
  const placeholderLogs = [
    {
      id: "1",
      time: "--:--",
      success: true,
      event: "이벤트 로그",
      detail: "Phase 8에서 온체인 이벤트 연동 예정",
      txHash: null,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[6000] bg-white border-t border-gray-200 shadow-lg">
      {/* 헤더 바 */}
      <div className="max-w-screen-xl mx-auto px-4">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full h-9 flex items-center justify-between text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          aria-label={isExpanded ? "이벤트 로그 접기" : "이벤트 로그 펼치기"}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            이벤트 로그
          </span>
          <span className="text-gray-400">{isExpanded ? "▼" : "▲"}</span>
        </button>

        {/* 로그 목록 */}
        {isExpanded && (
          <div className="pb-2 max-h-28 overflow-y-auto space-y-0.5">
            {placeholderLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }) {
  return (
    <div className="flex items-center gap-3 py-0.5 text-xs font-mono">
      {/* 시간 */}
      <span className="text-gray-400 shrink-0">[{log.time}]</span>

      {/* 성공/실패 아이콘 */}
      <span className={log.success ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
        {log.success ? "✓" : "✗"}
      </span>

      {/* 이벤트명 */}
      <span className={`font-semibold ${log.success ? "text-gray-800" : "text-red-700"} truncate`}>
        {log.event}
      </span>

      {/* 상세 */}
      <span className="text-gray-500 truncate flex-1">{log.detail}</span>

      {/* Etherscan 링크 */}
      {log.txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 shrink-0"
        >
          [TX ↗]
        </a>
      )}
    </div>
  );
}
