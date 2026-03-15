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

  // Local state derived from project
  const [activeDatasetId, setActiveDatasetId] = useState(null)
  const [step, setStep] = useState('upload')
  const [activeTab, setActiveTab] = useState('overview')

  // Temporary data for new uploads (before saving to DB)
  const [pendingData, setPendingData] = useState(null)
  const [pendingFileName, setPendingFileName] = useState(null)
  const [pendingSchema, setPendingSchema] = useState(null)

  // Local overrides for dashboard state (debounced save)
  const [localDashboardState, setLocalDashboardState] = useState({})
  const saveTimeout = useRef(null)

  // Initialize from project
  useEffect(() => {
    if (!activeProject) {
      setActiveDatasetId(null)
      setLocalDashboardState({})
      setStep('upload')
      return
    }

    const datasets = activeProject.datasets || []
    if (datasets.length > 0) {
      const firstDs = datasets[0]
      setActiveDatasetId(firstDs.id)

      // Load dashboard state with proper key normalization
      const raw = firstDs.dashboard_states?.[0] || {}
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
      if (step !== 'home') setStep('dashboard')
    } else {
      setLocalDashboardState({})
      setStep('upload')
    }
  }, [activeProject?.id])

  // Datasets from project
  const datasets = useMemo(() => {
    if (!activeProject?.datasets) return []
    return activeProject.datasets.map(ds => ({
      id: ds.id,
      rawData: ds.raw_data || [],
      fileName: ds.file_name,
      schema: ds.schema_def || {},
      rowCount: ds.row_count || 0,
      dashboardState: ds.dashboard_states?.[0] || {},
    }))
  }, [activeProject])

  const activeDataset = useMemo(() => {
    if (pendingData && pendingSchema) {
      return {
        id: '__pending__',
        rawData: pendingData,
        fileName: pendingFileName,
        schema: pendingSchema,
        rowCount: pendingData.length,
      }
    }
    return datasets.find(d => d.id === activeDatasetId) || null
  }, [datasets, activeDatasetId, pendingData, pendingSchema, pendingFileName])

  const rawData = activeDataset?.rawData || null
  const fileName = activeDataset?.fileName || null
  const schema = activeDataset?.schema || null

  // Global filters
  const globalFilters = localDashboardState.global_filters || {}
  const setGlobalFilters = useCallback((valOrFn) => {
    setLocalDashboardState(prev => {
      const newFilters = typeof valOrFn === 'function' ? valOrFn(prev.global_filters || {}) : valOrFn
      return { ...prev, global_filters: newFilters }
    })
  }, [])

  const hasGlobalFilters = Object.values(globalFilters).some(v => v && v.length > 0)

  // Filtered data
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

  // Load data (file upload) - stores temporarily until user tags and confirms
  const loadData = useCallback((data, name) => {
    if (!data || data.length === 0) return
    const autoSchema = buildAutoSchema(data)
    setPendingData(data)
    setPendingFileName(name)
    setPendingSchema(autoSchema)
    setStep('tag')
  }, [])

  const cancelTagging = useCallback(() => {
    setPendingData(null)
    setPendingFileName(null)
    setPendingSchema(null)
    if (datasets.length > 0) {
      setActiveDatasetId(datasets[0].id)
      setStep('dashboard')
    } else {
      setStep('upload')
    }
  }, [datasets])

  // Confirm tagging and save to database
  const confirmTagging = useCallback(async () => {
    if (!pendingData || !pendingSchema || !activeProjectId) return

    try {
      const dataset = await addDatasetToProject({
        fileName: pendingFileName,
        schemaDef: pendingSchema,
        rowCount: pendingData.length,
        rawData: pendingData,
      })

      setPendingData(null)
      setPendingFileName(null)
      setPendingSchema(null)
      setActiveDatasetId(dataset.id)
      // Reset dashboard state for new dataset
      setLocalDashboardState({})
      setActiveTab('overview')
      setStep('dashboard')
    } catch (err) {
      console.error('Failed to save dataset:', err)
    }
  }, [pendingData, pendingSchema, pendingFileName, activeProjectId, addDatasetToProject])

  const switchDataset = useCallback((id) => {
    setActiveDatasetId(id)
    const ds = datasets.find(d => d.id === id)
    if (ds?.dashboardState) {
      setLocalDashboardState(ds.dashboardState)
      setActiveTab(ds.dashboardState.active_tab || 'overview')
    }
    setStep('dashboard')
  }, [datasets])

  const removeDataset = useCallback(async (id) => {
    try {
      await removeDatasetFromProject(id)
      if (activeDatasetId === id) {
        const remaining = datasets.filter(d => d.id !== id)
        if (remaining.length > 0) {
          setActiveDatasetId(remaining[0].id)
          setStep('dashboard')
        } else {
          setActiveDatasetId(null)
          setStep('upload')
        }
      }
    } catch (err) {
      console.error('Failed to remove dataset:', err)
    }
  }, [activeDatasetId, datasets, removeDatasetFromProject])

  const updateColumnSchema = useCallback((colName, updates) => {
    if (pendingSchema) {
      setPendingSchema(prev => ({ ...prev, [colName]: { ...prev[colName], ...updates } }))
    }
    // For saved datasets, update via Supabase
    // (This happens when editing schema from dashboard)
  }, [pendingSchema])

  const removeColumn = useCallback((colName) => {
    if (pendingSchema) {
      setPendingSchema(prev => { const s = { ...prev }; delete s[colName]; return s })
    }
  }, [pendingSchema])

  const updateDatasetState = useCallback((key, value) => {
    setLocalDashboardState(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : value,
    }))
  }, [])

  // Debounced save of dashboard state to Supabase
  useEffect(() => {
    if (!activeDatasetId || activeDatasetId === '__pending__') return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(async () => {
      try {
        await projectService.saveDashboardState(activeDatasetId, {
          active_tab: activeTab,
          global_filters: localDashboardState.global_filters || {},
          charts_state: localDashboardState.charts_state || localDashboardState.chartsState || {},
          report_builder_state: localDashboardState.report_builder_state || localDashboardState.reportBuilderState || {},
          data_table_state: localDashboardState.data_table_state || localDashboardState.dataTableState || {},
          insights: localDashboardState.insights || [],
          insights_loaded: localDashboardState.insights_loaded || localDashboardState.insightsLoaded || false,
        })
      } catch (err) {
        console.error('Failed to save dashboard state:', err)
      }
    }, 1000)

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

  const clearAll = useCallback(() => {
    setPendingData(null)
    setPendingFileName(null)
    setPendingSchema(null)
    setActiveDatasetId(null)
    setStep('upload')
    setActiveTab('overview')
    setLocalDashboardState({})
  }, [])

  return <DataContext.Provider value={{
    rawData, filteredRawData, fileName, schema, step, setStep, activeTab, setActiveTab,
    globalFilters, setGlobalFilters, hasGlobalFilters,
    loadData, cancelTagging, confirmTagging, updateColumnSchema, removeColumn, columnsByType,
    aggregate, aggregateUnfiltered, getUniqueValues, rowCount, filteredRowCount,
    datasets, activeDatasetId, activeDataset, switchDataset, removeDataset, updateDatasetState, clearAll,
    // Expose for components that check state keys
    chartsState: localDashboardState.charts_state || localDashboardState.chartsState || {},
    reportBuilderState: localDashboardState.report_builder_state || localDashboardState.reportBuilderState || {},
    dataTableState: localDashboardState.data_table_state || localDashboardState.dataTableState || {},
    insights: localDashboardState.insights || [],
    insightsLoaded: localDashboardState.insights_loaded || localDashboardState.insightsLoaded || false,
    chatHistory: localDashboardState.chatHistory || [],
  }}>{children}</DataContext.Provider>
}
