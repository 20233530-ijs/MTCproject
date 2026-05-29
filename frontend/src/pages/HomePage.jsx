import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";

/**
 * 메인 페이지 (/)
 * 화면설계서 §3 기준
 * Phase 13에서 완전 구현 예정 (최근 이벤트, 역할별 바로가기)
 */
export default function HomePage() {
  const navigate = useNavigate();

  const roleCards = [
    {
      label: "제강사 (Mill)",
      sub: "MTC 발행",
      to: "/issue",
      color: "border-role-mill text-role-mill",
    },
    {
      label: "가공사 (Fabricator)",
      sub: "분할 / 조합",
      to: "/split",
      color: "border-role-fabricator text-role-fabricator",
    },
    {
      label: "통합사 (Integrator)",
      sub: "사용 등록",
      to: "/usage",
      color: "border-role-integrator text-role-integrator",
    },
  ];

  function handleSearch(e) {
    e.preventDefault();
    const id = e.target.elements.searchId.value.trim();
    if (id) navigate(`/search?id=${encodeURIComponent(id)}`);
  }

  return (
    <PageLayout>
      {/* 히어로 섹션 */}
      <section className="text-center py-10 space-y-3">
        <div className="flex items-center justify-center gap-3">
          <HexBig />
          <h1 className="text-2xl font-bold text-gray-900">
            강재 자재 이력 시스템
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          블록체인 기반 위변조 불가 밀시트 추적 및 진본성 검증
          <span className="font-mono text-xs text-gray-400 ml-1">
            · MTC on Blockchain
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
              onClick={() => navigate(card.to)}
              className={`section-card text-left border-l-4 hover:shadow-md transition-shadow cursor-pointer ${card.color}`}
            >
              <div className="font-semibold text-sm">{card.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.sub} →</div>
            </button>
          ))}
        </div>
      </section>

      {/* 최근 온체인 이벤트 (Phase 13 구현) */}
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
        <div className="section-card text-sm text-gray-400 text-center py-6">
          Phase 13에서 컨트랙트 이벤트 실시간 연동 예정
        </div>
      </section>
    </PageLayout>
  );
}

function HexBig() {
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
