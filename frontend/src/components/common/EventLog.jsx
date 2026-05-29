/**
 * 이벤트 로그 패널 — 온체인 이벤트 실시간 표시
 * 화면설계서 §2.3 기준
 *
 * - 화면 하단 접기/펼치기 (기본: 펼침)
 * - 최신 20건 표시 (provider.getLogs 기반)
 * - 실시간 구독 (contract.on 이벤트 리스너)
 * - [TX ↗] Etherscan Sepolia 링크
 * - ✓ 성공=초록, ✗ 실패=빨강
 */

import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { MTC_REGISTRY_ABI } from "../../constants/abi";
import { CONTRACT_ADDRESS, ETHERSCAN_BASE } from "../../constants/addresses";
import { shortenAddress, formatTimestamp, formatWeight } from "../../utils/format";

const MAX_LOGS = 20;

// 역할 해시 → 이름 매핑 (RoleGranted/RoleRevoked 이벤트용)
const ROLE_HASH_MAP = {
  [ethers.keccak256(ethers.toUtf8Bytes("MILL_ROLE"))]: "Mill",
  [ethers.keccak256(ethers.toUtf8Bytes("FABRICATOR_ROLE"))]: "Fabricator",
  [ethers.keccak256(ethers.toUtf8Bytes("INTEGRATOR_ROLE"))]: "Integrator",
  "0x0000000000000000000000000000000000000000000000000000000000000000": "Admin",
};

function roleName(hash) {
  return ROLE_HASH_MAP[hash] || `Role(${hash.slice(0, 8)}…)`;
}

/** 이벤트 로그 항목을 UI용 객체로 변환 */
function parseEvent(parsedLog, log) {
  const name = parsedLog?.name;
  const args = parsedLog?.args;
  const txHash = log.transactionHash;
  // 블록 타임스탬프는 나중에 보강 (초기 로드 시에는 블록 번호 기준)
  const blockNumber = log.blockNumber;
  const ts = null; // 비동기 조회 필요

  let detail = "";
  let success = true;

  switch (name) {
    case "SteelMinted":
      detail = `${args.steelId}  ${formatWeight(args.weight)}`;
      break;
    case "SteelOwnershipTransferred":
      detail = `${args.steelId}  ${shortenAddress(args.from)} → ${shortenAddress(args.to)}`;
      break;
    case "SteelSplit": {
      const childCount = args.childIds?.length || 0;
      const first = args.childIds?.[0] || "";
      const last = args.childIds?.[childCount - 1] || "";
      detail = `${args.parentId} → [${first}…${last}]`;
      break;
    }
    case "SteelCombined":
      detail = `[${args.parentIds?.join(", ")}] → ${args.childId}`;
      break;
    case "SteelUsed":
      detail = `${args.steelId} → ${args.productId}`;
      break;
    case "RoleGranted":
      detail = `${shortenAddress(args.account)}  ${roleName(args.role)} 부여`;
      break;
    case "RoleRevoked":
      detail = `${shortenAddress(args.account)}  ${roleName(args.role)} 해제`;
      break;
    default:
      detail = name || "Unknown";
  }

  return {
    id: `${txHash}-${log.logIndex ?? 0}`,
    blockNumber: Number(blockNumber),
    event: name || "?",
    detail,
    txHash,
    success,
    time: "", // blockTimestamp 보강 전 임시
  };
}

