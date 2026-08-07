'use client'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { useFlowStore, type FlowNodeData } from '@/lib/store'
import { FlowNode } from './NodeTypes/FlowNode'
import { FlowEdge } from './EdgeTypes/FlowEdge'

const nodeTypes = { flowNode: FlowNode }
const edgeTypes = { flowEdge: FlowEdge }

const NEU_BG = 'var(--neu-bg)'

function ContextMenu({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const { addNode, addSubgraph, copySelected, pasteClipboard, duplicateSelected, toggleLock, bringToFront, sendToBack } = useFlowStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const items: { label: string; shortcut?: string; action: () => void }[] = [
    { label: 'Add Node', shortcut: 'N', action: () => { addNode(); onClose() } },
    { label: 'Add Group', action: () => { addSubgraph(); onClose() } },
    { label: '---', action: () => {} },
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => { copySelected(); onClose() } },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => { pasteClipboard(); onClose() } },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => { duplicateSelected(); onClose() } },
    { label: '---', action: () => {} },
    { label: 'Lock / Unlock', action: () => {
      const sel = useFlowStore.getState().nodes.filter((n) => n.selected)
      if (sel.length > 0) toggleLock(sel.map((n) => n.id))
      onClose()
    }},
    { label: 'Bring to Front', action: () => {
      const sel = useFlowStore.getState().nodes.filter((n) => n.selected)
      if (sel.length > 0) bringToFront(sel.map((n) => n.id))
      onClose()
    }},
    { label: 'Send to Back', action: () => {
      const sel = useFlowStore.getState().nodes.filter((n) => n.selected)
      if (sel.length > 0) sendToBack(sel.map((n) => n.id))
      onClose()
    }},
    { label: '---', action: () => {} },
    { label: 'Delete', shortcut: 'Del', action: () => {
      const { nodes, edges, onNodesChange } = useFlowStore.getState()
      const selIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
      const selEdges = edges.filter((e) => e.selected).map((e) => e.id)
      const changes = [
        ...nodes.filter((n) => selIds.has(n.id)).map((n) => ({ type: 'remove' as const, id: n.id })),
        ...selEdges.map((id) => ({ type: 'remove' as const, id })),
      ]
      if (changes.length > 0) onNodesChange(changes)
      onClose()
    }},
  ]

  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    background: NEU_BG,
    borderRadius: 14,
    boxShadow: 'var(--neu-shadow-raised)',
    padding: 8,
    zIndex: 100,
    minWidth: 180,
    color: 'var(--text-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  }

  const itemStyle = (separator: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none',
    background: 'transparent',
    cursor: separator ? 'default' : 'pointer',
    padding: separator ? '4px 0' : '6px 12px',
    fontSize: 12,
    color: separator ? 'transparent' : 'var(--text-primary)',
    display: separator ? 'block' : 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: separator ? 0 : 8,
    borderBottom: separator ? '1px solid rgba(163,177,198,0.3)' : 'none',
    marginBottom: separator ? 4 : 0,
    marginTop: separator ? 4 : 0,
  })

  return (
    <div ref={menuRef} style={style}>
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} style={itemStyle(true)} />
        ) : (
          <button
            key={i}
            onClick={item.action}
            style={itemStyle(false)}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(79,70,229,0.08)' }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  )
}

interface CanvasInnerProps {
  onOpenPalette?: () => void
}

