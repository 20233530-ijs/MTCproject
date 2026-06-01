/**
 * 메인 페이지 — MTCPROJECT/index.html 레이아웃 적용
 * 데이터 로직(ethers.js, getLogs) 유지, UI만 Claude Design으로 교체
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../hooks/useWallet";
import { CONTRACT_ADDRESS, ETHERSCAN_BASE } from "../constants/addresses";
import { shortenAddress, formatWeight, timeAgo } from "../utils/format";
import { clearOldLogs } from "../utils/logger";

// 표시할 이벤트 종류
const WATCH_EVENTS = [
  "SteelMinted", "SteelOwnershipTransferred",
  "SteelSplit", "SteelCombined", "SteelUsed",
];

const EVENT_LABEL = {
  SteelMinted:              "SteelMinted",
  SteelOwnershipTransferred:"OwnerTransfer",
  SteelSplit:               "SteelSplit",
  SteelCombined:            "SteelCombined",
  SteelUsed:                "SteelUsed",
};

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
    timestamp: null,
  };
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { isConnected, connect, account } = useWallet();
  const { provider, readContract } = useContract();

  const [events,        setEvents]        = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [latestBlock,   setLatestBlock]   = useState(null);

  useEffect(() => { clearOldLogs(); }, []);

  // 최근 온체인 이벤트 로드
  useEffect(() => {
    if (!provider || !readContract) return;
    if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    let cancelled = false;
    setEventsLoading(true);

    const load = async () => {
      try {
        const latest    = await provider.getBlockNumber();
        if (!cancelled) setLatestBlock(latest);
        const fromBlock = Math.max(0, latest - 5000);

        const rawLogs = await provider.getLogs({
          address: CONTRACT_ADDRESS, fromBlock, toBlock: "latest",
        });
        if (cancelled) return;

        const parsed = rawLogs
          .map((raw) => {
            try {
              const p = readContract.interface.parseLog({ topics: raw.topics, data: raw.data });
              if (!WATCH_EVENTS.includes(p?.name)) return null;
              return parseHomeEvent(p, raw);
            } catch { return null; }
          })
          .filter(Boolean)
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, 5);

        if (cancelled) return;

        const withTs = await Promise.all(
          parsed.map(async (ev) => {
            try {
              const blk = await provider.getBlock(ev.blockNumber);
              return { ...ev, timestamp: blk?.timestamp ?? null };
            } catch { return ev; }
          })
        );
        if (!cancelled) setEvents(withTs);
      } catch (err) {
        console.warn("[HomePage] 이벤트 로드 실패:", err.message);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [provider, readContract]);

  function handleSearch(e) {
    e.preventDefault();
    const id = e.target.elements.searchId.value.trim();
    if (id) navigate(`/search?id=${encodeURIComponent(id)}&type=steel`);
  }

  function handleRoleCardClick(to) {
    if (!isConnected) { connect?.(); return; }
    navigate(to);
  }

  const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <PageLayout>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero">

        {/* 좌: 타이틀 + 검색 */}
        <div>
          <div className="hero-eyebrow">
            <span className="dot"></span>
            <span>MATERIAL TRACEABILITY ON-CHAIN · Sepolia</span>
          </div>

          <h1>
            강재 자재 이력 시스템
            <span className="en">
              Material Traceability Chain — Mill Sheet on Blockchain
            </span>
          </h1>

          <p className="sub">
            블록체인 기반 위변조 불가 밀시트 발행 · 분할 · 조합 · 이전 · 사용 등록을
            한 곳에서 추적하고, 가공 단계별 무게 보존과 진본성을 온체인에서 검증합니다.
          </p>

          {/* 검색 */}
          <form onSubmit={handleSearch}>
            <div className="hero-search-row">
              <label className="hero-search-input" htmlFor="homeSearchId">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <input
                  id="homeSearchId"
                  name="searchId"
                  type="text"
                  placeholder="강재 ID 또는 부품 ID 입력 — 예) H_001  ·  H_001_3  ·  P_001"
                  autoComplete="off"
                />
                <span className="kbd">↵</span>
              </label>
              <button
                type="submit"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  height: "44px", padding: "0 20px",
                  background: "var(--text-primary)", color: "#fff",
                  border: "1px solid var(--text-primary)",
                  borderRadius: "var(--r-3)", fontSize: "14px",
                  fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
                  letterSpacing: "-0.005em", transition: "background .12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1c1c1f"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--text-primary)"}
              >
                조회
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </form>

          <div className="search-hints">
            <span className="label">예시</span>
            {["H_001", "H_001_3", "COMB_001", "P_001"].map((ex) => (
              <span
                key={ex}
                className="chip"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/search?id=${ex}&type=steel`)}
              >
                {ex}
              </span>
            ))}
          </div>
        </div>

        {/* 우: 네트워크 현황 */}
        <aside className="hero-stats">
          <h4>
            <span>네트워크 현황 · Sepolia</span>
            <span className="live">
              <span className="pulse"></span>LIVE
            </span>
          </h4>

          <div className="stat">
            <div className="lbl">컨트랙트</div>
            {isDeployed ? (
              <>
                <div className="val sm" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", marginTop: "4px" }}>
                  {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
                </div>
                <div className="delta muted">
                  <a
                    href={`${ETHERSCAN_BASE}/address/${CONTRACT_ADDRESS}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--text-tertiary)", textDecoration: "none" }}
                  >
                    Etherscan에서 열기 ↗
                  </a>
                </div>
              </>
            ) : (
              <div className="val sm" style={{ color: "var(--tx-error)", fontSize: "12px" }}>
                미설정
              </div>
            )}
          </div>

          <div className="stat">
            <div className="lbl">최신 블록</div>
            <div className="val" style={{ fontSize: "16px" }}>
              {latestBlock ? `#${latestBlock.toLocaleString()}` : "—"}
            </div>
            <div className="delta muted">Sepolia testnet</div>
          </div>

          <div className="stat">
            <div className="lbl">연결된 지갑</div>
            {isConnected && account ? (
              <>
                <div className="val sm" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", marginTop: "4px" }}>
                  {shortenAddress(account)}
                </div>
                <div className="delta muted">MetaMask 연결됨</div>
              </>
            ) : (
              <div className="delta muted" style={{ marginTop: "4px" }}>미연결</div>
            )}
          </div>

          <div className="stat">
            <div className="lbl">이벤트 (최근 5,000블록)</div>
            <div className="val">
              {eventsLoading ? "…" : events.length}
              <span className="unit">건</span>
            </div>
            {events.length > 0 && (
              <div className="delta">+{events.length} · queryFilter</div>
            )}
          </div>
        </aside>
      </section>

      {/* ── 역할별 바로가기 ─────────────────────────────────────────────── */}
      <div className="section-rule">
        <span>역할별 바로가기</span>
        <span className="count">3 ROLES</span>
      </div>

      <section className="role-grid">

        {/* Mill */}
        <article
          className="role-card"
          onClick={() => handleRoleCardClick("/issue")}
        >
          <div className="head">
            <div className="role-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="14" width="18" height="6" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 14V8L12 5L17 8V14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="role-en">role · mill</span>
          </div>
          <h3>제강사 (Mill)</h3>
          <p className="role-desc">
            포스코 · 현대제철 등 원소재 생산자.
            강재 1단위에 대해 최초 MTC 토큰을 발행합니다.
          </p>
          <div className="role-actions">
            <span className="role-action">
              MTC 발행 (Mint)
              <span className="arrow">→</span>
            </span>
            <span className="role-action">
              소유권 이전
              <span className="arrow">→</span>
            </span>
          </div>
          {!isConnected && (
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "-4px" }}>
              클릭하여 지갑 연결
            </div>
          )}
        </article>

        {/* Fabricator */}
        <article
          className="role-card"
          onClick={() => handleRoleCardClick("/split")}
        >
          <div className="head">
            <div className="role-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 9L12 4L20 9V15L12 20L4 15V9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M9 12H15M12 9V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="role-en">role · fabricator</span>
          </div>
          <h3>가공사 (Fabricator)</h3>
          <p className="role-desc">
            부재 가공 / 절단. 단일 강재를 분할하거나
            동등 사양 강재를 조합합니다.
          </p>
          <div className="role-actions">
            <span className="role-action">
              분할 (Split)
              <span className="arrow">→</span>
            </span>
            <span className="role-action">
              조합 (Combine)
              <span className="arrow">→</span>
            </span>
          </div>
          {!isConnected && (
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "-4px" }}>
              클릭하여 지갑 연결
            </div>
          )}
        </article>

        {/* Integrator */}
        <article
          className="role-card"
          onClick={() => handleRoleCardClick("/usage")}
        >
          <div className="head">
            <div className="role-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="6"  cy="6"  r="2.4" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="18" cy="6"  r="2.4" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7.5 7.5L11 16M16.5 7.5L13 16" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </div>
            <span className="role-en">role · integrator</span>
          </div>
          <h3>통합사 (Integrator)</h3>
          <p className="role-desc">
            조선 · 건설 등 최종 사용자. 부품 단위로
            가공 강재를 사용 등록하고 검증합니다.
          </p>
          <div className="role-actions">
            <span className="role-action">
              사용 등록 (Usage)
              <span className="arrow">→</span>
            </span>
            <span className="role-action">
              부품 트리 조회
              <span className="arrow">→</span>
            </span>
          </div>
          {!isConnected && (
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "-4px" }}>
              클릭하여 지갑 연결
            </div>
          )}
        </article>

      </section>

      {/* ── 최근 온체인 이벤트 ──────────────────────────────────────────── */}
      <div className="section-rule" style={{ marginTop: "40px" }}>
        <span>최근 온체인 이벤트</span>
        <span className="count">최근 5,000블록</span>
      </div>

      <section className="events-card">
        <div className="events-head">
          <h4>
            최근 이벤트
            {isDeployed && (
              <span className="mono-meta">
                contract · {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </span>
            )}
          </h4>
          <div className="meta-right">
            {!eventsLoading && events.length > 0 && (
              <><span className="live-dot"></span><span>queryFilter live</span></>
            )}
            <Link to="/search" className="more-link">전체 보기 →</Link>
          </div>
        </div>

        {!isDeployed ? (
          <div className="events-empty">
            컨트랙트 주소 미설정 —{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>.env.local</span>에{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>VITE_CONTRACT_ADDRESS</span> 설정 필요
          </div>
        ) : eventsLoading ? (
          <div className="events-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block", width: "16px", height: "16px",
              border: "2px solid #e1e2e5", borderTop: "2px solid #4b5160",
              borderRadius: "999px", animation: "spin 0.9s linear infinite",
            }} />
            이벤트 로드 중...
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty">
            최근 2,000 블록 내 이벤트 없음
          </div>
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )}
      </section>

    </PageLayout>
  );
}

// ── 이벤트 행 ──────────────────────────────────────────────────────────────
function EventRow({ ev }) {
  return (
    <div className="event-row">
      <span className="ev-status">✓</span>
      <span className="ev-name">{ev.event}</span>
      <span className="ev-detail">{ev.detail}</span>
      <span className="ev-block">
        {ev.timestamp ? timeAgo(ev.timestamp) : `#${ev.blockNumber.toLocaleString()}`}
      </span>
      {ev.txHash ? (
        <a
          className="ev-tx"
          href={`${ETHERSCAN_BASE}/tx/${ev.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </a>
      ) : <span />}
    </div>
  );
}
