'use client'

import { useReactFlow } from '@xyflow/react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFlowStore } from '@/lib/store'

const NEU_BG = 'var(--neu-bg)'

function ZoomBtn({
  onClick,
  title,
  disabled,
  active,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      style={{
        background: NEU_BG,
        border: 'none',
        borderRadius: 10,
        boxShadow: active ? 'var(--neu-shadow-inset)' : 'var(--neu-shadow-raised)',
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: active ? '#4F46E5' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        transition: 'box-shadow 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{ width: 1, height: 16, background: 'var(--divider-color)', margin: '0 2px', flexShrink: 0 }} />
  )
}

const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </svg>
)

const IconRedo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 14 20 9 15 4" />
    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
  </svg>
)

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView, getZoom, getNodes } = useReactFlow()
  const [zoom, setZoom] = useState<number | null>(null)
  const [showAlign, setShowAlign] = useState(false)
  const { undo, redo, showMinimap, toggleMinimap, alignNodes, distributeNodes } = useFlowStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      showMinimap: s.showMinimap,
      toggleMinimap: s.toggleMinimap,
      alignNodes: s.alignNodes,
      distributeNodes: s.distributeNodes,
    }))
  )
  const pastLength = useFlowStore((s) => s.past.length)
  const futureLength = useFlowStore((s) => s.future.length)
  const selectedCount = useFlowStore((s) => s.nodes.filter((n) => n.selected).length)

  const handleZoomIn = () => {
    zoomIn()
    setTimeout(() => setZoom(Math.round(getZoom() * 100)), 100)
  }

  const handleZoomOut = () => {
    zoomOut()
    setTimeout(() => setZoom(Math.round(getZoom() * 100)), 100)
  }

  const handleFit = () => {
    fitView({ duration: 400, padding: 0.1 })
    setTimeout(() => setZoom(Math.round(getZoom() * 100)), 500)
  }

  const handleZoomToSelection = () => {
    const sel = getNodes().filter((n) => n.selected)
    if (sel.length > 0) {
      fitView({ nodes: sel, duration: 400, padding: 0.2 })
    }
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: NEU_BG,
          borderRadius: 50,
          boxShadow: 'var(--neu-shadow-raised)',
          padding: '6px 10px',
          pointerEvents: 'auto',
          zIndex: 10,
        }}
      >
        <ZoomBtn onClick={undo} title="Undo (Ctrl+Z)" disabled={pastLength === 0}>
          <IconUndo />
        </ZoomBtn>
        <ZoomBtn onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={futureLength === 0}>
          <IconRedo />
        </ZoomBtn>

        <Divider />

        <ZoomBtn onClick={() => setShowAlign((v) => !v)} title="Align & Distribute" active={showAlign} disabled={selectedCount < 2}>
          ⊞
        </ZoomBtn>

        <ZoomBtn onClick={toggleMinimap} title={showMinimap ? 'Hide Minimap' : 'Show Minimap'} active={showMinimap}>
          ◎
        </ZoomBtn>

        <ZoomBtn onClick={handleZoomToSelection} title="Zoom to Selection (Ctrl+Shift+F)" disabled={selectedCount === 0}>
          ⌖
        </ZoomBtn>

        <Divider />

        <ZoomBtn onClick={handleZoomOut} title="Zoom out">−</ZoomBtn>

        <button
          onClick={handleFit}
          title="Fit view"
          style={{
            background: NEU_BG,
            border: 'none',
            borderRadius: 8,
            boxShadow: 'var(--neu-shadow-concave)',
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            minWidth: 44,
            textAlign: 'center',
          }}
        >
          {zoom !== null ? `${zoom}%` : 'Fit'}
        </button>

        <ZoomBtn onClick={handleZoomIn} title="Zoom in">+</ZoomBtn>
      </div>

      {showAlign && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 20,
            background: NEU_BG,
            borderRadius: 20,
            boxShadow: 'var(--neu-shadow-raised)',
            padding: '12px',
            pointerEvents: 'auto',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Align {selectedCount} nodes
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { d: 'left', l: 'L', t: 'Align Left' },
              { d: 'center', l: 'C', t: 'Align Center' },
              { d: 'right', l: 'R', t: 'Align Right' },
              { d: 'top', l: 'T', t: 'Align Top' },
              { d: 'middle', l: 'M', t: 'Align Middle' },
              { d: 'bottom', l: 'B', t: 'Align Bottom' },
            ] as const).map(({ d, l, t }) => (
              <button
                key={d}
                onClick={() => alignNodes(d)}
                title={t}
                disabled={selectedCount < 2}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: 'none',
                  background: NEU_BG,
                  boxShadow: 'var(--neu-shadow-raised)',
                  cursor: selectedCount < 2 ? 'not-allowed' : 'pointer',
                  opacity: selectedCount < 2 ? 0.4 : 1,
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => distributeNodes('horizontal')}
              title="Distribute Horizontally"
              disabled={selectedCount < 3}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: NEU_BG,
                boxShadow: 'var(--neu-shadow-raised)',
                cursor: selectedCount < 3 ? 'not-allowed' : 'pointer',
                opacity: selectedCount < 3 ? 0.4 : 1,
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Distribute ↔
            </button>
            <button
              onClick={() => distributeNodes('vertical')}
              title="Distribute Vertically"
              disabled={selectedCount < 3}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: NEU_BG,
                boxShadow: 'var(--neu-shadow-raised)',
                cursor: selectedCount < 3 ? 'not-allowed' : 'pointer',
                opacity: selectedCount < 3 ? 0.4 : 1,
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Distribute ↕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
