'use client'

import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from '@/components/Canvas'
import { TopToolbar } from '@/components/TopToolbar'
import { ZoomControls } from '@/components/ZoomControls'
import { InspectorPanel } from '@/components/Inspector/InspectorPanel'
import { CommandPalette } from '@/components/CommandPalette'
import { useFlowStore, startAutoSave, hasAutoSave, loadAutoSave, clearAutoSave } from '@/lib/store'
import { serialize } from '@/lib/serializer'

const NEU_BG = 'var(--neu-bg)'

function RestoreBanner({ onRestore, onDismiss }: { onRestore: () => void; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: NEU_BG,
        borderRadius: 50,
        boxShadow: 'var(--neu-shadow-raised)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 30,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
        Restore previous session?
      </span>
      <button
        onClick={onRestore}
        style={{
          background: '#4F46E5',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '5px 16px',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Restore
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: 'none',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}

function EditorContent() {
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showRestore, setShowRestore] = useState(false)

  const { nodes, edges, direction, theme, look, curveStyle, loadDiagram } = useFlowStore()

  useEffect(() => {
    const unsub = startAutoSave()
    if (hasAutoSave()) {
      requestAnimationFrame(() => setShowRestore(true))
    }
    return unsub
  }, [])

  const handleRestore = () => {
    const data = loadAutoSave()
    if (data && data.nodes && data.edges) {
      loadDiagram(data.nodes, data.edges)
    }
    setShowRestore(false)
    clearAutoSave()
  }

  const handleDismiss = () => {
    setShowRestore(false)
    clearAutoSave()
  }

  const syntax = serialize(nodes, edges, { direction, theme, look, curveStyle })

  return (
    <div
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        background: NEU_BG,
      }}
    >
      <div style={{ position: 'relative', flex: 1, background: NEU_BG }}>
        <Canvas onOpenPalette={() => setPaletteOpen(true)} />

        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <TopToolbar
            inspectorOpen={inspectorOpen}
            onToggleInspector={() => setInspectorOpen((v) => !v)}
            onOpenPalette={() => setPaletteOpen(true)}
            syntax={syntax}
          />
        </div>

        <ZoomControls />

        {showRestore && (
          <RestoreBanner onRestore={handleRestore} onDismiss={handleDismiss} />
        )}
      </div>

      {inspectorOpen && (
        <InspectorPanel
          syntax={syntax}
          onCollapse={() => setInspectorOpen(false)}
        />
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

export default function Page() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  )
}
