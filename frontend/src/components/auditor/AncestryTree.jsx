/**
 * 강재 이력 트리 컴포넌트 (React Flow v11 기반)
 * 화면설계서 §4 기준
 *
 * - 조회된 강재를 루트로 BFS 트리 빌드
 *   · 자식(childIds): 아래 방향 확장
 *   · 부모(parentIds): 위 방향 확장 (조합 강재의 여러 부모)
 * - 순환 참조 방지: visited Set 사용
 * - 노드 테두리: ACTIVE=초록, SPLIT=노랑, COMBINED=주황, USED=회색
 * - 노드 클릭 → onNodeSelect(steelId)
 * - 휠 줌 + 드래그 이동
 */

import { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
// CSS는 main.jsx에서 전역 import (여기 중복 불필요)
import { useContract } from "../../hooks/useContract";
import { gramsToKg } from "../../utils/format";
import { logQuery } from "../../utils/logger";

const MAX_NODES = 30;

// 상태 번호 → 노드 border / background
const STATUS_STYLE = {
  0: { border: "2px solid #059669", bg: "#f0fdf4" }, // ACTIVE  초록
  1: { border: "2px solid #ca8a04", bg: "#fefce8" }, // SPLIT   노랑
  2: { border: "2px solid #ea580c", bg: "#fff7ed" }, // COMBINED 주황
  3: { border: "2px solid #6b7280", bg: "#f9fafb" }, // USED    회색
};
const STATUS_TEXT   = { 0: "ACTIVE", 1: "SPLIT", 2: "COMBINED", 3: "USED" };
const STATUS_COLOR  = { 0: "#059669", 1: "#ca8a04", 2: "#ea580c", 3: "#6b7280" };

const NODE_W = 180;
const H_GAP  = 220;
const V_GAP  = 130;

// ── 커스텀 노드 ────────────────────────────────────────────────────────────
function SteelNode({ data, selected }) {
  const s = STATUS_STYLE[data.status] ?? STATUS_STYLE[3];
  const c = STATUS_COLOR[data.status] ?? "#6b7280";
  const handleStyle = { background: "transparent", border: "none", width: 8, height: 8 };
  return (
    <div style={{
      border: selected ? "2px solid #3B82F6" : s.border,
      background: selected ? "#EFF6FF" : s.bg,
      borderRadius: "10px",
      padding: "10px 14px",
      width: `${NODE_W}px`,
      boxShadow: selected
        ? "0 0 0 3px rgba(59,130,246,0.25)"
        : "0 2px 6px rgba(0,0,0,0.08)",
      cursor: "pointer",
      boxSizing: "border-box",
      userSelect: "none",
      position: "relative",
    }}>
      {/* 엣지 연결 핸들 — 보이지 않지만 React Flow 엣지 라우팅에 필수 */}
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <p style={{
        fontFamily: "monospace", fontWeight: "bold", fontSize: "12px",
        color: "#111827", marginBottom: "3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {data.label}
      </p>
      <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>
        {data.grade ? `${data.grade} · ` : ""}{data.weightKg} kg
      </p>
      <span style={{
        display: "inline-block", fontSize: "10px", fontWeight: "bold",
        padding: "1px 5px", borderRadius: "4px",
        background: `${c}18`, color: c,
      }}>
        {STATUS_TEXT[data.status] ?? "?"}
      </span>
    </div>
  );
}

const nodeTypes = { steelNode: SteelNode };

// ── BFS 트리 데이터 로더 ────────────────────────────────────────────────────
async function loadTreeData(rootId, readContract) {
  const visited  = new Set();
  const pending  = new Set();
  const nodeMap  = new Map(); // id → { steel, depth }
  const edgeSet  = new Set(); // "src→tgt" 중복 방지
  const edgeList = [];

  const queue = [{ id: rootId, depth: 0 }];
  pending.add(rootId);

  while (queue.length > 0 && nodeMap.size < MAX_NODES) {
    const { id, depth } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    pending.delete(id);

    let steel;
    try {
      steel = await readContract.getSteel(id);
    } catch {
      console.warn("[AncestryTree] getSteel 실패, 스킵:", id);
      continue;
    }

    nodeMap.set(id, { steel, depth });

    // 자식 → depth + 1
    for (const cid of (steel.childIds || [])) {
      const key = `${id}→${cid}`;
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ source: id, target: cid }); }
      if (!visited.has(cid) && !pending.has(cid)) { queue.push({ id: cid, depth: depth + 1 }); pending.add(cid); }
    }

    // 부모 → depth - 1 (조합 강재의 여러 부모)
    for (const pid of (steel.parentIds || [])) {
      const key = `${pid}→${id}`;
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ source: pid, target: id }); }
      if (!visited.has(pid) && !pending.has(pid)) { queue.push({ id: pid, depth: depth - 1 }); pending.add(pid); }
    }
  }

  logQuery({ steelId: rootId, nodesLoaded: nodeMap.size, depth: "tree" });
  return { nodeMap, edgeList };
}

