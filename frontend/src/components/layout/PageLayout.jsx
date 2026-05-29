import Header from "./Header";
import EventLogPanel from "../common/EventLogPanel";

/**
 * 모든 페이지에 공통 적용되는 레이아웃 래퍼
 * 화면설계서: 헤더(상단 고정) + 메인 콘텐츠 + 이벤트 로그 패널(하단 고정)
 */
export default function PageLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 상단 고정 헤더 */}
      <Header />

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-screen-xl w-full mx-auto px-4 py-6 pb-32">
        {children}
      </main>

      {/* 하단 고정 이벤트 로그 패널 */}
      <EventLogPanel />
    </div>
  );
}
