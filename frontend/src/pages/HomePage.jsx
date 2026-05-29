/**
 * 메인 페이지 (/)
 * 화면설계서 §19.2 기준
 *
 * - 통합 검색 입력 → /search?id=
 * - 역할별 바로가기 카드 3개 (Mill, Fabricator, Integrator)
 * - 최근 온체인 이벤트 5건 자동 로드 (provider.getLogs 기반)
 * - 미연결 시 바로가기 카드 클릭 → MetaMask 연결 요청
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../hooks/useWallet";
import { CONTRACT_ADDRESS, ETHERSCAN_BASE } from "../constants/addresses";
import { shortenAddress, formatWeight, timeAgo } from "../utils/format";
import { clearOldLogs } from "../utils/logger";

// 메인 페이지에 표시할 이벤트 종류
const WATCH_EVENTS = [
  "SteelMinted",
  "SteelOwnershipTransferred",
  "SteelSplit",
  "SteelCombined",
  "SteelUsed",
];

// 이벤트명 → 짧은 표시 레이블
const EVENT_LABEL = {
  SteelMinted:              "SteelMinted",
  SteelOwnershipTransferred:"OwnerTransfer",
  SteelSplit:               "SteelSplit",
  SteelCombined:            "SteelCombined",
  SteelUsed:                "SteelUsed",
};

/** 이벤트 로그 → 홈 피드용 객체 변환 */
function parseHomeEvent(parsedLog, rawLog) {
  const name = parsedLog?.name;
  const args = parsedLog?.args;
  if (!name || !args) return null;

  let detail = "";
  switch (name) {
    case "SteelMinted":
      detail = `${args.steelId}  ${formatWeight(args.weight)}`;
      break;
    case "SteelOwnershipTransferred":
      detail = `${args.steelId}  ${shortenAddress(args.from)} → ${shortenAddress(args.to)}`;
      break;
    case "SteelSplit": {
      const first = args.childIds?.[0] || "";
      const last  = args.childIds?.[args.childIds.length - 1] || "";
      detail = `${args.parentId} → [${first}…${last}]`;
      break;
    }
    case "SteelCombined": {
      const parents = args.parentIds?.join(", ") || "";
      detail = `[${parents}] → ${args.childId}`;
      break;
    }
    case "SteelUsed":
      detail = `${args.steelId} → ${args.productId}`;
      break;
    default:
      detail = name;
  }

  return {
    id: `${rawLog.transactionHash}-${rawLog.logIndex ?? 0}`,
    blockNumber: Number(rawLog.blockNumber),
    event: EVENT_LABEL[name] || name,
    detail,
    txHash: rawLog.transactionHash,
    timestamp: null, // provider.getBlock() 로 보강
  };
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate  = useNavigate();
  const { isConnected, connect } = useWallet();
  const { provider, readContract } = useContract();

  const [events, setEvents]             = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // 7일 이상 된 로컬 로그 정리 (앱 시작 시 1회)
  useEffect(() => { clearOldLogs(); }, []);

  // 최근 온체인 이벤트 5건 로드
  useEffect(() => {
    if (!provider || !readContract) return;
    if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    let cancelled = false;
    setEventsLoading(true);

    const load = async () => {
      try {
        const latest   = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 5000); // 최근 ~5,000 블록 (~17시간)

        const rawLogs = await provider.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock,
          toBlock: "latest",
        });

        if (cancelled) return;

        // 파싱 + 필터 (WATCH_EVENTS 종류만) + 최신순 정렬 + 상위 5건
        const parsed = rawLogs
          .map((raw) => {
            try {
              const p = readContract.interface.parseLog({ topics: raw.topics, data: raw.data });
              if (!WATCH_EVENTS.includes(p?.name)) return null;
              return parseHomeEvent(p, raw);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, 5);

        if (cancelled) return;

        // 각 이벤트의 블록 타임스탬프를 병렬로 조회
        const withTs = await Promise.all(
          parsed.map(async (ev) => {
            try {
              const blk = await provider.getBlock(ev.blockNumber);
              return { ...ev, timestamp: blk?.timestamp ?? null };
            } catch {
              return ev;
            }
          })
        );

        if (!cancelled) {
          setEvents(withTs);
          console.log(`[HomePage] 최근 이벤트 로드: ${withTs.length}건`);
        }
      } catch (err) {
        console.warn("[HomePage] 이벤트 로드 실패:", err.message);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [provider, readContract]);

  // 통합 검색 핸들러
  function handleSearch(e) {
    e.preventDefault();
    const id = e.target.elements.searchId.value.trim();
    if (id) navigate(`/search?id=${encodeURIComponent(id)}&type=steel`);
  }

  // 역할 바로가기 클릭 핸들러
  function handleRoleCardClick(to) {
    if (!isConnected) {
      connect?.();
      return;
    }
    navigate(to);
  }

  const roleCards = [
    {
      label: "제강사 (Mill)",
      sub:   "MTC 발행 →",
      to:    "/issue",
      borderColor: "border-l-[#2563EB]",
      textColor:   "text-[#2563EB]",
    },
    {
      label: "가공사 (Fabricator)",
      sub:   "분할 / 조합 →",
      to:    "/split",
      borderColor: "border-l-[#059669]",
      textColor:   "text-[#059669]",
    },
    {
      label: "통합사 (Integrator)",
      sub:   "사용 등록 →",
      to:    "/usage",
      borderColor: "border-l-[#D97706]",
      textColor:   "text-[#D97706]",
    },
  ];

  const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <PageLayout>

      {/* 히어로 섹션 */}
      <section className="text-center py-10 space-y-3">
        <div className="flex items-center justify-center gap-3">
          <HexIcon />
          <h1 className="text-2xl font-bold text-gray-900">
            강재 자재 이력 시스템
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          블록체인 기반 위변조 불가 밀시트 추적 및 진본성 검증
          <span className="font-mono text-xs text-gray-400 ml-1.5">
            MTC on Blockchain
          </span>
        </p>
      </section>

      {/* 통합 검색 */}
      <section className="max-w-xl mx-auto">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            name="searchId"
            type="text"
            placeholder="강재 ID 또는 부품 ID 입력  (예: H_001, P_001)"
            className="input flex-1"
            autoComplete="off"
          />
          <button type="submit" className="btn-blue shrink-0">
            검색
          </button>
        </form>
      </section>

      {/* 역할별 바로가기 */}
      <section className="mt-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
          역할별 바로가기
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {roleCards.map((card) => (
            <button
              key={card.to}
              onClick={() => handleRoleCardClick(card.to)}
              className={[
                "section-card text-left border-l-4 hover:shadow-md transition-shadow cursor-pointer",
                card.borderColor,
              ].join(" ")}
            >
              <div className={`font-semibold text-sm ${card.textColor}`}>
                {card.label}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{card.sub}</div>
              {!isConnected && (
                <div className="text-[10px] text-gray-400 mt-1">
                  클릭하여 지갑 연결
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 최근 온체인 이벤트 */}
      <section className="mt-10 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            최근 온체인 이벤트
          </p>
          <button
            onClick={() => navigate("/search")}
            className="text-xs text-blue-600 hover:underline"
          >
            전체 보기 →
          </button>
        </div>

        <div className="section-card !p-0 overflow-hidden">
          {!isDeployed ? (
            <p className="text-xs text-gray-400 text-center py-6 px-4">
              컨트랙트 주소 미설정 —{" "}
              <span className="font-mono">.env.local</span>에{" "}
              <span className="font-mono">VITE_CONTRACT_ADDRESS</span> 설정 필요
            </p>
          ) : eventsLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              <span>이벤트 로드 중...</span>
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              최근 5,000 블록 내 이벤트 없음
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {events.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </ul>
          )}
        </div>
      </section>

    </PageLayout>
  );
}

// ── 이벤트 행 ──────────────────────────────────────────────────────────────
function EventRow({ ev }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
      {/* 성공 아이콘 */}
      <span className="text-green-600 font-bold text-xs shrink-0">✓</span>

      {/* 이벤트명 */}
      <span className="font-mono text-xs font-semibold text-gray-800 shrink-0 w-[120px] truncate">
        {ev.event}
      </span>

      {/* 상세 */}
      <span className="font-mono text-xs text-gray-500 flex-1 truncate">
        {ev.detail}
      </span>

      {/* 상대 시간 */}
      <span className="text-[10px] text-gray-400 shrink-0 text-right min-w-[60px]">
        {ev.timestamp ? timeAgo(ev.timestamp) : `#${ev.blockNumber.toLocaleString()}`}
      </span>

      {/* Etherscan 링크 */}
      {ev.txHash && (
        <a
          href={`${ETHERSCAN_BASE}/tx/${ev.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 text-[10px] shrink-0 font-mono"
          onClick={(e) => e.stopPropagation()}
        >
          [TX ↗]
        </a>
      )}
    </li>
  );
}

// ── 육각형 아이콘 ──────────────────────────────────────────────────────────
function HexIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <polygon
        points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5"
        fill="#1d4ed8"
        stroke="#93c5fd"
        strokeWidth="0.8"
      />
    </svg>
  );
}
