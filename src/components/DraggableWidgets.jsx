import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react'
import { useData } from '../context/DataContext'

/**
 * Reorderable + resizable widget grid.
 *
 * Each child declares a default size via data-widget-size:
 *   "small"  → 1-col (KPI card)
 *   "medium" → 3-col (half width chart)
 *   "large"  → 6-col (full width)
 *
 * Users can toggle any widget between medium ↔ large via a hover button.
 * Small widgets (KPI cards) toggle between small ↔ medium.
 *
 * Persisted state shape: { order: [...], hidden: [...], sizes: { id: size } }
 */
const SIZE_MAP = {
  small: 'col-span-1',
  medium: 'col-span-1 md:col-span-3',
  large: 'col-span-1 md:col-span-6',
}

const COL_SPAN = { small: 1, medium: 3, large: 6 }
const TOTAL_COLS = 6

export default function DraggableWidgets({ children, storageKey = 'widget_order', onHide }) {
  const { widgetOrder, updateDatasetState } = useData()
  const childArray = React.Children.toArray(children).filter(Boolean)
  const defaultOrder = childArray.map((c, i) => c.props?.['data-widget-id'] || `w-${i}`)

  const savedState = Array.isArray(widgetOrder) ? { order: widgetOrder } : (widgetOrder || {})
  const savedOrder = savedState.order
  const savedSizes = savedState.sizes || {}

  const [order, setOrder] = useState(() => {
    if (savedOrder && Array.isArray(savedOrder)) {
      const valid = savedOrder.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      return [...valid, ...missing]
    }
    return defaultOrder
  })

  const [sizeOverrides, setSizeOverrides] = useState(savedSizes)
  const [dragId, setDragId] = useState(null)
  const [dropIndicator, setDropIndicator] = useState(null)
  const [dropEnd, setDropEnd] = useState(false)
  const [ghostHighlight, setGhostHighlight] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    setOrder(prev => {
      const valid = prev.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      if (missing.length === 0 && valid.length === defaultOrder.length) return prev
      return [...valid, ...missing]
    })
  }, [defaultOrder.join(',')])

  const childMap = {}
  childArray.forEach((c, i) => {
    const id = c.props?.['data-widget-id'] || `w-${i}`
    childMap[id] = c
  })

  // Get effective size for a widget (override or default)
  const getSize = useCallback((id) => {
    if (sizeOverrides[id]) return sizeOverrides[id]
    const child = childMap[id]
    return child?.props?.['data-widget-size'] || 'large'
  }, [sizeOverrides, childMap])

  const persist = useCallback((newOrder, newSizes) => {
    try {
      const hidden = savedState.hidden || []
      updateDatasetState(storageKey, { order: newOrder || order, hidden, sizes: newSizes || sizeOverrides })
    } catch {}
  }, [storageKey, updateDatasetState, savedState, order, sizeOverrides])

  // Toggle widget size
  const toggleSize = useCallback((id) => {
    const currentSize = getSize(id)
    let newSize
    if (currentSize === 'small') {
      newSize = 'medium'
    } else if (currentSize === 'medium') {
      newSize = 'large'
    } else {
      // large → medium
      newSize = 'medium'
    }
    const newSizes = { ...sizeOverrides, [id]: newSize }
    setSizeOverrides(newSizes)
    persist(null, newSizes)
  }, [getSize, sizeOverrides, persist])

  const onDragStart = useCallback((e, id) => {
    setDragId(id)
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const onDragEnd = useCallback(() => {
    setDragId(null)
    setDropIndicator(null)
    setDropEnd(false)
    setGhostHighlight(null)
    dragRef.current = null
  }, [])

  const onDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropEnd(false)
    setGhostHighlight(null)
    if (id === dragRef.current) { setDropIndicator(null); return }

    const rect = e.currentTarget.getBoundingClientRect()
    const size = getSize(id)
    let position
    if (size === 'large') {
      position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    } else {
      position = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    }
    setDropIndicator({ targetId: id, position })
  }, [getSize])

  const doReorder = useCallback((targetId, position) => {
    const sourceId = dragRef.current
    if (!sourceId || sourceId === targetId) { setDropIndicator(null); return }

    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      if (si === -1) return prev
      n.splice(si, 1)
      let ti = n.indexOf(targetId)
      if (ti === -1) { n.push(sourceId); persist(n, null); return n }
      if (position === 'after') ti += 1
      n.splice(ti, 0, sourceId)
      persist(n, null)
      return n
    })
    setDropIndicator(null)
    setGhostHighlight(null)
  }, [persist])

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault()
    e.stopPropagation()
    doReorder(targetId, dropIndicator?.position || 'before')
  }, [dropIndicator, doReorder])

  const onContainerDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!e.target.closest('[data-dw]')) {
      setDropIndicator(null)
      setGhostHighlight(null)
      setDropEnd(true)
    }
  }, [])

  const onContainerDrop = useCallback((e) => {
    e.preventDefault()
    const sourceId = dragRef.current
    if (!sourceId) return
    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      if (si === -1) return prev
      n.splice(si, 1)
      n.push(sourceId)
      persist(n, null)
      return n
    })
    setDropIndicator(null)
    setDropEnd(false)
    setGhostHighlight(null)
  }, [persist])

  // Build render items
  const visibleOrder = order.filter(id => childMap[id])
  const renderItems = []
  let colsUsed = 0

  visibleOrder.forEach((id) => {
    const child = childMap[id]
    if (!child) return
    const size = getSize(id)
    const span = COL_SPAN[size] || TOTAL_COLS
    const spanClass = SIZE_MAP[size] || SIZE_MAP.large
    const isDragging = dragId === id
    const showBefore = dropIndicator?.targetId === id && dropIndicator?.position === 'before' && dragId
    const showAfter = dropIndicator?.targetId === id && dropIndicator?.position === 'after' && dragId
    const isHorizontal = size === 'large'

    if (colsUsed + span > TOTAL_COLS) colsUsed = 0

    // Size toggle label
    const nextSizeLabel = size === 'large' ? '½' : size === 'medium' ? 'Full' : '½'
    const nextSizeTitle = size === 'large' ? 'Half width' : size === 'medium' ? 'Full width' : 'Half width'
    const SizeIcon = size === 'large' ? Minimize2 : Maximize2

    renderItems.push(
      <div
        key={id}
        data-dw={id}
        draggable
        onDragStart={(e) => onDragStart(e, id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, id)}
        onDrop={(e) => onDrop(e, id)}
        className={`relative group ${spanClass}`}
        style={{
          opacity: isDragging ? 0.25 : 1,
          cursor: 'grab',
          borderRadius: '12px',
          transition: 'opacity 0.15s',
        }}
      >
        {/* Drop indicators */}
        {showBefore && (
          isHorizontal
            ? <div className="absolute -top-1.5 inset-x-0 h-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
            : <div className="absolute -left-1.5 inset-y-0 w-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
        )}
        {showAfter && (
          isHorizontal
            ? <div className="absolute -bottom-1.5 inset-x-0 h-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
            : <div className="absolute -right-1.5 inset-y-0 w-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
        )}

        {/* Top hover controls: drag handle + resize */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-0 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ marginTop: '-1px' }}>
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-b-md shadow-sm cursor-grab active:cursor-grabbing"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderTop: 'none' }}>
            <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSize(id) }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-b-md shadow-sm transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderTop: 'none', color: 'var(--text-muted)' }}
            title={nextSizeTitle}
          >
            <SizeIcon className="w-3 h-3" />
            <span className="text-[9px] font-medium">{nextSizeLabel}</span>
          </button>
        </div>

        {/* Hide button */}
        {onHide && (
          <button onClick={(e) => { e.stopPropagation(); onHide(id) }}
            className="absolute -right-1 -top-1 z-10 p-0.5 rounded-full opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            title="Hide this widget">
            <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
        {child}
      </div>
    )

    colsUsed += span

    // Ghost placeholder for empty grid cells during drag
    if (colsUsed > 0 && colsUsed < TOTAL_COLS && dragId) {
      const remaining = TOTAL_COLS - colsUsed
      const isHighlighted = ghostHighlight === id
      renderItems.push(
        <div
          key={`ghost-${id}`}
          data-dw={`ghost-${id}`}
          className="flex items-center justify-center rounded-xl transition-all"
          style={{
            gridColumn: `span ${remaining}`,
            minHeight: '80px',
            border: isHighlighted ? '2px dashed var(--accent)' : '2px dashed transparent',
            background: isHighlighted ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
          }}
          onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            setDropEnd(false); setDropIndicator(null); setGhostHighlight(id)
          }}
          onDragLeave={() => setGhostHighlight(null)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); doReorder(id, 'after') }}
        >
          {isHighlighted && (
            <span className="text-[10px] font-medium" style={{ color: 'var(--accent)', opacity: 0.6 }}>Drop here</span>
          )}
        </div>
      )
      colsUsed = 0
    }
    if (colsUsed >= TOTAL_COLS) colsUsed = 0
  })

  // End drop zone
  if (dragId) {
    renderItems.push(
      <div
        key="__drop-end__"
        data-dw="__drop-end__"
        className="col-span-1 md:col-span-6 flex items-center justify-center rounded-xl transition-all"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropEnd(true); setDropIndicator(null); setGhostHighlight(null) }}
        onDragLeave={() => setDropEnd(false)}
        onDrop={(e) => { e.stopPropagation(); onContainerDrop(e) }}
        style={{
          minHeight: '40px',
          border: dropEnd ? '2px dashed var(--accent)' : '2px dashed var(--border-light)',
          background: dropEnd ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
        }}
      >
        <span className="text-[10px] font-medium" style={{ color: dropEnd ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.7 }}>
          Drop here to move to end
        </span>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-6 gap-3"
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      style={{ minHeight: dragId ? '60px' : undefined }}
    >
      {renderItems}
    </div>
  )
}