export default function EventLog() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { provider, readContract } = useContract();
  const { isConnected } = useWallet();
  const contractRef = useRef(null);

  // 과거 이벤트 로드 (최근 ~2000 블록)
  useEffect(() => {
    if (!provider || !readContract) return;
    if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      try {
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 2000);

        const rawLogs = await provider.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock,
          toBlock: "latest",
        });

        if (cancelled) return;

        const parsed = rawLogs
          .map((log) => {
            try {
              const parsed = readContract.interface.parseLog({
                topics: log.topics,
                data: log.data,
              });
              return parseEvent(parsed, log);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, MAX_LOGS);

        setLogs(parsed);
        console.log(`[EventLog] 과거 이벤트 로드: ${parsed.length}건 (블록 ${fromBlock}~${latest})`);
      } catch (err) {
        console.warn("[EventLog] 이벤트 로드 실패:", err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [provider, readContract]);

  // 실시간 이벤트 구독
  useEffect(() => {
    if (!readContract || !provider) return;
    if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    const onEvent = (...args) => {
      // ethers v6: 마지막 인수가 EventLog 객체
      const log = args[args.length - 1];
      try {
        const parsed = readContract.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        const entry = parseEvent(parsed, log);
        setLogs((prev) => [entry, ...prev].slice(0, MAX_LOGS));
        console.log(`[EventLog] 새 이벤트: ${entry.event}`, entry.detail);
      } catch {
        // 파싱 실패 무시
      }
    };

    // 계약 이벤트 전체 구독
    const EVENT_NAMES = [
      "SteelMinted", "SteelOwnershipTransferred", "SteelSplit",
      "SteelCombined", "SteelUsed", "RoleGranted", "RoleRevoked",
    ];
    EVENT_NAMES.forEach((name) => {
      try { readContract.on(name, onEvent); } catch { /* 없는 이벤트 무시 */ }
    });

    contractRef.current = readContract;

    return () => {
      EVENT_NAMES.forEach((name) => {
        try { readContract.off(name, onEvent); } catch { /* 무시 */ }
      });
    };
  }, [readContract, provider]);

  const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[6000] bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* 헤더 바 */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full h-9 flex items-center justify-between
                     text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          aria-label={isExpanded ? "이벤트 로그 접기" : "이벤트 로그 펼치기"}
        >
          <span className="flex items-center gap-2">
            <span
              className={[
                "w-2 h-2 rounded-full",
                isLoading ? "bg-yellow-400 animate-pulse" : "bg-blue-400",
              ].join(" ")}
            />
            <span>이벤트 로그</span>
            {logs.length > 0 && (
              <span className="text-gray-400 font-normal">({logs.length}건)</span>
            )}
          </span>
          <span className="text-gray-400">{isExpanded ? "▼" : "▲"}</span>
        </button>

        {/* 로그 목록 */}
        {isExpanded && (
          <div className="pb-2 max-h-32 overflow-y-auto space-y-0.5">
            {!isDeployed ? (
              <p className="text-xs text-gray-400 py-2 text-center">
                컨트랙트 주소 미설정 — <span className="font-mono">.env.local</span>에{" "}
                <span className="font-mono">VITE_CONTRACT_ADDRESS</span> 설정 필요
              </p>
            ) : isLoading ? (
              <p className="text-xs text-gray-400 py-2 text-center">
                이벤트 로드 중...
              </p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 text-center">
                최근 2,000 블록 내 이벤트 없음
              </p>
            ) : (
              logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }) {
  return (
    <div className="flex items-center gap-3 py-0.5 text-xs font-mono">
      {/* 블록 번호 */}
      <span className="text-gray-400 shrink-0 text-[10px]">
        #{log.blockNumber.toLocaleString()}
      </span>

      {/* 성공/실패 */}
      <span className={log.success ? "text-green-600 font-bold shrink-0" : "text-red-600 font-bold shrink-0"}>
        {log.success ? "✓" : "✗"}
      </span>

      {/* 이벤트명 */}
      <span className={`font-semibold shrink-0 ${log.success ? "text-gray-800" : "text-red-700"}`}>
        {log.event}
      </span>

      {/* 상세 */}
      <span className="text-gray-500 truncate flex-1">{log.detail}</span>

      {/* Etherscan 링크 */}
      {log.txHash && (
        <a
          href={`${ETHERSCAN_BASE}/tx/${log.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 shrink-0 text-[10px]"
        >
          [TX ↗]
        </a>
      )}
    </div>
  );
}
