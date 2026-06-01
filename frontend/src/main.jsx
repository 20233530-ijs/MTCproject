import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "reactflow/dist/style.css"; // React Flow 엣지·컨트롤 CSS — 반드시 index.css 전에
import "./index.css";
import "./search-design.css";

// 시작 시 7일 이상 된 이벤트 로그 정리
import { clearOldLogs } from "./utils/logger";
clearOldLogs();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
