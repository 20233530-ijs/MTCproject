/**
 * 강재 이력 트리 — standalone HTML (Claude Design Batch 2) 스타일 완전 반영
 * 블록체인 로직(BFS, getSteel) 유지 / 시각 요소만 교체
 *
 * 노드: .tn-node-wrap + .tn-top + .tn-id + .tn-status + .tn-meta.w
 * 엣지: split(회색), combine(주황 점선), used(회색) + 라벨
 */

import { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import { useContract } from "../../hooks/useContract";
import { gramsToKg } from "../../utils/format";
import { logQuery } from "../../utils/logger";

const MAX_NODES = 30;

// 상태 인덱스 → CSS 키 (standalone: 'active'|'split'|'combined'|'used')
const STATUS_KEY  = ["active", "split", "combined", "used"];
const STATUS_TEXT = { 0: "ACTIVE", 1: "SPLIT", 2: "COMBINED", 3: "USED" };

const NODE_W = 176;
const H_GAP  = 220;
const V_GAP  = 130;

// ── 커스텀 노드 — standalone .tnode → .tn-node-wrap CSS 클래스 적용 ──────────
function SteelNode({ data, selected }) {
  const statusN  = data.status ?? 3;
  const statusKey = STATUS_KEY[statusN] ?? "used";
  const handleStyle = { background: "transparent", border: "none", width: 6, height: 6 };

  return (
    <div className={`tn-node-wrap s-${statusKey}${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      {/* .tn-top: ID (left) + 상태 배지 (right) */}
      <div className="tn-top">
        <span className="tn-id">{data.label}</span>
        <span className="tn-status">{STATUS_TEXT[statusN] ?? "?"}</span>
      </div>

      {/* .tn-meta: 등급 · 무게(.w bold mono) */}
      <div className="tn-meta">
        {data.grade ? `${data.grade} · ` : ""}
        <span className="w">{data.weightKg}</span>
        {" kg"}
      </div>
    </div>
  );
}

const nodeTypes = { steelNode: SteelNode };

// ── BFS 데이터 로더 (로직 유지) ───────────────────────────────────────────────
async function loadTreeData(rootId, readContract) {
  const visited  = new Set();
  const pending  = new Set();
  const nodeMap  = new Map();
  const edgeSet  = new Set();
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

    for (const cid of (steel.childIds || [])) {
      const key = `${id}→${cid}`;
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ source: id, target: cid }); }
      if (!visited.has(cid) && !pending.has(cid)) { queue.push({ id: cid, depth: depth + 1 }); pending.add(cid); }
    }
    for (const pid of (steel.parentIds || [])) {
      const key = `${pid}→${id}`;
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ source: pid, target: id }); }
      if (!visited.has(pid) && !pending.has(pid)) { queue.push({ id: pid, depth: depth - 1 }); pending.add(pid); }
    }
  }

  logQuery({ steelId: rootId, nodesLoaded: nodeMap.size, depth: "tree" });
  return { nodeMap, edgeList };
}

// ── depth별 위치 계산 (로직 유지) ─────────────────────────────────────────────
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

// ── 엣지 스타일 계산 ───────────────────────────────────────────────────────────
// standalone 기준:
//   split  → gray solid (.tree-edge)         소스 노드 SPLIT
//   combine → orange dashed (.tree-edge.combine)  타깃 노드 COMBINED
//   used   → gray solid (.tree-edge)          타깃 노드 USED
//   각 타입 첫 엣지에 라벨 추가
function buildEdges(edgeList, nodeMap) {
  // 소스/타깃별 라벨 중복 방지
  const labeledSrc = new Set();
  const labeledTgt = new Set();

  return edgeList.map(({ source, target }) => {
    const srcStatus = Number(nodeMap.get(source)?.steel?.status ?? 3);
    const tgtStatus = Number(nodeMap.get(target)?.steel?.status ?? 3);

    const isCombine = tgtStatus === 2;   // target: COMBINED → combine edge
    const isSplit   = srcStatus === 1;   // source: SPLIT    → split edge
    const isUsed    = tgtStatus === 3;   // target: USED     → used edge

    // 라벨 생성 (타입당 첫 엣지만)
    let label      = undefined;
    let labelStyle = {
      fontSize: 9,
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fill: "#80868f",      /* --text-tertiary */
    };
    let labelBgStyle = { fill: "rgba(247,247,248,0.90)", fillOpacity: 0.90 };

    if (isCombine && !labeledTgt.has(target)) {
      label = "조합";
      labelStyle = { ...labelStyle, fill: "#c2410c" };
      labelBgStyle = { fill: "rgba(255,241,230,0.92)", fillOpacity: 0.92 };
      labeledTgt.add(target);
    } else if (isSplit && !labeledSrc.has(source)) {
      const childCount = edgeList.filter(e => e.source === source).length;
      label = `분할 ×${childCount}`;
      labeledSrc.add(source);
    } else if (isUsed && !labeledTgt.has(target)) {
      label = "사용";
      labelStyle = { ...labelStyle, fill: "#6b7280" };
      labeledTgt.add(target);
    }

    const labelProps = label ? {
      label,
      labelStyle,
      labelBgStyle,
      labelBgPadding:       [2, 5],
      labelBgBorderRadius:  3,
    } : {};

    // combine → 주황 점선 / 그 외 → 회색 실선
    if (isCombine) {
      return {
        id: `${source}→${target}`,
        source, target,
        type: "smoothstep",
        ...labelProps,
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#c2410c" },
        style: { stroke: "#c2410c", strokeWidth: 1.5, strokeDasharray: "4 3" },
      };
    }

    return {
      id: `${source}→${target}`,
      source, target,
      type: "smoothstep",
      ...labelProps,
      markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: "#c8cace" },
      style: { stroke: "#c8cace", strokeWidth: 1.2 },
    };
  });
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function AncestryTree({ rootId, selectedId, onNodeSelect, metaMap }) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom]           = useState(100);
  const rfRef = useRef(null);

  const { readContract } = useContract();

  const buildFlow = useCallback(async (id) => {
    if (!id || !readContract) return;
    setIsLoading(true); setLoadError(""); setFlowNodes([]); setFlowEdges([]);

    try {
      const { nodeMap, edgeList } = await loadTreeData(id, readContract);
      const positions = calcPositions(nodeMap);

      const newNodes = [];
      for (const [nid, { steel }] of nodeMap) {
        const p = positions.get(nid) || { x: 0, y: 0 };
        const kv = metaMap?.get?.(nid);
        newNodes.push({
          id:       nid,
          type:     "steelNode",
          position: p,
          data: {
            label:    nid,
            status:   Number(steel.status),
            weightKg: gramsToKg(steel.weight),
            grade:    kv?.grade || "",
          },
          selected: nid === selectedId,
        });
      }

      setFlowNodes(newNodes);
      setFlowEdges(buildEdges(edgeList, nodeMap));
      console.log(`[AncestryTree] 완료: ${newNodes.length}노드 ${edgeList.length}엣지`);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25 }), 120);
    } catch (err) {
      console.error("[AncestryTree] 트리 빌드 실패:", err.message);
      setLoadError("트리 로드 실패: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [readContract, metaMap, selectedId, setFlowNodes, setFlowEdges]);

  useEffect(() => { buildFlow(rootId); }, [rootId, buildFlow]);

  useEffect(() => {
    setFlowNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === selectedId })));
  }, [selectedId, setFlowNodes]);

  const handleNodeClick = useCallback((_, node) => { onNodeSelect?.(node.id); }, [onNodeSelect]);
  const handleMove = useCallback((_, vp) => { setZoom(Math.round(vp.zoom * 100)); }, []);

  if (!rootId) return null;

  return (
    <div className="tree-card" style={{ height: "460px", position: "relative" }}>

      {/* ── .tree-head ──────────────────────────────────────────────── */}
      <div className="tree-head">
        <h4>
          이력 트리
          <span className="meta">
            on-chain provenance · {flowNodes.length} nodes · {flowEdges.length} edges
          </span>
        </h4>
        <div className="right">
          <div className="tree-legend">
            <span className="lg active"><span className="sw"></span>유효</span>
            <span className="lg split"><span className="sw"></span>분할</span>
            <span className="lg combined"><span className="sw"></span>조합</span>
            <span className="lg used"><span className="sw"></span>사용</span>
          </div>
          <button
            className="tree-btn-fit"
            type="button"
            onClick={() => rfRef.current?.fitView({ padding: 0.25, duration: 300 })}
          >
            전체화면
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 9V4H9M20 9V4H15M4 15V20H9M20 15V20H15"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── .tree-viewport ──────────────────────────────────────────── */}
      <div style={{ height: "calc(100% - 49px)", position: "relative" }}>

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "rgba(255,255,255,0.88)",
          }}>
            <span style={{
              display: "inline-block", width: 16, height: 16,
              border: "2px solid #e1e2e5", borderTop: "2px solid #4b5160",
              borderRadius: "999px", animation: "spin 0.9s linear infinite",
            }} />
            <span style={{ fontSize: 13, color: "#80868f" }}>이력 트리 로드 중...</span>
          </div>
        )}
        {loadError && !isLoading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.88)",
          }}>
            <p style={{ fontSize: 13, color: "#b42318" }}>{loadError}</p>
          </div>
        )}

        {/* React Flow — dot-grid 배경 */}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onMove={handleMove}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2}
          onInit={(instance) => { rfRef.current = instance; }}
          style={{
            background: "#f7f7f8",
            backgroundImage: "radial-gradient(circle at center, rgba(10,10,11,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        />

        {/* .tree-hint — 좌상단 */}
        {!isLoading && flowNodes.length > 0 && (
          <div className="tree-hint">
            <span>드래그 이동</span><span>·</span>
            <span>휠 줌</span><span>·</span>
            <span>노드 클릭 → 상세</span>
          </div>
        )}

        {/* .tree-zoom-label — 좌하단 */}
        {flowNodes.length > 0 && (
          <span className="tree-zoom-label">{zoom}%</span>
        )}

        {/* .tree-controls — 우하단 */}
        {flowNodes.length > 0 && (
          <div className="tree-controls">
            <button type="button" aria-label="확대"
              onClick={() => rfRef.current?.zoomIn({ duration: 200 })}>+</button>
            <button type="button" aria-label="축소"
              onClick={() => rfRef.current?.zoomOut({ duration: 200 })}>−</button>
            <button type="button" aria-label="전체 맞춤" style={{ fontSize: 12 }}
              onClick={() => rfRef.current?.fitView({ padding: 0.25, duration: 300 })}>⤢</button>
          </div>
        )}

      </div>
    </div>
  );
}
