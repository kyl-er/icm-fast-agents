import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Item } from './model';

const GLYPH: Record<Item['kind'], string> = {
  run: '▶', llm: '◆', tool: '→', decision: '◈', spawn: '+', message: '✉', end: '■', collapsed: '▤',
};

const RAIL_HANDLE = { left: 20 };
const HANG_HANDLE = { left: 6 };

function TraceNodeImpl({ data, selected }: NodeProps) {
  const it = (data as { item: Item }).item;
  const cls = `tn tn-${it.kind} st-${it.status}${selected ? ' sel' : ''}`;
  // Handles sit on the left rail. Hung nodes (tools, decisions) are drawn 14px to the right,
  // so their handles move 14px left to keep the chain a straight vertical line.
  const hs = it.kind === 'tool' || it.kind === 'decision' ? HANG_HANDLE : RAIL_HANDLE;
  return (
    <div className={cls} title={it.title}>
      <Handle type="target" position={Position.Top} className="h" style={hs} isConnectable={false} />
      <div className="tn-title">
        <span className="tn-g" aria-hidden>{GLYPH[it.kind]}</span>
        <span className="tn-t">{it.title}</span>
      </div>
      {it.lines.map((l, i) => (l ? <div key={i} className={i === 0 ? 'tn-l1' : 'tn-l2'}>{l}</div> : null))}
      <Handle type="source" position={Position.Bottom} className="h" style={hs} isConnectable={false} />
    </div>
  );
}

function LaneNodeImpl({ data }: NodeProps) {
  const d = data as { label: string; count: number };
  return (
    <div className="lane">
      <div className="lane-h">
        <span>{d.label}</span>
        <span className="lane-n">{d.count} run{d.count === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

export const TraceNode = memo(TraceNodeImpl);
export const LaneNode = memo(LaneNodeImpl);

// Defined once at module level so React Flow never sees a new object.
export const nodeTypes = { trace: TraceNode, lane: LaneNode };