// ── depth별 위치 계산 ─────────────────────────────────────────────────────
function calcPositions(nodeMap) {
  const byDepth = new Map();
  for (const [id, { depth }] of nodeMap) {
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth).push(id);
  }

  const pos = new Map();
  for (const [depth, ids] of byDepth) {
    const totalW = ids.length * H_GAP - (H_GAP - NODE_W);
    const startX = -totalW / 2;
    ids.forEach((id, i) => {
      pos.set(id, { x: startX + i * H_GAP, y: depth * V_GAP });
    });
  }
  return pos;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function AncestryTree({ rootId, selectedId, onNodeSelect, metaMap }) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading]  = useState(false);
  const [loadError, setLoadError]  = useState("");
  const rfRef = useRef(null);

  const { readContract } = useContract();

  // 트리 빌드
  const buildFlow = useCallback(async (id) => {
    if (!id || !readContract) return;

    setIsLoading(true);
    setLoadError("");
    setFlowNodes([]);
    setFlowEdges([]);

    try {
      const { nodeMap, edgeList } = await loadTreeData(id, readContract);
      const positions = calcPositions(nodeMap);

      const newNodes = [];
      for (const [nid, { steel }] of nodeMap) {
        const p = positions.get(nid) || { x: 0, y: 0 };
        const statusN = Number(steel.status);
        const kv = metaMap?.get?.(nid);

        newNodes.push({
          id: nid,
          type: "steelNode",
          position: p,
          data: {
            label:    nid,
            status:   statusN,
            weightKg: gramsToKg(steel.weight),
            grade:    kv?.grade || "",
          },
          selected: nid === selectedId,
        });
      }

      const newEdges = edgeList.map(({ source, target }) => ({
        id:        `${source}→${target}`,
        source,
        target,
        type:      "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#9CA3AF" },
        style:     { stroke: "#9CA3AF", strokeWidth: 1.5 },
      }));

      setFlowNodes(newNodes);
      setFlowEdges(newEdges);
      console.log(`[AncestryTree] 완료: ${newNodes.length}노드 ${newEdges.length}엣지`);

      setTimeout(() => rfRef.current?.fitView({ padding: 0.2 }), 120);
    } catch (err) {
      console.error("[AncestryTree] 트리 빌드 실패:", err.message);
      setLoadError("트리 로드 실패: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [readContract, metaMap, selectedId, setFlowNodes, setFlowEdges]);

  useEffect(() => { buildFlow(rootId); }, [rootId, buildFlow]);

  // selectedId 변경 → 노드 강조만 갱신 (트리 재빌드 없이)
  useEffect(() => {
    setFlowNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === selectedId })));
  }, [selectedId, setFlowNodes]);

  const handleNodeClick = useCallback((_, node) => {
    onNodeSelect?.(node.id);
  }, [onNodeSelect]);

  if (!rootId) return null;

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: "420px" }}>
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <span className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">이력 트리 로드 중...</span>
        </div>
      )}
      {loadError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
          <p className="text-sm text-red-600">{loadError}</p>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        onInit={(instance) => { rfRef.current = instance; }}
        style={{ background: "#F9FAFB" }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#E5E7EB" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* 상태 범례 */}
      {flowNodes.length > 0 && (
        <div className="absolute bottom-10 right-3 flex flex-col gap-1 bg-white/95 border border-gray-200 rounded-lg p-2 text-[10px] z-10 shadow-sm">
          {([
            [0, "#059669", "ACTIVE"],
            [1, "#ca8a04", "SPLIT"],
            [2, "#ea580c", "COMBINED"],
            [3, "#6b7280", "USED"],
          ]).map(([k, color, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
