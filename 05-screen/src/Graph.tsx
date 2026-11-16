import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, useReactFlow, ReactFlowProvider, type Node } from '@xyflow/react';
import { model } from './model';
import { nodeTypes } from './nodes';

function GraphInner({ onSelect }: { onSelect: (id: string | null) => void }) {
  const version = useSyncExternalStore(model.subscribe, model.getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { nodes, edges } = useMemo(() => model.layout(), [version]);
  const rf = useReactFlow();
  const [follow, setFollow] = useState(true);
  const lastFit = useRef(0);
  const lastCount = useRef(0);
  const pending = useRef(0);

  // Auto-fit as nodes arrive, at most every 500 ms, until the user pans or zooms.
  useEffect(() => {
    if (!follow || nodes.length === lastCount.current) return;
    const run = () => {
      lastFit.current = performance.now();
      lastCount.current = nodes.length;
      rf.fitView({ padding: 0.08, duration: 250, maxZoom: 1.1 });
    };
    const since = performance.now() - lastFit.current;
    clearTimeout(pending.current);
    if (since > 500) run();
    else pending.current = window.setTimeout(run, 500 - since);
  }, [nodes.length, follow, rf]);

  const onNodeClick = useCallback((_: unknown, n: Node) => {
    if (n.type === 'trace') onSelect(n.id);
  }, [onSelect]);

  return (
    <div className="graph-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="light"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
        onMoveStart={(e) => { if (e) setFollow(false); }}
        onlyRenderVisibleElements={nodes.length > 150}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--grid)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="graph-empty">
          <p>No agent activity yet.</p>
          <p className="muted">Pick a saved run above and press Replay, or start a live run.</p>
        </div>
      )}
      {!follow && (
        <button className="btn follow" onClick={() => { setFollow(true); lastCount.current = -1; rf.fitView({ padding: 0.08, duration: 250, maxZoom: 1.1 }); }}>
          Follow new nodes
        </button>
      )}
    </div>
  );
}

export function Graph(props: { onSelect: (id: string | null) => void }) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
