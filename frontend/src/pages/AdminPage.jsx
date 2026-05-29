import { useState } from "react";
import PageLayout from "../components/layout/PageLayout";

/**
 * 역할 관리 페이지 (/admin)
 * 화면설계서 §5 기준 / 접근 권한: Admin
 * Phase 9에서 완전 구현 예정 (grantMill/Fabricator/Integrator 트랜잭션)
 */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">역할 관리</h2>
        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <TabBtn active={activeTab === "register"} onClick={() => setActiveTab("register")}>
            역할 등록
          </TabBtn>
          <TabBtn active={activeTab === "list"} onClick={() => setActiveTab("list")}>
            역할 조회
          </TabBtn>
        </div>
      </div>

      {activeTab === "register" && (
        <div className="section-card max-w-lg space-y-5">
          {/* 지갑 주소 */}
          <div>
            <label className="label">지갑 주소</label>
            <input
              type="text"
              placeholder="0x..."
              className="input"
              disabled
            />
            <p className="field-error" style={{ display: "none" }}>
              0x로 시작하는 42자리 주소를 입력하세요
            </p>
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="label">역할 선택</label>
            <div className="space-y-2">
              {["Mill (제강사)", "Fabricator (가공사)", "Integrator (통합사)"].map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="role" className="accent-blue-600" disabled />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <button className="btn-blue w-full" disabled>
            역할 등록 — MetaMask ✍ (Phase 9 구현 예정)
          </button>
        </div>
      )}

      {activeTab === "list" && (
        <div className="section-card text-sm text-gray-400 text-center py-8">
          Phase 9에서 RoleGranted 이벤트 기반 역할 목록 표시 구현 예정
        </div>
      )}
    </PageLayout>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
