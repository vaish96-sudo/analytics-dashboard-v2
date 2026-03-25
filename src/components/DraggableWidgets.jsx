import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
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

export default function DraggableWidgets({ children, storageKey = 'widget_order' }) {
  const { widgetOrder, updateDatasetState } = useData()
  const childArray = React.Children.toArray(children).filter(Boolean)
  const defaultOrder = childArray.map((c, i) => c.props?.['data-widget-id'] || `w-${i}`)

  const [order, setOrder] = useState(() => {
    if (widgetOrder && Array.isArray(widgetOrder)) {
      const valid = widgetOrder.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      return [...valid, ...missing]
    }
    return defaultOrder
  })

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
      try { updateDatasetState(storageKey, n) } catch {}
      return n
    })
    setHoverId(null)
  }, [storageKey, updateDatasetState])

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
            {child}
          </div>
        )
      })}
    </div>
  )
}