function CanvasInner({ onOpenPalette }: CanvasInnerProps) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, addNodeAtPosition,
    undo, redo, duplicateSelected, copySelected, pasteClipboard,
    pushHistory, assignToSubgraph,
    drawingShape, setDrawingShape,
    showMinimap, snapToGrid, snapGrid,
    bgVariant, bgGap, bgColor, bgSize,
  } = useFlowStore()
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow()

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      if (_event.shiftKey) {
        const pos = screenToFlowPosition({ x: _event.clientX, y: _event.clientY })
        const store = useFlowStore.getState()
        const updated = store.edges.map((e) => {
          if (e.id !== edge.id) return e
          const wp = (e.data as { waypoints?: { x: number; y: number }[] } | undefined)?.waypoints ?? []
          return { ...e, data: { ...e.data, waypoints: [...wp, pos] } }
        })
        store.onEdgesChange(updated.map((e) => ({ type: 'replace' as const, id: e.id, item: e })))
      }
    },
    [screenToFlowPosition]
  )

  const variantMap: Record<string, BackgroundVariant> = {
    dots: BackgroundVariant.Dots,
    lines: BackgroundVariant.Lines,
    cross: BackgroundVariant.Cross,
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        setDrawingShape(null)
        setDragStart(null)
        setDragCurrent(null)
        setContextMenu(null)
        return
      }

      if (!isTyping && (e.key === 'n' || e.key === 'N')) {
        addNode()
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      if ((ctrl && e.shiftKey && e.key === 'z') || (ctrl && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      if (ctrl && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
        return
      }

      if (ctrl && !e.shiftKey && e.key === 'c') {
        e.preventDefault()
        copySelected()
        return
      }

      if (ctrl && !e.shiftKey && e.key === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }

      if (ctrl && e.key === 'k') {
        e.preventDefault()
        onOpenPalette?.()
        return
      }

      if (ctrl && e.key === 'a') {
        e.preventDefault()
        const allNodes = getNodes()
        useFlowStore.getState().onNodesChange(
          allNodes.map((n) => ({ type: 'select' as const, id: n.id, selected: true }))
        )
        return
      }

      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        const selected = getNodes().filter((n) => n.selected)
        if (selected.length > 0) {
          fitView({ nodes: selected, duration: 400, padding: 0.2 })
        }
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [addNode, undo, redo, duplicateSelected, copySelected, pasteClipboard, setDrawingShape, onOpenPalette, fitView, getNodes])

  const handleDoubleClick = (e: MouseEvent) => {
    if (drawingShape) return
    const target = e.target as Element
    if (target.closest('.react-flow__node')) return
    if (target.closest('.react-flow__edge')) return
    if (target.closest('.react-flow__controls')) return
    if (target.closest('.react-flow__minimap')) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addNodeAtPosition(position)
  }

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    const target = e.target as Element
    const nodeEl = target.closest('.react-flow__node') as HTMLElement | null
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-id')
      if (nodeId) {
        useFlowStore.getState().onNodesChange(
          useFlowStore.getState().nodes.map((n) => ({ type: 'select' as const, id: n.id, selected: n.id === nodeId }))
        )
      }
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setContextMenu(null)
      if (!drawingShape) return
      const target = e.target as Element
      if (target.closest('.react-flow__node')) return
      if (target.closest('.react-flow__controls')) return
      if (target.closest('.react-flow__minimap')) return
      e.preventDefault()
      setDragStart({ x: e.clientX, y: e.clientY })
      setDragCurrent({ x: e.clientX, y: e.clientY })
    },
    [drawingShape],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart) return
      setDragCurrent({ x: e.clientX, y: e.clientY })
    },
    [dragStart],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart || !drawingShape) return
      const end = { x: e.clientX, y: e.clientY }

      const dx = Math.abs(end.x - dragStart.x)
      const dy = Math.abs(end.y - dragStart.y)

      const flowStart = screenToFlowPosition({ x: dragStart.x, y: dragStart.y })
      const flowEnd = screenToFlowPosition({ x: end.x, y: end.y })

      if (dx < 20 && dy < 20) {
        addNodeAtPosition(flowStart, drawingShape)
      } else {
        const x = Math.min(flowStart.x, flowEnd.x)
        const y = Math.min(flowStart.y, flowEnd.y)
        const w = Math.abs(flowEnd.x - flowStart.x)
        const h = Math.abs(flowEnd.y - flowStart.y)
        addNodeAtPosition({ x, y }, drawingShape, w, h)
      }

      setDragStart(null)
      setDragCurrent(null)
      setDrawingShape(null)
    },
    [dragStart, drawingShape, screenToFlowPosition, addNodeAtPosition, setDrawingShape],
  )

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent, draggedNode: Node<FlowNodeData>) => {
      pushHistory()
      const allNodes = useFlowStore.getState().nodes

      if (draggedNode.data.isSubgraph) {
        const sgW = typeof draggedNode.style?.width === 'number' ? draggedNode.style.width : 320
        const sgH = typeof draggedNode.style?.height === 'number' ? draggedNode.style.height : 220
        const freeNodes = allNodes.filter((n) => !n.data.isSubgraph && !n.parentId)
        const toAssign = freeNodes.filter((n) => {
          const nw = n.measured?.width ?? 150
          const nh = n.measured?.height ?? 60
          const cx = n.position.x + nw / 2
          const cy = n.position.y + nh / 2
          return (
            cx >= draggedNode.position.x && cx <= draggedNode.position.x + sgW &&
            cy >= draggedNode.position.y && cy <= draggedNode.position.y + sgH
          )
        })
        if (toAssign.length > 0) assignToSubgraph(toAssign.map((n) => n.id), draggedNode.id)
        return
      }

      const w = draggedNode.measured?.width ?? 150
      const h = draggedNode.measured?.height ?? 60

      if (draggedNode.parentId) {
        const parent = allNodes.find((n) => n.id === draggedNode.parentId)
        if (parent) {
          const sgW = typeof parent.style?.width === 'number' ? parent.style.width : 320
          const sgH = typeof parent.style?.height === 'number' ? parent.style.height : 220
          const cx = draggedNode.position.x + w / 2
          const cy = draggedNode.position.y + h / 2
          if (cx < 0 || cx > sgW || cy < 0 || cy > sgH) {
            assignToSubgraph([draggedNode.id], null)
          }
        }
        return
      }

      const subgraphs = allNodes.filter((n) => n.data.isSubgraph)
      if (subgraphs.length === 0) return
      const cx = draggedNode.position.x + w / 2
      const cy = draggedNode.position.y + h / 2
      for (const sg of subgraphs) {
        const sgW = typeof sg.style?.width === 'number' ? sg.style.width : 320
        const sgH = typeof sg.style?.height === 'number' ? sg.style.height : 220
        if (cx >= sg.position.x && cx <= sg.position.x + sgW &&
            cy >= sg.position.y && cy <= sg.position.y + sgH) {
          assignToSubgraph([draggedNode.id], sg.id)
          return
        }
      }
    },
    [pushHistory, assignToSubgraph]
  )

  const previewRect =
    dragStart && dragCurrent
      ? {
          left: Math.min(dragStart.x, dragCurrent.x),
          top: Math.min(dragStart.y, dragCurrent.y),
          width: Math.abs(dragCurrent.x - dragStart.x),
          height: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null

  // Offset preview rect relative to wrapper element
  // eslint-disable-next-line react-hooks/refs
  const wrapperRect = wrapperRef.current?.getBoundingClientRect()
  const relativePreview = previewRect && wrapperRect
    ? {
        left: previewRect.left - wrapperRect.left,
        top: previewRect.top - wrapperRect.top,
        width: previewRect.width,
        height: previewRect.height,
      }
    : null

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-full relative ${drawingShape ? 'cursor-crosshair' : ''}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        isValidConnection={(c) => c.source !== c.target}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        panOnDrag={drawingShape ? false : [1, 2]}
        selectionOnDrag={!drawingShape}
        multiSelectionKeyCode={['Shift', 'Control']}
        nodesDraggable={!drawingShape}
        snapToGrid={snapToGrid}
        snapGrid={snapGrid}
        onEdgeClick={handleEdgeClick}
        style={{ background: NEU_BG }}
      >
        <Background variant={variantMap[bgVariant] ?? BackgroundVariant.Dots} gap={bgGap} size={bgSize} color={bgColor} />
        {showMinimap && <MiniMap position="bottom-right" pannable zoomable style={{ background: NEU_BG, borderRadius: 12, boxShadow: 'var(--neu-shadow-raised)', border: 'none' }} />}
      </ReactFlow>

      {relativePreview && relativePreview.width > 4 && relativePreview.height > 4 && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-50/30 rounded"
          style={relativePreview}
        />
      )}

      {nodes.length === 0 && !drawingShape && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Canvas is empty</p>
            <p style={{ fontSize: 14 }}>
                Select a shape above and drag to draw, double-click canvas, or press{' '}
              <kbd style={{ padding: '1px 4px', borderRadius: 4, background: 'var(--text-muted)', color: NEU_BG, fontSize: 12, fontFamily: 'monospace' }}>N</kbd>{' '}
              to add a node. Right-click for more options.
            </p>
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

export function Canvas({ onOpenPalette }: { onOpenPalette?: () => void }) {
  return <CanvasInner onOpenPalette={onOpenPalette} />
}
