import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical, X, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { useData } from '../context/DataContext'

/**
 * Reorderable + resizable widget grid.
 * Whole card is draggable. Resize toggle on hover cycles sizes.
 * Reset button restores original default size.
 *
 * Persisted state: { order: [...], hidden: [...], sizes: { id: size } }
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
  const [hoverId, setHoverId] = useState(null)
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
  const defaultSizeMap = {}
  childArray.forEach((c, i) => {
    const id = c.props?.['data-widget-id'] || `w-${i}`
    childMap[id] = c
    defaultSizeMap[id] = c.props?.['data-widget-size'] || 'large'
  })

  const getSize = useCallback((id) => {
    if (sizeOverrides[id]) return sizeOverrides[id]
    return defaultSizeMap[id] || 'large'
  }, [sizeOverrides, defaultSizeMap])

  const persist = useCallback((newOrder, newSizes) => {
    try {
      const hidden = savedState.hidden || []
      updateDatasetState(storageKey, {
        order: newOrder || order,
        hidden,
        sizes: newSizes || sizeOverrides,
      })
    } catch {}
  }, [storageKey, updateDatasetState, savedState, order, sizeOverrides])

  // Cycle: medium ↔ large (only for non-small widgets)
  const toggleSize = useCallback((id) => {
    const current = getSize(id)
    const next = current === 'large' ? 'medium' : 'large'
    const newSizes = { ...sizeOverrides, [id]: next }
    setSizeOverrides(newSizes)
    persist(null, newSizes)
  }, [getSize, sizeOverrides, persist])

  // Reset to original default size
  const resetSize = useCallback((id) => {
    const newSizes = { ...sizeOverrides }
    delete newSizes[id]
    setSizeOverrides(newSizes)
    persist(null, newSizes)
  }, [sizeOverrides, persist])

  const onDragStart = useCallback((e, id) => {
    setDragId(id)
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const onDragEnd = useCallback(() => {
    setDragId(null)
    setHoverId(null)
    dragRef.current = null
  }, [])

  const onDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragRef.current) setHoverId(id)
  }, [])

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault()
    const sourceId = dragRef.current
    if (!sourceId || sourceId === targetId) { setHoverId(null); return }
    setOrder(prev => {
      const n = [...prev]
      const si = n.indexOf(sourceId)
      const ti = n.indexOf(targetId)
      if (si === -1 || ti === -1) return prev
      n.splice(si, 1)
      n.splice(ti, 0, sourceId)
      persist(n, null)
      return n
    })
    setHoverId(null)
  }, [persist])

  const sizeLabel = (size) => {
    if (size === 'small') return { icon: Maximize2, label: 'Med', title: 'Expand to half width' }
    if (size === 'medium') return { icon: Maximize2, label: 'Full', title: 'Expand to full width' }
    return { icon: Minimize2, label: 'Small', title: 'Shrink to small' }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      {order.map(id => {
        const child = childMap[id]
        if (!child) return null
        const size = getSize(id)
        const spanClass = SIZE_MAP[size] || SIZE_MAP.large
        const isDragging = dragId === id
        const isHover = hoverId === id
        const isResized = !!sizeOverrides[id]
        const { icon: SizeIcon, label: sLabel, title: sTitle } = sizeLabel(size)

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
            {/* Drag handle indicator */}
            <div className="absolute -left-0.5 top-1 z-10 p-0.5 rounded opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
              <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Top-right hover controls: resize + reset + hide */}
            <div className="absolute right-1 top-1 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Resize toggle — only for medium/large widgets, not KPI cards */}
              {defaultSizeMap[id] !== 'small' && (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleSize(id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                  title={sTitle}
                >
                  <SizeIcon className="w-3 h-3" />
                  {sLabel}
                </button>
              )}
              {/* Reset to default size */}
              {isResized && defaultSizeMap[id] !== 'small' && (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); resetSize(id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                  title="Reset to default size"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              {/* Hide */}
              {onHide && (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onHide(id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex items-center px-1 py-0.5 rounded-md transition-colors"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                  title="Hide this widget"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {child}
          </div>
        )
      })}
    </div>
  )
}
