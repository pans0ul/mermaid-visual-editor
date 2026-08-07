'use client'

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import { useFlowStore, type FlowEdgeData } from '@/lib/store'

function buildWaypointPath(
  sx: number, sy: number,
  tx: number, ty: number,
  waypoints: { x: number; y: number }[]
): string {
  const points = [{ x: sx, y: sy }, ...waypoints, { x: tx, y: ty }]
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    parts.push(`L ${cpx} ${prev.y} L ${cpx} ${curr.y}`)
  }
  parts.push(`L ${points[points.length - 1].x} ${points[points.length - 1].y}`)
  return parts.join(' ')
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  markerEnd,
  markerStart,
  data,
}: EdgeProps) {
  const edgeData = data as FlowEdgeData | undefined
  const waypoints = edgeData?.waypoints
  const hasWaypoints = waypoints && waypoints.length > 0

  const defaultPath = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const [edgePath, labelX, labelY] = hasWaypoints
    ? [buildWaypointPath(sourceX, sourceY, targetX, targetY, waypoints!), (sourceX + targetX) / 2, (sourceY + targetY) / 2]
    : defaultPath

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState((label as string) ?? '')
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel)

  const commitLabel = useCallback(() => {
    updateEdgeLabel(id, draft.trim())
    setEditing(false)
  }, [draft, id, updateEdgeLabel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') commitLabel()
      if (e.key === 'Escape') setEditing(false)
    },
    [commitLabel]
  )

  const edgeStyle = edgeData?.edgeStyle ?? 'solid'
  const strokeColor = edgeData?.strokeColor ?? (selected ? '#3b82f6' : '#9ca3af')
  const displayLabel = label as string | undefined

  let strokeDasharray: string | undefined
  let strokeWidth = selected ? 3 : 2
  if (edgeStyle === 'dashed') strokeDasharray = '7 4'
  if (edgeStyle === 'thick') strokeWidth = selected ? 5 : 4

  const startEdit = useCallback(() => {
    setDraft((label as string) ?? '')
    setEditing(true)
  }, [label])

  const removeWaypoint = useCallback((index: number) => {
    const store = useFlowStore.getState()
    const updated = store.edges.map((e) => {
      if (e.id !== id) return e
      const wp = [...(waypoints ?? [])]
      wp.splice(index, 1)
      return { ...e, data: { ...e.data, waypoints: wp.length > 0 ? wp : undefined } }
    })
    store.onEdgesChange(updated.map((e) => ({ type: 'replace' as const, id: e.id, item: e })))
  }, [id, waypoints])

  const waypointPositions = useMemo(() => waypoints ?? [], [waypoints])

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation()
          const store = useFlowStore.getState()
          store.onEdgesChange([{ type: 'select', id, selected: true }])
          store.onNodesChange(store.nodes.filter(n => n.selected).map(n => ({ type: 'select', id: n.id, selected: false })))
        }}
        onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ strokeDasharray, strokeWidth, stroke: strokeColor, cursor: 'pointer' }}
      />

      {waypointPositions.map((wp, i) => (
        <circle
          key={i}
          cx={wp.x}
          cy={wp.y}
          r={5}
          fill="#3b82f6"
          stroke="white"
          strokeWidth={2}
          style={{ cursor: 'pointer', zIndex: 20 }}
          className="nodrag"
          onClick={(e) => { e.stopPropagation(); removeWaypoint(i) }}
        >
          <title>Click to remove waypoint</title>
        </circle>
      ))}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10,
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={handleKeyDown}
              placeholder="label…"
              className="text-xs px-2 py-0.5 rounded border border-blue-400 bg-white shadow-sm outline-none w-32 text-center"
            />
          ) : displayLabel ? (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
              className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 shadow-sm text-gray-700 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
              style={{ minWidth: 32, textAlign: 'center' }}
            >
              {displayLabel}
            </div>
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
              onClick={(e) => { e.stopPropagation(); startEdit() }}
              title="Double-click to add label"
              className="text-xs px-2 py-0.5 rounded bg-white/70 border border-gray-200/50 text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-500 hover:bg-white transition-all select-none"
              style={{ minWidth: 40, textAlign: 'center' }}
            >
              + label
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
