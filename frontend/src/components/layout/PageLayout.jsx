/**
 * 공통 페이지 레이아웃 래퍼
 * 화면설계서: 헤더(상단 고정) + 메인 콘텐츠 + TxStatus(우하단) + EventLog(하단 고정)
 */

import Header from "./Header";
import EventLog from "../common/EventLog";
import TxStatus from "../common/TxStatus";

export default function PageLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 상단 고정 헤더 + 네트워크 경고 배너 */}
      <Header />

      {/* 메인 콘텐츠 영역 (하단 EventLog 높이만큼 패딩) */}
      <main className="flex-1 max-w-screen-xl w-full mx-auto px-4 py-6 pb-40">
        {children}
      </main>

      {/* 우측 하단 고정 트랜잭션 Toast */}
      <TxStatus />

      {/* 하단 고정 이벤트 로그 패널 */}
      <EventLog />
    </div>
  );
}
