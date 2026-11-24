import { useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { ExecutionStatus } from '../../types/domain';

export interface DagNodeItem {
  id: string;
  title: string;
  subtitle: string;
  categoryLabel: string;
  status: ExecutionStatus;
  position: { x: number; y: number };
}

export interface DagEdgeItem {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface DagCanvasProps {
  nodes: DagNodeItem[];
  edges: DagEdgeItem[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onNodeMove?: (nodeId: string, pos: { x: number; y: number }) => void;
  heightClass?: string;
}

export function statusStrokeColor(status: ExecutionStatus): string {
  switch (status) {
    case 'running':    return '#00D4FF';
    case 'succeeded':
    case 'reproduced': return '#10B981';
    case 'failed':     return '#EF4444';
    case 'degraded':   return '#F59E0B';
    default:           return '#64748B';
  }
}

export function statusTextClass(status: ExecutionStatus): string {
  switch (status) {
    case 'running':    return 'text-[#008EB3] dark:text-[#00D4FF]';
    case 'succeeded':
    case 'reproduced': return 'text-emerald-600 dark:text-[#00FF88]';
    case 'failed':     return 'text-[#EF4444] dark:text-[#EF4444]';
    case 'degraded':   return 'text-amber-600 dark:text-amber-400';
    default:           return 'text-slate-500 dark:text-slate-400';
  }
}

export function DagCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onNodeMove,
  heightClass = 'min-h-[380px]',
}: DagCanvasProps) {
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 24, y: 36 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isDark =
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;

  useEffect(() => {
    const map: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => { map[n.id] = { x: n.position.x, y: n.position.y }; });
    setPositions(map);
    // Slight delay so nodes animate in after layout
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, [nodes]);

  const handlePointerDownCanvas = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('[data-dag-node]')) return;
    setDraggingCanvas(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    onSelectNode(null);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (dragNodeId) {
      setPositions((prev) => {
        const cur = prev[dragNodeId] || { x: 0, y: 0 };
        const nextPos = { x: Math.round(cur.x + dx / zoom), y: Math.round(cur.y + dy / zoom) };
        if (onNodeMove) onNodeMove(dragNodeId, nextPos);
        return { ...prev, [dragNodeId]: nextPos };
      });
    } else if (draggingCanvas) {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handlePointerUp = () => {
    setDraggingCanvas(false);
    setDragNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((z) => Math.max(0.5, Math.min(1.8, Number((z * factor).toFixed(2)))));
  };

  const showEdgeLabels = zoom >= 1.0;

  return (
    <div className={`relative rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0D1B2A] overflow-hidden flex flex-col ${heightClass}`}>
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#132238] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
          <span className="text-slate-500 dark:text-slate-400">■ Idle</span>
          <span className="text-[#008EB3] dark:text-[#00D4FF]">■ Running</span>
          <span className="text-emerald-600 dark:text-[#00FF88]">■ Succeeded</span>
          <span className="text-[#EF4444]">■ Failed</span>
          <span className="text-amber-600 dark:text-amber-400">■ Degraded</span>
        </div>
        <div className="flex items-center border border-slate-200 dark:border-[#1E3A5F] rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setZoom(0.95); setPan({ x: 24, y: 36 }); }}
            className="p-1.5 border-l border-slate-200 dark:border-[#1E3A5F] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
            aria-label="Reset view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 studio-grid-bg overflow-hidden">
        <svg
          className="w-full h-full min-h-[320px] cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handlePointerDownCanvas}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <defs>
            <marker id="dag-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#00D4FF" />
            </marker>
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const s = positions[edge.source];
              const t = positions[edge.target];
              if (!s || !t) return null;
              const startX = s.x + 210;
              const startY = s.y + 38;
              const endX = t.x;
              const endY = t.y + 38;
              const midX = (startX + endX) / 2;
              const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX - 4} ${endY}`;

              // Determine if either endpoint node is running
              const srcNode = nodes.find((n) => n.id === edge.source);
              const tgtNode = nodes.find((n) => n.id === edge.target);
              const isActive = srcNode?.status === 'running' || tgtNode?.status === 'running';

              return (
                <g key={edge.id}>
                  {/* Base edge */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#00D4FF"
                    strokeOpacity={0.5}
                    strokeWidth={1.8}
                    markerEnd="url(#dag-arrow)"
                  />
                  {/* Animated flow overlay for active edges */}
                  {isActive && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#00D4FF"
                      strokeOpacity={0.9}
                      strokeWidth={2.2}
                      className="dag-edge-flow"
                      markerEnd="url(#dag-arrow)"
                    />
                  )}
                  {/* Edge label chip — only when zoom >= 100% */}
                  {edge.label && showEdgeLabels && (
                    <g>
                      <rect
                        x={midX - 36}
                        y={(startY + endY) / 2 - 18}
                        width={72}
                        height={14}
                        rx={4}
                        fill={isDark ? '#132238' : '#F1F5F9'}
                        stroke={isDark ? '#1E3A5F' : '#CBD5E1'}
                        strokeWidth={0.8}
                      />
                      <text
                        x={midX}
                        y={(startY + endY) / 2 - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                        fill={isDark ? '#94A3B8' : '#475569'}
                      >
                        {edge.label.length > 12 ? `${edge.label.slice(0, 11)}…` : edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes — fade in on mount */}
            {nodes.map((node, ni) => {
              const pos = positions[node.id] || node.position;
              const stroke = statusStrokeColor(node.status);
              const selected = selectedNodeId === node.id;
              const isRunning = node.status === 'running';
              const opacity = mounted ? 1 : 0;
              const translateY = mounted ? 0 : 8;

              return (
                <g
                  key={node.id}
                  data-dag-node="true"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer"
                  style={{
                    opacity,
                    transform: `translate(${pos.x}px, ${pos.y}px) translateY(${translateY}px)`,
                    transition: `opacity 250ms ${ni * 50}ms ease-out, transform 250ms ${ni * 50}ms ease-out`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragNodeId(node.id);
                    lastPointer.current = { x: e.clientX, y: e.clientY };
                    onSelectNode(node.id);
                  }}
                >
                  {/* Running glow ring */}
                  {isRunning && (
                    <rect
                      x={-4}
                      y={-4}
                      width={218}
                      height={84}
                      rx={14}
                      fill="none"
                      stroke="#00D4FF"
                      strokeWidth={2}
                      strokeOpacity={0.6}
                      className="node-glow-ring"
                      filter="url(#glow-cyan)"
                    />
                  )}
                  <rect
                    x={0}
                    y={0}
                    width={210}
                    height={76}
                    rx={10}
                    fill={isDark ? '#132238' : '#FFFFFF'}
                    stroke={selected ? '#FFFFFF' : stroke}
                    strokeWidth={selected ? 2.4 : 1.7}
                  />
                  <text
                    x={12} y={20}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fill={stroke}
                    fontWeight={600}
                  >
                    {node.categoryLabel} · {node.status}
                  </text>
                  <text
                    x={12} y={41}
                    fontSize="12"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                    fontWeight={600}
                    fill={isDark ? '#E2E8F0' : '#0F172A'}
                  >
                    {node.title.length > 25 ? `${node.title.slice(0, 24)}…` : node.title}
                  </text>
                  <text
                    x={12} y={60}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fill={isDark ? '#94A3B8' : '#475569'}
                  >
                    {node.subtitle.length > 28 ? `${node.subtitle.slice(0, 27)}…` : node.subtitle}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
