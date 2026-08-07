'use client'

import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFlowStore } from '@/lib/store'
import { serialize } from '@/lib/serializer'
import { downloadMmd, saveDiagramJson, loadDiagramJson } from '@/lib/fileio'
import { ImportModal } from '@/components/ImportModal'

interface SettingsPopoverProps {
  onClose: () => void
}

const NEU_BG = 'var(--neu-bg)'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function NeuBtn({
  onClick,
  disabled,
  active,
  children,
  title,
  icon,
}: {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
  title?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: NEU_BG,
        border: 'none',
        borderRadius: 10,
        boxShadow: active ? 'var(--neu-shadow-inset)' : 'var(--neu-shadow-raised)',
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        color: active ? '#4F46E5' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'box-shadow 0.15s',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

export function SettingsPopover({ onClose }: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { loadDiagram, assignToSubgraph, recentFileNames, addRecentFileName, clearRecentFileNames } = useFlowStore(
    useShallow((s) => ({
      loadDiagram: s.loadDiagram,
      assignToSubgraph: s.assignToSubgraph,
      recentFileNames: s.recentFileNames,
      addRecentFileName: s.addRecentFileName,
      clearRecentFileNames: s.clearRecentFileNames,
    }))
  )

  const nodesLength = useFlowStore((s) => s.nodes.length)
  const selectedWithParent = useFlowStore(
    useShallow((s) => s.nodes.filter((n) => n.selected && !n.data.isSubgraph && n.parentId))
  )

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !importOpen) onClose() }
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose, importOpen])

  const handleLoad = async () => {
    try {
      setLoadError(null)
      const { nodes: n, edges: e } = await loadDiagramJson()
      loadDiagram(n, e)
      onClose()
    } catch (err) {
      if (err instanceof Error && err.message !== 'No file selected') {
        setLoadError('Invalid file')
        setTimeout(() => setLoadError(null), 3000)
      }
    }
  }

  const handleSave = () => {
    const { nodes, edges } = useFlowStore.getState()
    saveDiagramJson(nodes, edges)
  }

  const handleDownloadMmd = () => {
    const { nodes, edges, direction: dir, theme: t, look: l, curveStyle: c } = useFlowStore.getState()
    downloadMmd(nodes, edges, { direction: dir, theme: t, look: l, curveStyle: c })
  }

  const handleExportSvg = async () => {
    try {
      const { nodes, edges, direction: dir, theme: t, look: l, curveStyle: c } = useFlowStore.getState()
      const mermaid = (await import('mermaid')).default
      const syntax = serialize(nodes, edges, { direction: dir, theme: t, look: l, curveStyle: c })
      const { svg } = await mermaid.render(`svg-export-${Date.now()}`, syntax)
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'diagram.svg'
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore render errors */ }
  }

  const handleExportPng = async () => {
    try {
      const { toPng } = await import('html-to-image')
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement
      if (!viewport) return
      const dataUrl = await toPng(viewport, {
        backgroundColor: useFlowStore.getState().editorTheme === 'dark' ? '#1a1a2e' : '#E0E5EC',
        pixelRatio: 2,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'diagram.png'
      a.click()
    } catch { /* ignore */ }
  }

  return (
    <>
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      <div
        ref={ref}
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: NEU_BG,
          borderRadius: 20,
          boxShadow: 'var(--neu-shadow-raised)',
          padding: '20px',
          zIndex: 50,
          width: 280,
        }}
      >
        <Section title="File">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <NeuBtn onClick={handleLoad} title="Load diagram from .json" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            }>
              {loadError ? '⚠ Error' : 'Load JSON'}
            </NeuBtn>
            <NeuBtn onClick={handleSave} disabled={nodesLength === 0} title="Save as .json" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            }>Save JSON</NeuBtn>
            <NeuBtn onClick={() => setImportOpen(true)} title="Import Mermaid syntax" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }>Import .mmd</NeuBtn>
            <NeuBtn onClick={handleDownloadMmd} disabled={nodesLength === 0} title="Download .mmd" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }>Download .mmd</NeuBtn>
            <NeuBtn onClick={handleExportSvg} disabled={nodesLength === 0} title="Export as SVG" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            }>Export SVG</NeuBtn>
            <NeuBtn onClick={handleExportPng} disabled={nodesLength === 0} title="Export as PNG" icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            }>Export PNG</NeuBtn>
          </div>
        </Section>

        {recentFileNames.length > 0 && (
          <Section title="Recent Files">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentFileNames.slice(0, 5).map((name, i) => (
                <button
                  key={i}
                  onClick={() => {
                    addRecentFileName(name)
                    handleLoad()
                  }}
                  title={`Open ${name}`}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--hover-bg)' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  {name}
                </button>
              ))}
              <button
                onClick={clearRecentFileNames}
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  textAlign: 'left',
                }}
              >
                Clear recent
              </button>
            </div>
          </Section>
        )}

        {selectedWithParent.length > 0 && (
          <Section title="Objects">
            <NeuBtn
              onClick={() => assignToSubgraph(selectedWithParent.map((n) => n.id), null)}
              title="Remove selected nodes from their group"
            >
              Ungroup
            </NeuBtn>
          </Section>
        )}
      </div>
    </>
  )
}
