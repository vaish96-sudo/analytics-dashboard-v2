import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical, X } from 'lucide-react'
import { useData } from '../context/DataContext'

/**
 * Reorderable widget grid with position-aware drop logic.
 * Each child needs:
 *   data-widget-id="unique-id"     — unique identifier
 *   data-widget-size="small"       — 1-col span (KPI card)
 *   data-widget-size="medium"      — 3-col span (half width chart)
 *   data-widget-size="large"       — 6-col span (full width, default)
 *
 * Drop logic uses cursor position relative to the target widget's center
 * to determine insert-before vs insert-after. This handles mixed-size
 * grids (side-by-side medium charts, full-width large widgets) correctly.
 */
const SIZE_MAP = {
  small: 'col-span-1',
  medium: 'col-span-1 md:col-span-3',
  large: 'col-span-1 md:col-span-6',
}

export default function DraggableWidgets({ children, storageKey = 'widget_order', onHide }) {
  const { widgetOrder, updateDatasetState } = useData()
  const childArray = React.Children.toArray(children).filter(Boolean)
  const defaultOrder = childArray.map((c, i) => c.props?.['data-widget-id'] || `w-${i}`)

  const savedOrder = Array.isArray(widgetOrder) ? widgetOrder : widgetOrder?.order
  const [order, setOrder] = useState(() => {
    if (savedOrder && Array.isArray(savedOrder)) {
      const valid = savedOrder.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      return [...valid, ...missing]
    }
    return defaultOrder
  })

  const [dragId, setDragId] = useState(null)
  // dropIndicator: { targetId, position: 'before' | 'after' }
  const [dropIndicator, setDropIndicator] = useState(null)
  const [dropEnd, setDropEnd] = useState(false)
  const dragRef = useRef(null)
  const gridRef = useRef(null)

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

  const persistOrder = useCallback((newOrder) => {
    try {
      const hidden = Array.isArray(widgetOrder) ? [] : (widgetOrder?.hidden || [])
      updateDatasetState(storageKey, { order: newOrder, hidden })
    } catch {}
  }, [storageKey, updateDatasetState, widgetOrder])

  const onDragStart = useCallback((e, id) => {
    setDragId(id)
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Slight delay so the browser captures the ghost image first
    requestAnimationFrame(() => {
      setDropEnd(false)
      setDropIndicator(null)
    })
  }, [])

  const onDragEnd = useCallback(() => {
    setDragId(null)
    setDropIndicator(null)
    setDropEnd(false)
    dragRef.current = null
  }, [])

  // Determine before/after based on cursor position relative to target center
  const onDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropEnd(false)
    if (id === dragRef.current) {
      setDropIndicator(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const child = childMap[id]
    const size = child?.props?.['data-widget-size'] || 'large'

    let position
    if (size === 'large') {
      // Full-width: top half = before, bottom half = after
      const midY = rect.top + rect.height / 2
      position = e.clientY < midY ? 'before' : 'after'
    } else {
      // Side-by-side widgets: left half = before, right half = after
      const midX = rect.left + rect.width / 2
      position = e.clientX < midX ? 'before' : 'after'
    }
    setDropIndicator({ targetId: id, position })
  }, [childMap])

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = dragRef.current
    if (!sourceId || sourceId === targetId) {
      setDropIndicator(null)
      return
    }
    const position = dropIndicator?.position || 'before'

    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      if (si === -1) return prev
      // Remove source
      n.splice(si, 1)
      // Find target in the modified array
      let ti = n.indexOf(targetId)
      if (ti === -1) return prev
      // Insert before or after target
      if (position === 'after') ti += 1
      n.splice(ti, 0, sourceId)
      persistOrder(n)
      return n
    })
    setDropIndicator(null)
  }, [dropIndicator, persistOrder])

  // Container-level: drop to end
  const onContainerDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const target = e.target.closest('[data-dw]')
    if (!target || target.dataset.dw === '__drop-end__') {
      setDropIndicator(null)
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
      persistOrder(n)
      return n
    })
    setDropIndicator(null)
    setDropEnd(false)
  }, [persistOrder])

  // Build indicator styles
  const getIndicatorStyle = (id, position) => {
    if (!dropIndicator || dropIndicator.targetId !== id || !dragId) return {}
    if (dropIndicator.position !== position) return {}
    return { visible: true }
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 md:grid-cols-6 gap-3"
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      style={{ minHeight: dragId ? '60px' : undefined }}
    >
      {order.map(id => {
        const child = childMap[id]
        if (!child) return null
        const size = child.props?.['data-widget-size'] || 'large'
        const spanClass = SIZE_MAP[size] || SIZE_MAP.large
        const isDragging = dragId === id
        const showBefore = dropIndicator?.targetId === id && dropIndicator?.position === 'before' && dragId
        const showAfter = dropIndicator?.targetId === id && dropIndicator?.position === 'after' && dragId

        // For large widgets, indicator is a horizontal line (top/bottom)
        // For small/medium, indicator is a vertical line (left/right)
        const isHorizontalIndicator = size === 'large'

        return (
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
            {/* Drop indicator: before */}
            {showBefore && (
              isHorizontalIndicator ? (
                <div className="absolute -top-1.5 inset-x-0 h-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
              ) : (
                <div className="absolute -left-1.5 inset-y-0 w-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
              )
            )}
            {/* Drop indicator: after */}
            {showAfter && (
              isHorizontalIndicator ? (
                <div className="absolute -bottom-1.5 inset-x-0 h-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
              ) : (
                <div className="absolute -right-1.5 inset-y-0 w-0.5 rounded-full z-20" style={{ background: 'var(--accent)' }} />
              )
            )}

            {/* Drag handle */}
            <div className="absolute -left-0.5 top-1 z-10 p-0.5 rounded opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
              <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
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
      })}
      {/* End drop zone */}
      {dragId && (
        <div
          data-dw="__drop-end__"
          className="col-span-1 md:col-span-6 flex items-center justify-center rounded-xl transition-all"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropEnd(true); setDropIndicator(null) }}
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
      )}
    </div>
  )
}
