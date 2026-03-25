import React, { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
import { useData } from '../context/DataContext'

/**
 * Wraps children in a draggable, reorderable container.
 * Each child must have a unique `key` and a `data-widget-id` attribute.
 * 
 * Usage:
 *   <DraggableWidgets>
 *     <div data-widget-id="kpis"><KPICards /></div>
 *     <div data-widget-id="ai-charts"><AIChartBuilder /></div>
 *     <div data-widget-id="auto-charts"><AutoCharts /></div>
 *   </DraggableWidgets>
 */
export default function DraggableWidgets({ children, storageKey = 'widget_order' }) {
  const { widgetOrder, updateDatasetState } = useData()
  
  // Get widget IDs from children
  const childArray = React.Children.toArray(children).filter(Boolean)
  const defaultOrder = childArray.map((c, i) => c.props?.['data-widget-id'] || `widget-${i}`)
  
  // Load saved order from dashboard state
  const savedOrder = widgetOrder
  const [order, setOrder] = useState(() => {
    if (savedOrder && Array.isArray(savedOrder)) {
      // Merge: keep saved order but add any new widgets and remove stale ones
      const valid = savedOrder.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      return [...valid, ...missing]
    }
    return defaultOrder
  })

  const [dragId, setDragId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const dragRef = useRef(null)

  // Update order when children change
  useEffect(() => {
    setOrder(prev => {
      const valid = prev.filter(id => defaultOrder.includes(id))
      const missing = defaultOrder.filter(id => !valid.includes(id))
      if (missing.length === 0 && valid.length === defaultOrder.length) return prev
      return [...valid, ...missing]
    })
  }, [defaultOrder.join(',')])

  // Build a map of widget-id → child element
  const childMap = {}
  childArray.forEach((c, i) => {
    const id = c.props?.['data-widget-id'] || `widget-${i}`
    childMap[id] = c
  })

  const handleDragStart = useCallback((e, id) => {
    setDragId(id)
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Delay to allow the browser to capture the drag image
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-drag-widget="${id}"]`)
      if (el) el.style.opacity = '0.3'
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    const el = document.querySelector(`[data-drag-widget="${dragRef.current}"]`)
    if (el) el.style.opacity = '1'
    setDragId(null)
    setHoverId(null)
    dragRef.current = null
  }, [])

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragRef.current) {
      setHoverId(id)
    }
  }, [])

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault()
    const sourceId = dragRef.current
    if (!sourceId || sourceId === targetId) { setHoverId(null); return }

    setOrder(prev => {
      const newOrder = [...prev]
      const sourceIdx = newOrder.indexOf(sourceId)
      const targetIdx = newOrder.indexOf(targetId)
      if (sourceIdx === -1 || targetIdx === -1) return prev
      // Remove source and insert at target position
      newOrder.splice(sourceIdx, 1)
      newOrder.splice(targetIdx, 0, sourceId)
      // Persist to dashboard state
      try { updateDatasetState(storageKey, newOrder) } catch {}
      return newOrder
    })
    setHoverId(null)
  }, [storageKey, updateDatasetState])

  return (
    <div className="space-y-4 lg:space-y-6">
      {order.map(id => {
        const child = childMap[id]
        if (!child) return null
        const isDragging = dragId === id
        const isHoverTarget = hoverId === id
        return (
          <div
            key={id}
            data-drag-widget={id}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            className="relative group transition-all"
            style={{
              opacity: isDragging ? 0.3 : 1,
              borderTop: isHoverTarget ? '3px solid var(--accent)' : '3px solid transparent',
              paddingTop: isHoverTarget ? '4px' : '0',
            }}
          >
            {/* Drag handle */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragEnd={handleDragEnd}
              className="absolute -left-1 top-2 z-10 p-1.5 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </div>
            {child}
          </div>
        )
      })}
    </div>
  )
}
