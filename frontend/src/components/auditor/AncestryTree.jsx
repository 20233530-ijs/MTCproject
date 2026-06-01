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

// 상태 → 왼쪽 바 색상 (Claude Design .tnode.s-* 기준)
const STATUS_LEFT_COLOR = {
  0: "#16a34a",   // ACTIVE
  1: "#b45309",   // SPLIT
  2: "#c2410c",   // COMBINED
  3: "#6b7280",   // USED
};
const STATUS_BADGE_BG = {
  0: "#ecfdf3", 1: "#fef7e6", 2: "#fff1e6", 3: "#f1f2f4",
};
const STATUS_TEXT = { 0: "ACTIVE", 1: "SPLIT", 2: "COMBINED", 3: "USED" };

const NODE_W = 176;
const H_GAP  = 220;
const V_GAP  = 130;

// ── 커스텀 노드 — Claude Design .tnode 스타일 ───────────────────────────────
function SteelNode({ data, selected }) {
  const statusN = data.status ?? 3;
  const leftColor  = STATUS_LEFT_COLOR[statusN]  ?? "#6b7280";
  const badgeBg    = STATUS_BADGE_BG[statusN]    ?? "#f1f2f4";
  const handleStyle = { background: "transparent", border: "none", width: 6, height: 6 };

  return (
    <div style={{
      width: `${NODE_W}px`,
      background: "#ffffff",
      border: selected ? "1.5px solid #0a0a0b" : "1.5px solid #e1e2e5",
      borderLeft: selected ? "4px solid #0a0a0b" : `4px solid ${leftColor}`,
      borderRadius: "8px",
      padding: "10px 12px",
      boxShadow: selected
        ? "0 0 0 2px #0a0a0b, 0 4px 12px rgba(10,10,11,0.06)"
        : "0 1px 2px rgba(10,10,11,0.04)",
      cursor: "pointer",
      boxSizing: "border-box",
      userSelect: "none",
      position: "relative",
      transition: "box-shadow .12s ease",
      fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
    }}>
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      {/* 상단: ID + 상태 배지 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
          fontSize: "13px", fontWeight: 600,
          color: "#0a0a0b",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: "110px",
        }}>
          {data.label}
        </span>
        <span style={{
          fontSize: "9px", fontWeight: 600, letterSpacing: "0.04em",
          padding: "1px 6px", borderRadius: "999px",
          background: badgeBg, color: leftColor, whiteSpace: "nowrap",
        }}>
          {STATUS_TEXT[statusN] ?? "?"}
        </span>
      </div>

      {/* 등급 · 무게 */}
      <div style={{ fontSize: "12px", color: "#4b5160", lineHeight: "16px" }}>
        {data.grade ? `${data.grade} · ` : ""}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#0a0a0b", fontWeight: 500 }}>
          {data.weightKg}
        </span>
        {" kg"}
      </div>
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
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#c8cace" },
        style:     { stroke: "#c8cace", strokeWidth: 1.2 },  /* --border-strong */
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
    <div className="tree-card" style={{ height: "460px", position: "relative" }}>
      {/* 트리 헤더 */}
      <div className="tree-head">
        <h4>
          이력 트리
          <span className="meta">
            on-chain · {flowNodes.length} nodes · {flowEdges.length} edges
          </span>
        </h4>
        <div className="right">
          <div className="tree-legend">
            <span className="lg active"><span className="sw"></span>유효</span>
            <span className="lg split"><span className="sw"></span>분할</span>
            <span className="lg combined"><span className="sw"></span>조합</span>
            <span className="lg used"><span className="sw"></span>사용</span>
          </div>
        </div>
      </div>

      {/* React Flow 뷰포트 */}
      <div style={{ height: "calc(100% - 48px)", position: "relative" }}>
        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
               style={{ background: "rgba(255,255,255,0.85)" }}>
            <span className="inline-block w-5 h-5 border-2 border-[#e1e2e5] border-t-[#4b5160] rounded-full animate-spin" />
            <span className="ml-3 text-sm" style={{ color: "#80868f" }}>이력 트리 로드 중...</span>
          </div>
        )}
        {loadError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
               style={{ background: "rgba(255,255,255,0.85)" }}>
            <p className="text-sm" style={{ color: "#b42318" }}>{loadError}</p>
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
          style={{
            background: "#f7f7f8",
            backgroundImage: "radial-gradient(circle, rgba(10,10,11,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
