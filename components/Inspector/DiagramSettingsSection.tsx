'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFlowStore, type Direction, type Theme, type CurveStyle, type BgVariant } from '@/lib/store'
import { applyDagreLayout } from '@/lib/layout'
import { DIRECTIONS, THEMES, CURVE_STYLES } from '@/components/ShapeIcons'

const NEU_BG = 'var(--neu-bg)'

function NeuBtn({
  onClick,
  active,
  children,
  title,
}: {
  onClick?: () => void
  active?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: NEU_BG,
        border: 'none',
        borderRadius: 8,
        boxShadow: active ? 'var(--neu-shadow-inset)' : 'var(--neu-shadow-raised)',
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 500,
        color: active ? '#4F46E5' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
    >
      {children}
    </button>
  )
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 10,
}

const subLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  marginBottom: 6,
}

const selectStyle: React.CSSProperties = {
  background: NEU_BG,
  boxShadow: 'var(--neu-shadow-concave)',
  border: 'none',
  borderRadius: 8,
  padding: '5px 8px',
  fontSize: 11,
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
  width: '100%',
}

export function DiagramSettingsSection() {
  const {
    direction, theme, look, curveStyle, setDirection, setTheme, setLook, setCurveStyle, setNodes,
    snapToGrid, snapGrid, toggleSnapToGrid, setSnapGrid,
    bgVariant, bgGap, setBgVariant, setBgGap,
  } = useFlowStore(
    useShallow((s) => ({
      direction: s.direction,
      theme: s.theme,
      look: s.look,
      curveStyle: s.curveStyle,
      setDirection: s.setDirection,
      setTheme: s.setTheme,
      setLook: s.setLook,
      setCurveStyle: s.setCurveStyle,
      setNodes: s.setNodes,
      snapToGrid: s.snapToGrid,
      snapGrid: s.snapGrid,
      toggleSnapToGrid: s.toggleSnapToGrid,
      setSnapGrid: s.setSnapGrid,
      bgVariant: s.bgVariant,
      bgGap: s.bgGap,
      setBgVariant: s.setBgVariant,
      setBgGap: s.setBgGap,
    }))
  )

  const handleDirectionChange = (dir: Direction) => {
    setDirection(dir)
    const { nodes, edges } = useFlowStore.getState()
    if (nodes.length > 0) setNodes(applyDagreLayout(nodes, edges, dir))
  }

  const bgVariants: { value: BgVariant; label: string }[] = [
    { value: 'dots', label: 'Dots' },
    { value: 'lines', label: 'Lines' },
    { value: 'cross', label: 'Cross' },
  ]

  const gridSizes = [10, 20, 40]

  return (
    <div>
      <div style={sectionLabelStyle}>Diagram Settings</div>

      <div
        style={{
          background: NEU_BG,
          borderRadius: 14,
          boxShadow: 'var(--neu-shadow-concave)',
          padding: '14px',
        }}
      >
        <div style={subLabelStyle}>Layout Direction</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {DIRECTIONS.map(({ value, label, title }) => (
            <NeuBtn key={value} onClick={() => handleDirectionChange(value)} active={direction === value} title={title}>
              {label}
            </NeuBtn>
          ))}
        </div>

        <div style={subLabelStyle}>Theme</div>
        <div style={{ marginBottom: 10 }}>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} style={selectStyle} aria-label="Theme">
            {THEMES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div style={subLabelStyle}>Curve Style</div>
        <div style={{ marginBottom: 10 }}>
          <select value={curveStyle} onChange={(e) => setCurveStyle(e.target.value as CurveStyle)} style={selectStyle} aria-label="Curve Style">
            {CURVE_STYLES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <NeuBtn
          onClick={() => setLook(look === 'handDrawn' ? 'classic' : 'handDrawn')}
          active={look === 'handDrawn'}
          title="Toggle hand-drawn look"
        >
          ✏ Hand-drawn {look === 'handDrawn' ? 'On' : 'Off'}
        </NeuBtn>

        <div style={{ marginTop: 14 }} />

        <div style={subLabelStyle}>Grid Style</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {bgVariants.map(({ value, label }) => (
            <NeuBtn key={value} onClick={() => setBgVariant(value)} active={bgVariant === value} title={label}>
              {label}
            </NeuBtn>
          ))}
        </div>

        <div style={subLabelStyle}>Grid Size</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {gridSizes.map((size) => (
            <NeuBtn key={size} onClick={() => setBgGap(size)} active={bgGap === size} title={`${size}px grid`}>
              {size}px
            </NeuBtn>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <NeuBtn onClick={toggleSnapToGrid} active={snapToGrid} title="Toggle snap to grid">
            📐 Snap
          </NeuBtn>
          {snapToGrid && (
            <div style={{ display: 'flex', gap: 4 }}>
              {gridSizes.map((size) => (
                <NeuBtn key={size} onClick={() => setSnapGrid(size)} active={snapGrid[0] === size} title={`Snap to ${size}px`}>
                  {size}
                </NeuBtn>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
