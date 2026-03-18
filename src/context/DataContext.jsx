import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useProject } from './ProjectContext'
import * as projectService from '../lib/projectService'

const DataContext = createContext(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

function detectColumnType(values) {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 50)
  if (sample.length === 0) return 'ignore'
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{1,2}\/\d{1,2}\/\d{2,4}/, /^\d{1,2}-\d{1,2}-\d{2,4}/, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i]
  if (sample.filter(v => { const s = String(v).trim(); return datePatterns.some(p => p.test(s)) || (!isNaN(Date.parse(s)) && s.length > 6) }).length > sample.length * 0.7) return 'date'
  if (sample.filter(v => !isNaN(typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, '')))).length > sample.length * 0.8) return 'metric'
  return 'dimension'
}

function toLabel(colName) {
  return colName.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

function buildAutoSchema(data) {
  const columns = Object.keys(data[0])
  const autoSchema = {}
  columns.forEach(col => {
    autoSchema[col] = { type: detectColumnType(data.map(row => row[col])), label: toLabel(col) }
  })
  return autoSchema
}

export function DataProvider({ children }) {
  const { activeProject, activeProjectId, addDatasetToProject, removeDatasetFromProject, selectProject } = useProject()

  const [activeDatasetId, setActiveDatasetId] = useState(null)
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem('nb_step') || 'home' } catch { return 'home' }
  })
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('nb_tab') || 'overview'
      // Migrate old tab IDs to new structure
      const tabMap = { ask: 'ai', insights: 'ai', charts: 'overview' }
      return tabMap[saved] || saved
    } catch { return 'overview' }
  })

  // Persist step and tab to localStorage
  useEffect(() => {
    try { localStorage.setItem('nb_step', step) } catch {}
  }, [step])
  useEffect(() => {
    try { localStorage.setItem('nb_tab', activeTab) } catch {}
  }, [activeTab])

  // Pending upload state
  const [pendingData, setPendingData] = useState(null)
  const [pendingFileName, setPendingFileName] = useState(null)
  const [pendingSchema, setPendingSchema] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState(null)

  // Cache for full raw data — either uploaded this session or downloaded from Storage
  const fullDataCacheRef = useRef({})

  // Tick to force datasets memo to recalculate after async download
  const [dataDownloadTick, setDataDownloadTick] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)

  // Dashboard state — local mirror, synced to Supabase
  const [localDashboardState, setLocalDashboardState] = useState({})
  const saveTimeout = useRef(null)
  const lastSavedRef = useRef(null)
  const stateRef = useRef(localDashboardState)
  const activeTabRef = useRef(activeTab)
  const datasetIdRef = useRef(null)

  // Keep refs in sync
  useEffect(() => { stateRef.current = localDashboardState }, [localDashboardState])
  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => { datasetIdRef.current = activeDatasetId }, [activeDatasetId])

  // When project ID changes, load dashboard state from Supabase.
  // Uses activeProject?.id so this ONLY fires when switching to a DIFFERENT project.
  // For same-project returns (home -> back), localDashboardState stays in memory untouched.
  // This is what was working before — filters, charts, everything persisted in memory.
  useEffect(() => {
    if (!activeProject) {
      setActiveDatasetId(null)
      return
    }
    const datasets = activeProject.datasets || []
    if (datasets.length > 0) {
      const firstDs = datasets[0]
      setActiveDatasetId(firstDs.id)
      const raw = firstDs.dashboard_states?.[0] || {}
      console.log('Loading project dashboard state — insights:', (raw.insights || []).length, 'ai_charts:', (raw.ai_charts || []).length, 'filters:', Object.keys(raw.global_filters || {}).length)
      setLocalDashboardState({
        global_filters: raw.global_filters || {},
        chartsState: raw.charts_state || {},
        reportBuilderState: raw.report_builder_state || {},
        dataTableState: raw.data_table_state || {},
        insights: raw.insights || [],
        insightsLoaded: raw.insights_loaded || false,
        recommendations: raw.recommendations || [],
        aiCharts: raw.ai_charts || [],
        customMetrics: raw.custom_metrics || [],
        chatHistory: [],
      })
      const savedTab = localStorage.getItem('nb_tab')
      if (!savedTab || savedTab === 'overview') {
        setActiveTab(raw.active_tab || 'overview')
      }
      // Only go to dashboard if we're not on home
      if (step !== 'home') setStep('dashboard')
    }
  }, [activeProject?.id])

  // Download raw data from Storage for datasets that aren't cached yet
  useEffect(() => {
    if (!activeProject?.datasets) return
    const toDownload = activeProject.datasets.filter(
      ds => ds.raw_data_path && !fullDataCacheRef.current[ds.id]
    )
    if (toDownload.length === 0) return

    setDataLoading(true)
    let mounted = true

    Promise.all(
      toDownload.map(async (ds) => {
        try {
          const { downloadRawData } = await import('../lib/projectService')
          const data = await downloadRawData(ds.raw_data_path)
          if (mounted && data.length > 0) {
            fullDataCacheRef.current[ds.id] = data
            console.log('Downloaded raw data for', ds.file_name, '→', data.length, 'rows')
          }
        } catch (err) {
          console.error('Failed to download raw data for', ds.file_name, ':', err.message)
        }
      })
    ).then(() => {
      if (mounted) {
        setDataDownloadTick(t => t + 1) // Trigger datasets memo recalc
        setDataLoading(false)
      }
    })

    return () => { mounted = false }
  }, [activeProject?.id])

  // Datasets from project — normalize keys to camelCase for components
  // Priority: in-memory cache (uploaded/downloaded this session) → DB raw_data → empty
  const datasets = useMemo(() => {
    if (!activeProject?.datasets) return []
    return activeProject.datasets.map(ds => {
      const raw = ds.dashboard_states?.[0] || {}
      const rawData = fullDataCacheRef.current[ds.id] || ds.raw_data || []
      return {
        id: ds.id,
        rawData,
        rawDataPath: ds.raw_data_path || null,
        fileName: ds.file_name,
        schema: ds.schema_def || {},
        rowCount: ds.row_count || rawData.length,
        reportBuilderState: raw.report_builder_state || {},
        dataTableState: raw.data_table_state || {},
        chartsState: raw.charts_state || {},
        chatHistory: [],
        insights: raw.insights || [],
        insightsLoaded: raw.insights_loaded || false,
        recommendations: raw.recommendations || [],
        aiCharts: raw.ai_charts || [],
        customMetrics: raw.custom_metrics || [],
        globalFilters: raw.global_filters || {},
      }
    })
  }, [activeProject, dataDownloadTick])

  const activeDataset = useMemo(() => {
    if (pendingData && pendingSchema) {
      return {
        id: '__pending__', rawData: pendingData, fileName: pendingFileName,
        schema: pendingSchema, rowCount: pendingData.length,
        reportBuilderState: {}, dataTableState: {}, chartsState: {},
        chatHistory: [], insights: [], insightsLoaded: false, aiCharts: [], customMetrics: [], globalFilters: {},
      }
    }
    return datasets.find(d => d.id === activeDatasetId) || null
  }, [datasets, activeDatasetId, pendingData, pendingSchema, pendingFileName])

  const baseRawData = activeDataset?.rawData || null
  const fileName = activeDataset?.fileName || null
  const baseSchema = activeDataset?.schema || null

  // Custom metrics — computed columns that appear everywhere
  const customMetrics = localDashboardState.customMetrics || []

  // Safe formula evaluator — supports column references, +, -, *, /, parentheses, numbers
  function evaluateFormula(formula, row, schemaRef) {
    if (!formula) return 0
    try {
      // Replace column names with their numeric values (longest first to avoid partial matches)
      const metricCols = Object.entries(schemaRef)
        .filter(([, def]) => def.type === 'metric' && !def.isCustom)
        .sort((a, b) => b[0].length - a[0].length)

      let expr = formula
      metricCols.forEach(([col]) => {
        const val = parseFloat(String(row[col] ?? 0).replace(/[,$%]/g, '')) || 0
        // Use word boundary matching to avoid partial replacements
        expr = expr.replaceAll(col, String(val))
      })

      // Validate: only allow numbers, operators, parentheses, spaces, dots
      if (!/^[\d\s+\-*/().]+$/.test(expr)) return 0

      // Evaluate safely using Function constructor (no access to globals)
      const result = new Function(`"use strict"; return (${expr})`)()
      return isFinite(result) ? result : 0
    } catch {
      return 0
    }
  }

  // Enhanced schema: base schema + custom metric columns (purple-styled)
  const schema = useMemo(() => {
    if (!baseSchema) return null
    if (customMetrics.length === 0) return baseSchema
    const enhanced = { ...baseSchema }
    customMetrics.forEach((cm, i) => {
      const colKey = `_custom_${i}_${cm.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      enhanced[colKey] = {
        type: 'metric',
        label: cm.name,
        isCustom: true,
        formula: cm,
      }
    })
    return enhanced
  }, [baseSchema, customMetrics])

  // Enhanced rawData: base data + computed custom metric values per row
  const rawData = useMemo(() => {
    if (!baseRawData) return null
    if (customMetrics.length === 0 || !baseSchema) return baseRawData
    return baseRawData.map(row => {
      const enhanced = { ...row }
      customMetrics.forEach((cm, i) => {
        const colKey = `_custom_${i}_${cm.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
        enhanced[colKey] = evaluateFormula(cm.formula, row, baseSchema)
      })
      return enhanced
    })
  }, [baseRawData, baseSchema, customMetrics])

  const globalFilters = localDashboardState.global_filters || {}
  const setGlobalFilters = useCallback((valOrFn) => {
    setLocalDashboardState(prev => {
      const newFilters = typeof valOrFn === 'function' ? valOrFn(prev.global_filters || {}) : valOrFn
      return { ...prev, global_filters: newFilters }
    })
  }, [])
  const hasGlobalFilters = Object.values(globalFilters).some(v => v && v.length > 0)

  const filteredRawData = useMemo(() => {
    if (!rawData) return rawData
    const activeFilters = Object.entries(globalFilters).filter(([, vals]) => vals && vals.length > 0)
    if (activeFilters.length === 0) return rawData
    return rawData.filter(row => activeFilters.every(([col, vals]) => vals.includes(String(row[col]))))
  }, [rawData, globalFilters])

  const columnsByType = useMemo(() => {
    if (!schema) return { dimensions: [], metrics: [], dates: [], ignored: [] }
    const result = { dimensions: [], metrics: [], dates: [], ignored: [] }
    Object.entries(schema).forEach(([col, def]) => {
      if (def.type === 'dimension') result.dimensions.push(col)
      else if (def.type === 'metric') result.metrics.push(col)
      else if (def.type === 'date') result.dates.push(col)
      else result.ignored.push(col)
    })
    return result
  }, [schema])

  const rowCount = rawData ? rawData.length : 0
  const filteredRowCount = filteredRawData ? filteredRawData.length : 0

  const [schemaLoading, setSchemaLoading] = useState(false)

  const loadData = useCallback(async (data, name) => {
    if (!data || data.length === 0) return
    setPendingData(data)
    setPendingFileName(name)
    // Use basic heuristic first for instant feedback
    setPendingSchema(buildAutoSchema(data))
    setStep('tag')

    // Then run AI tagging in background for better accuracy
    setSchemaLoading(true)
    try {
      const columns = Object.keys(data[0])
      const samples = {}
      columns.forEach(col => {
        samples[col] = data.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '').slice(0, 8)
      })

      const colList = columns.map(col => `- "${col}": ${samples[col].slice(0, 5).map(v => JSON.stringify(v)).join(', ')}`).join('\n')

      const system = `You are a data classification expert. The user uploaded a dataset. For each column, determine:
1. type: "dimension" (text/categories for grouping — names, regions, ranges like "20-30%", IDs, labels), "metric" (numeric values you would SUM or AVERAGE — revenue, counts, amounts, rates as raw numbers), "date" (dates/timestamps), or "ignore" (irrelevant columns like row IDs)
2. label: A clean, human-readable display name

CRITICAL RULES:
- Columns with ranges like "20-30%", "25-34", "100-200" are DIMENSIONS not metrics — they are categories
- Columns with names/text that happen to contain numbers (IDs, codes, zip codes) are DIMENSIONS
- Only classify as "metric" if the values are actual numbers that make sense to sum or average
- Column names like "age" with categorical values (age ranges) should be DIMENSION
- Column names like "amount", "total", "count", "revenue", "cost", "price" with raw numbers should be METRIC

Respond with ONLY a JSON object (no markdown, no backticks) mapping column names to {type, label}:
{"column_name": {"type": "dimension", "label": "Column Name"}, ...}`

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          messages: [{ role: 'user', content: `Classify these columns:\n${colList}` }],
          max_tokens: 1500,
          model: 'claude-sonnet-4-6',
        }),
      })

      if (res.ok) {
        const result = await res.json()
        const text = result.content?.map(c => c.text || '').join('') || ''
        const aiSchema = JSON.parse(text.replace(/```json|```/g, '').trim())

        // Validate and merge — only update if AI returned valid types for all columns
        const validTypes = ['dimension', 'metric', 'date', 'ignore']
        const isValid = columns.every(col => aiSchema[col] && validTypes.includes(aiSchema[col].type))

        if (isValid) {
          setPendingSchema(prev => {
            if (!prev) return prev
            const updated = {}
            columns.forEach(col => {
              updated[col] = {
                type: aiSchema[col]?.type || prev[col]?.type || 'dimension',
                label: aiSchema[col]?.label || prev[col]?.label || col,
              }
            })
            return updated
          })
          console.log('AI schema tagging complete')
        }
      }
    } catch (err) {
      console.log('AI tagging failed, using basic heuristic:', err.message)
    } finally {
      setSchemaLoading(false)
    }
  }, [])

  const cancelTagging = useCallback(() => {
    setPendingData(null); setPendingFileName(null); setPendingSchema(null)
    if (datasets.length > 0) { setActiveDatasetId(datasets[0].id); setStep('dashboard') }
    else setStep('home')
  }, [datasets])

  const confirmTagging = useCallback(async () => {
    if (!pendingData || !pendingSchema || !activeProjectId) return
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const dataset = await addDatasetToProject({
        fileName: pendingFileName, schemaDef: pendingSchema,
        rowCount: pendingData.length, rawData: pendingData,
      })
      // Cache full data in memory (Storage has the file, DB has metadata only)
      fullDataCacheRef.current[dataset.id] = pendingData
      setPendingData(null); setPendingFileName(null); setPendingSchema(null)
      setActiveDatasetId(dataset.id)
      setDataDownloadTick(t => t + 1) // Force datasets memo recalc
      setLocalDashboardState({})
      setActiveTab('overview')
      setStep('dashboard')
    } catch (err) {
      console.error('Failed to save dataset:', err)
      setConfirmError(err.message || 'Failed to build dashboard. Please try again.')
    } finally {
      setConfirmLoading(false)
    }
  }, [pendingData, pendingSchema, pendingFileName, activeProjectId, addDatasetToProject])

  const switchDataset = useCallback((id) => {
    setActiveDatasetId(id)
    const ds = datasets.find(d => d.id === id)
    if (ds) {
      setLocalDashboardState({
        global_filters: ds.globalFilters || {},
        chartsState: ds.chartsState || {},
        reportBuilderState: ds.reportBuilderState || {},
        dataTableState: ds.dataTableState || {},
        insights: ds.insights || [],
        insightsLoaded: ds.insightsLoaded || false,
        recommendations: ds.recommendations || [],
        aiCharts: ds.aiCharts || [],
        customMetrics: ds.customMetrics || [],
        chatHistory: ds.chatHistory || [],
      })
    }
    setStep('dashboard')
  }, [datasets])

  const removeDataset = useCallback(async (id) => {
    try {
      await removeDatasetFromProject(id)
      if (activeDatasetId === id) {
        const remaining = datasets.filter(d => d.id !== id)
        if (remaining.length > 0) { setActiveDatasetId(remaining[0].id); setStep('dashboard') }
        else { setActiveDatasetId(null); setStep('home') }
      }
    } catch (err) { console.error('Failed to remove dataset:', err) }
  }, [activeDatasetId, datasets, removeDatasetFromProject])

  const updateColumnSchema = useCallback((colName, updates) => {
    if (pendingSchema) setPendingSchema(prev => ({ ...prev, [colName]: { ...prev[colName], ...updates } }))
  }, [pendingSchema])

  const removeColumn = useCallback((colName) => {
    if (pendingSchema) setPendingSchema(prev => { const s = { ...prev }; delete s[colName]; return s })
  }, [pendingSchema])

  const updateDatasetState = useCallback((key, value) => {
    setLocalDashboardState(prev => {
      const newVal = typeof value === 'function' ? value(prev[key]) : value
      return { ...prev, [key]: newVal }
    })
  }, [])

  // Debounced save — map camelCase back to snake_case for Supabase
  useEffect(() => {
    if (!activeDatasetId || activeDatasetId === '__pending__') return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(async () => {
      // Use ref for dataset ID to avoid stale closure during project switches
      const dsId = datasetIdRef.current
      if (!dsId || dsId === '__pending__') return

      const stateToSave = {
        active_tab: activeTabRef.current,
        global_filters: localDashboardState.global_filters || {},
        charts_state: localDashboardState.chartsState || {},
        report_builder_state: localDashboardState.reportBuilderState || {},
        data_table_state: localDashboardState.dataTableState || {},
        ai_charts: localDashboardState.aiCharts || [],
        custom_metrics: localDashboardState.customMetrics || [],
        recommendations: localDashboardState.recommendations || [],
        // DO NOT include insights — saved separately via saveInsightsOnly
      }

      const stateStr = JSON.stringify(stateToSave)
      if (stateStr === lastSavedRef.current) return
      lastSavedRef.current = stateStr

      console.log('Debounced save for dataset:', dsId, 'filters:', Object.keys(localDashboardState.global_filters || {}).length, 'ai_charts:', (localDashboardState.aiCharts || []).length)

      try {
        await projectService.saveDashboardState(dsId, stateToSave)
      } catch (err) {
        console.error('Failed to save dashboard state:', err)
      }
    }, 1500)

    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [localDashboardState, activeDatasetId, activeTab])

  const aggregate = useCallback((dimensions, metrics, filters = {}, useFiltered = true) => {
    const data = useFiltered ? filteredRawData : rawData
    if (!data || !schema) return []
    let d = data
    Object.entries(filters).forEach(([col, val]) => {
      if (Array.isArray(val) && val.length > 0) d = d.filter(row => val.includes(String(row[col])))
      else if (val && val !== '__all__') d = d.filter(row => String(row[col]) === String(val))
    })

    // Identify custom metrics that need special aggregation (ratio or average)
    const customAggMap = {}
    ;(localDashboardState.customMetrics || []).forEach((cm, i) => {
      const colKey = `_custom_${i}_${cm.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      if (cm.aggregation === 'ratio' || cm.aggregation === 'average') {
        customAggMap[colKey] = { aggregation: cm.aggregation, formula: cm.formula, suffix: cm.suffix || '' }
      }
    })

    // Helper: compute aggregated value for a custom metric on a set of rows
    function computeCustomAgg(colKey, rows) {
      const info = customAggMap[colKey]
      if (!info) return null // not a special agg — use default sum

      if (info.aggregation === 'average') {
        const vals = rows.map(row => parseFloat(String(row[colKey] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      }

      if (info.aggregation === 'ratio') {
        const parts = info.formula.split('/')
        if (parts.length !== 2) {
          const vals = rows.map(row => parseFloat(String(row[colKey] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        }

        const evalExpr = (expr, rows) => {
          const trimmed = expr.trim().replace(/[()]/g, '')
          const metricCols = Object.entries(baseSchema || {})
            .filter(([, def]) => def.type === 'metric' && !def.isCustom)
            .sort((a, b) => b[0].length - a[0].length)

          let evalStr = trimmed
          metricCols.forEach(([col]) => {
            if (evalStr.includes(col)) {
              const colSum = rows.reduce((sum, row) => {
                const v = parseFloat(String(row[col] ?? 0).replace(/[,$%]/g, ''))
                return sum + (isNaN(v) ? 0 : v)
              }, 0)
              evalStr = evalStr.replaceAll(col, String(colSum))
            }
          })

          // Evaluate the expression safely
          if (!/^[\d\s+\-*.()]+$/.test(evalStr)) return 0
          try {
            const result = new Function(`"use strict"; return (${evalStr})`)()
            return isFinite(result) ? result : 0
          } catch { return 0 }
        }

        const numerator = evalExpr(parts[0], rows)
        const denominator = evalExpr(parts[1], rows)
        const ratio = denominator !== 0 ? numerator / denominator : 0
        // If suffix is %, multiply by 100 for display (0.70 → 70%)
        return info.suffix === '%' ? ratio * 100 : ratio
      }

      return null
    }

    if (dimensions.length === 0) {
      const totals = {}
      metrics.forEach(m => {
        const customResult = computeCustomAgg(m, d)
        if (customResult !== null) {
          totals[m] = customResult
        } else {
          totals[m] = d.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0)
        }
      })
      return [totals]
    }
    const groups = {}
    d.forEach(row => {
      const key = dimensions.map(dim => String(row[dim] ?? '(empty)')).join('|||')
      if (!groups[key]) { groups[key] = { _rows: [] }; dimensions.forEach(dim => { groups[key][dim] = row[dim] ?? '(empty)' }) }
      groups[key]._rows.push(row)
    })
    return Object.values(groups).map(group => {
      const result = {}; dimensions.forEach(dim => { result[dim] = group[dim] })
      metrics.forEach(m => {
        const customResult = computeCustomAgg(m, group._rows)
        if (customResult !== null) {
          result[m] = customResult
        } else {
          result[m] = group._rows.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0)
        }
      })
      return result
    })
  }, [filteredRawData, rawData, schema, baseSchema, localDashboardState.customMetrics])

  const aggregateUnfiltered = useCallback((dimensions, metrics, filters = {}) => aggregate(dimensions, metrics, filters, false), [aggregate])

  const getUniqueValues = useCallback((colName) => {
    if (!rawData) return []
    return [...new Set(rawData.map(row => row[colName]).filter(v => v !== null && v !== undefined && v !== ''))].sort()
  }, [rawData])

  // Immediate save — reads from refs so it always gets latest state
  const flushSave = useCallback(async () => {
    const dsId = datasetIdRef.current
    if (!dsId || dsId === '__pending__') return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    const st = stateRef.current
    const stateToSave = {
      active_tab: activeTabRef.current,
      global_filters: st.global_filters || {},
      charts_state: st.chartsState || {},
      report_builder_state: st.reportBuilderState || {},
      data_table_state: st.dataTableState || {},
      ai_charts: st.aiCharts || [],
      custom_metrics: st.customMetrics || [],
      recommendations: st.recommendations || [],
      // DO NOT include insights — saved separately via saveInsightsOnly
    }

    try {
      await projectService.saveDashboardState(dsId, stateToSave)
      lastSavedRef.current = JSON.stringify(stateToSave)
      console.log('Flush save for dataset:', dsId, 'filters:', Object.keys(st.global_filters || {}).length, 'ai_charts:', (st.aiCharts || []).length)
    } catch (err) {
      console.error('Failed to flush save:', err)
    }
  }, [])  // No dependencies — reads from refs

  const clearAll = useCallback(() => {
    setPendingData(null); setPendingFileName(null); setPendingSchema(null)
    setActiveDatasetId(null); setStep('home'); setActiveTab('overview')
    setLocalDashboardState({})
    try { localStorage.removeItem('nb_step'); localStorage.removeItem('nb_tab') } catch {}
  }, [])

  const goHome = useCallback(async () => {
    await flushSave()
    setStep('home')
  }, [flushSave])

  const openProject = useCallback(() => { setStep('dashboard') }, [])

  return <DataContext.Provider value={{
    rawData, filteredRawData, fileName, schema, step, setStep, activeTab, setActiveTab,
    globalFilters, setGlobalFilters, hasGlobalFilters,
    loadData, cancelTagging, confirmTagging, updateColumnSchema, removeColumn, columnsByType, schemaLoading,
    confirmLoading, confirmError, dataLoading,
    aggregate, aggregateUnfiltered, getUniqueValues, rowCount, filteredRowCount,
    datasets, activeDatasetId, activeDataset, switchDataset, removeDataset, updateDatasetState,
    clearAll, goHome, openProject, flushSave,
    chartsState: localDashboardState.chartsState || {},
    reportBuilderState: localDashboardState.reportBuilderState || {},
    dataTableState: localDashboardState.dataTableState || {},
    aiCharts: localDashboardState.aiCharts || [],
    localCustomMetrics: localDashboardState.customMetrics || [],
    insights: localDashboardState.insights || [],
    insightsLoaded: localDashboardState.insightsLoaded || false,
    recommendations: localDashboardState.recommendations || [],
    chatHistory: localDashboardState.chatHistory || [],
  }}>{children}</DataContext.Provider>
}
