import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical, X } from 'lucide-react'
import { useData } from '../context/DataContext'

/**
 * Reorderable widget grid. Each child needs:
 *   data-widget-id="unique-id"     — unique identifier
 *   data-widget-size="small"       — 1-col span (KPI card)  
 *   data-widget-size="medium"      — 3-col span (half width chart)
 *   data-widget-size="large"       — 6-col span (full width, default)
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

  // widgetOrder can be an array (legacy) or { order: [...], hidden: [...] }
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
  const [hoverId, setHoverId] = useState(null)
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

  const onDragStart = useCallback((e, id) => {
    setDragId(id)
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const onDragEnd = useCallback(() => {
    setDragId(null)
    setHoverId(null)
    setDropEnd(false)
    dragRef.current = null
  }, [])

  const onDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropEnd(false)
    if (id !== dragRef.current) setHoverId(id)
  }, [])

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = dragRef.current
    if (!sourceId || sourceId === targetId) { setHoverId(null); return }
    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      const ti = n.indexOf(targetId)
      if (si === -1 || ti === -1) return prev
      n.splice(si, 1)
      n.splice(ti, 0, sourceId)
      try { 
        const hidden = Array.isArray(widgetOrder) ? [] : (widgetOrder?.hidden || [])
        updateDatasetState(storageKey, { order: n, hidden }) 
      } catch {}
      return n
    })
    setHoverId(null)
  }, [storageKey, updateDatasetState, widgetOrder])

  // Container-level drag over — for empty space / end of grid
  const onContainerDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Check if we're over a widget or in empty space
    const target = e.target.closest('[data-dw]')
    if (!target) {
      setHoverId(null)
      setDropEnd(true)
    }
  }, [])

  // Container-level drop — move to end
  const onContainerDrop = useCallback((e) => {
    e.preventDefault()
    const sourceId = dragRef.current
    if (!sourceId) return
    // Only handle if not caught by a widget's own onDrop
    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      if (si === -1) return prev
      n.splice(si, 1)
      n.push(sourceId)
      try {
        const hidden = Array.isArray(widgetOrder) ? [] : (widgetOrder?.hidden || [])
        updateDatasetState(storageKey, { order: n, hidden })
      } catch {}
      return n
    })
    setHoverId(null)
    setDropEnd(false)
  }, [storageKey, updateDatasetState, widgetOrder])

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 md:grid-cols-6 gap-3"
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      style={{ minHeight: dragId ? '100px' : undefined }}
    >
      {order.map(id => {
        const child = childMap[id]
        if (!child) return null
        const size = child.props?.['data-widget-size'] || 'large'
        const spanClass = SIZE_MAP[size] || SIZE_MAP.large
        const isDragging = dragId === id
        const isHover = hoverId === id
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
              opacity: isDragging ? 0.3 : 1,
              cursor: 'grab',
              borderRadius: '12px',
              outline: isHover ? '2px dashed var(--accent)' : '2px dashed transparent',
              outlineOffset: '2px',
              transition: 'opacity 0.15s, outline 0.15s',
            }}
          >
            <div className="absolute -left-0.5 top-1 z-10 p-0.5 rounded opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
              <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            </div>
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
      {/* Drop zone at end of grid — visible when dragging over empty space */}
      {dragId && (
        <div
          data-dw="__drop-end__"
          className="col-span-1 md:col-span-6 flex items-center justify-center rounded-xl transition-all"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropEnd(true); setHoverId(null) }}
          onDragLeave={() => setDropEnd(false)}
          onDrop={(e) => { e.stopPropagation(); onContainerDrop(e) }}
          style={{
            minHeight: '48px',
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
