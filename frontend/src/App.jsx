import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import AdminPage from "./pages/AdminPage";
import IssuePage from "./pages/IssuePage";
import SplitPage from "./pages/SplitPage";
import CombinePage from "./pages/CombinePage";
import UsagePage from "./pages/UsagePage";
import TransferPage from "./pages/TransferPage";

/**
 * 최상위 라우팅 컴포넌트
 * 화면설계서 §1 페이지 목록 기반 8개 경로 정의
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 접근 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Admin 전용 */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Mill / Admin */}
        <Route path="/issue" element={<IssuePage />} />

        {/* Fabricator / Admin */}
        <Route path="/split" element={<SplitPage />} />
        <Route path="/combine" element={<CombinePage />} />

        {/* Integrator / Admin */}
        <Route path="/usage" element={<UsagePage />} />

        {/* Mill / Fabricator / Admin */}
        <Route path="/transfer" element={<TransferPage />} />

        {/* 알 수 없는 경로 → 메인 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
