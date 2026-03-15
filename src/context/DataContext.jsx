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
    try { return localStorage.getItem('nb_tab') || 'overview' } catch { return 'overview' }
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

  // When project changes (or is re-fetched), load its data from Supabase
  // CRITICAL: Depend on activeProject (the object ref), not just activeProject?.id
  // This ensures that when selectProject() fetches fresh data (e.g. returning from home),
  // we always pick up the latest insights/state from DB — even for the same project.
  useEffect(() => {
    if (!activeProject) {
      setActiveDatasetId(null)
      return
    }
    const datasets = activeProject.datasets || []
    if (datasets.length > 0) {
      const firstDs = datasets[0]
      setActiveDatasetId(firstDs.id)
      // Load dashboard state from the fresh Supabase data
      const raw = firstDs.dashboard_states?.[0] || {}
      console.log('Loading project dashboard state — insights count:', (raw.insights || []).length, 'insights_loaded:', raw.insights_loaded)
      setLocalDashboardState({
        global_filters: raw.global_filters || {},
        chartsState: raw.charts_state || {},
        reportBuilderState: raw.report_builder_state || {},
        dataTableState: raw.data_table_state || {},
        insights: raw.insights || [],
        insightsLoaded: raw.insights_loaded || false,
        chatHistory: [],
      })
      const savedTab = localStorage.getItem('nb_tab')
      if (!savedTab || savedTab === 'overview') {
        setActiveTab(raw.active_tab || 'overview')
      }
      // Only go to dashboard if we're not on home
      if (step !== 'home') setStep('dashboard')
    }
  }, [activeProject])

  // Datasets from project — normalize keys to camelCase for components
  const datasets = useMemo(() => {
    if (!activeProject?.datasets) return []
    return activeProject.datasets.map(ds => {
      const raw = ds.dashboard_states?.[0] || {}
      return {
        id: ds.id,
        rawData: ds.raw_data || [],
        fileName: ds.file_name,
        schema: ds.schema_def || {},
        rowCount: ds.row_count || 0,
        reportBuilderState: raw.report_builder_state || {},
        dataTableState: raw.data_table_state || {},
        chartsState: raw.charts_state || {},
        chatHistory: [],
        insights: raw.insights || [],
        insightsLoaded: raw.insights_loaded || false,
        globalFilters: raw.global_filters || {},
      }
    })
  }, [activeProject])

  const activeDataset = useMemo(() => {
    if (pendingData && pendingSchema) {
      return {
        id: '__pending__', rawData: pendingData, fileName: pendingFileName,
        schema: pendingSchema, rowCount: pendingData.length,
        reportBuilderState: {}, dataTableState: {}, chartsState: {},
        chatHistory: [], insights: [], insightsLoaded: false, globalFilters: {},
      }
    }
    return datasets.find(d => d.id === activeDatasetId) || null
  }, [datasets, activeDatasetId, pendingData, pendingSchema, pendingFileName])

  const rawData = activeDataset?.rawData || null
  const fileName = activeDataset?.fileName || null
  const schema = activeDataset?.schema || null

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

  const loadData = useCallback((data, name) => {
    if (!data || data.length === 0) return
    setPendingData(data)
    setPendingFileName(name)
    setPendingSchema(buildAutoSchema(data))
    setStep('tag')
  }, [])

  const cancelTagging = useCallback(() => {
    setPendingData(null); setPendingFileName(null); setPendingSchema(null)
    if (datasets.length > 0) { setActiveDatasetId(datasets[0].id); setStep('dashboard') }
    else setStep('home')
  }, [datasets])

  const confirmTagging = useCallback(async () => {
    if (!pendingData || !pendingSchema || !activeProjectId) return
    try {
      const dataset = await addDatasetToProject({
        fileName: pendingFileName, schemaDef: pendingSchema,
        rowCount: pendingData.length, rawData: pendingData,
      })
      setPendingData(null); setPendingFileName(null); setPendingSchema(null)
      setActiveDatasetId(dataset.id)
      // Reset dashboard state for new dataset and open overview
      setLocalDashboardState({})
      setActiveTab('overview')
      setStep('dashboard')
    } catch (err) { console.error('Failed to save dataset:', err) }
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
      const stateToSave = {
        active_tab: activeTab,
        global_filters: localDashboardState.global_filters || {},
        charts_state: localDashboardState.chartsState || {},
        report_builder_state: localDashboardState.reportBuilderState || {},
        data_table_state: localDashboardState.dataTableState || {},
        // DO NOT include insights here — they are saved directly via saveInsightsOnly
        // to avoid race conditions where a debounced save overwrites fresh insights with stale empty array
      }

      const stateStr = JSON.stringify(stateToSave)
      if (stateStr === lastSavedRef.current) return
      lastSavedRef.current = stateStr

      console.log('Debounced save (no insights) for dataset:', activeDatasetId)

      try {
        await projectService.saveDashboardState(activeDatasetId, stateToSave)
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
    if (dimensions.length === 0) {
      const totals = {}
      metrics.forEach(m => { totals[m] = d.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0) })
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
      metrics.forEach(m => { result[m] = group._rows.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0) })
      return result
    })
  }, [filteredRawData, rawData, schema])

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
      // DO NOT include insights — saved separately via saveInsightsOnly
    }

    try {
      await projectService.saveDashboardState(dsId, stateToSave)
      lastSavedRef.current = JSON.stringify(stateToSave)
      console.log('Flush saved dashboard state (no insights)')
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
    // Flush any pending saves before navigating away
    await flushSave()
    setStep('home')
  }, [flushSave])

  const openProject = useCallback(() => { setStep('dashboard') }, [])

  return <DataContext.Provider value={{
    rawData, filteredRawData, fileName, schema, step, setStep, activeTab, setActiveTab,
    globalFilters, setGlobalFilters, hasGlobalFilters,
    loadData, cancelTagging, confirmTagging, updateColumnSchema, removeColumn, columnsByType,
    aggregate, aggregateUnfiltered, getUniqueValues, rowCount, filteredRowCount,
    datasets, activeDatasetId, activeDataset, switchDataset, removeDataset, updateDatasetState,
    clearAll, goHome, openProject, flushSave,
    chartsState: localDashboardState.chartsState || {},
    reportBuilderState: localDashboardState.reportBuilderState || {},
    dataTableState: localDashboardState.dataTableState || {},
    insights: localDashboardState.insights || [],
    insightsLoaded: localDashboardState.insightsLoaded || false,
    chatHistory: localDashboardState.chatHistory || [],
  }}>{children}</DataContext.Provider>
}
