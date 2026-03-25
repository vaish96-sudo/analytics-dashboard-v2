import React, { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react'

// ─── Draggable Dashboard Grid ───────────────────────────────────
// Pure HTML5 DnD grid for reordering and resizing dashboard widgets.
// Persists layout via onLayoutChange callback.

const DEFAULT_LAYOUT = [
  { id: 'kpi', order: 0, span: 'full' },
  { id: 'ai_charts', order: 1, span: 'full' },
  { id: 'auto_charts', order: 2, span: 'full' },
]

export function useGridLayout(savedLayout) {
  const [layout, setLayout] = useState(() => {
    if (savedLayout && Array.isArray(savedLayout) && savedLayout.length > 0) {
      // Merge saved layout with defaults (in case new widgets were added)
      const savedIds = new Set(savedLayout.map(l => l.id))
      const merged = [...savedLayout]
      DEFAULT_LAYOUT.forEach(d => {
        if (!savedIds.has(d.id)) merged.push(d)
      })
      return merged.sort((a, b) => a.order - b.order)
    }
    return DEFAULT_LAYOUT
  })

  const updateLayout = useCallback((newLayout) => {
    const ordered = newLayout.map((item, i) => ({ ...item, order: i }))
    setLayout(ordered)
    return ordered
  }, [])

  return { layout, updateLayout }
}

export default function DraggableGrid({ layout, onLayoutChange, children }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const dragRef = useRef(null)

  // Build a map of id → child component
  const childMap = {}
  React.Children.forEach(children, (child) => {
    if (child && child.props && child.props['data-grid-id']) {
      childMap[child.props['data-grid-id']] = child
    }
  })

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    // Set a slight delay to allow the ghost image
    requestAnimationFrame(() => {
      if (dragRef.current) dragRef.current.style.opacity = '0.4'
    })
  }, [])

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (index !== overIndex) setOverIndex(index)
  }, [overIndex])

  const handleDrop = useCallback((e, dropIdx) => {
    e.preventDefault()
    setOverIndex(null)
    if (dragIndex === null || dragIndex === dropIdx) { setDragIndex(null); return }

    const newLayout = [...layout]
    const [removed] = newLayout.splice(dragIndex, 1)
    newLayout.splice(dropIdx, 0, removed)
    const ordered = newLayout.map((item, i) => ({ ...item, order: i }))
    onLayoutChange(ordered)
    setDragIndex(null)
  }, [dragIndex, layout, onLayoutChange])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverIndex(null)
    if (dragRef.current) dragRef.current.style.opacity = '1'
  }, [])

  const toggleSpan = useCallback((index) => {
    const newLayout = layout.map((item, i) => {
      if (i === index) {
        return { ...item, span: item.span === 'full' ? 'half' : 'full' }
      }
      return item
    })
    onLayoutChange(newLayout)
  }, [layout, onLayoutChange])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {layout.map((item, index) => {
        const child = childMap[item.id]
        if (!child) return null

        const isFullSpan = item.span === 'full'
        const isDragging = dragIndex === index
        const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index

        return (
          <div
            key={item.id}
            className={`relative group transition-all duration-200 ${isFullSpan ? 'lg:col-span-2' : 'lg:col-span-1'} ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'ring-2 ring-offset-2 rounded-xl' : ''}`}
            style={isDropTarget ? { ringColor: 'var(--accent)' } : {}}
            ref={isDragging ? dragRef : null}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle + resize controls */}
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ marginTop: '-2px' }}>
              <div className="flex items-center gap-0.5 px-2 py-1 rounded-b-lg shadow-sm cursor-grab active:cursor-grabbing"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderTop: 'none' }}>
                <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>Drag</span>
              </div>
              <button onClick={() => toggleSpan(index)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-b-lg shadow-sm transition-colors"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderTop: 'none', color: 'var(--text-muted)' }}
                title={isFullSpan ? 'Half width' : 'Full width'}>
                {isFullSpan ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span className="text-[9px] font-medium">{isFullSpan ? '½' : 'Full'}</span>
              </button>
            </div>

            {/* Drop indicator bar */}
            {isDropTarget && (
              <div className="absolute inset-x-0 -top-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
            )}

            {child}
          </div>
        )
      })}
    </div>
  )
}
