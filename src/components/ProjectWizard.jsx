import React, { useState, useCallback, useRef, useMemo } from 'react'
import { useProject } from '../context/ProjectContext'
import { useData } from '../context/DataContext'
import { useTier } from '../context/TierContext'
import { TEMPLATES } from '../lib/templates'
import {
  FolderPlus, Upload, FileSpreadsheet, Globe, ArrowRight, ArrowLeft, Loader2, AlertCircle, Link2, Building2, Plus
} from 'lucide-react'

export default function ProjectWizard({ onComplete, onCancel }) {
  const { createProject, projects } = useProject()
  const { loadData } = useData()
  const { tier } = useTier()
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const isAgency = tier === 'agency'
  const [wizardStep, setWizardStep] = useState('name') // name | source | connect-api
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [sourceType, setSourceType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  // Get unique client names from existing projects
  const existingClients = useMemo(() => {
    const names = [...new Set(projects.map(p => p.client_name).filter(Boolean))]
    return names.sort()
  }, [projects])

  // API connector state
  const [apiUrl, setApiUrl] = useState('')
  const [apiAuthMethod, setApiAuthMethod] = useState('none') // none | api_key | bearer
  const [apiAuthValue, setApiAuthValue] = useState('')
  const [apiJsonPath, setApiJsonPath] = useState('')

  const handleCreateProject = async (dataSourceType, dataSourceMeta = {}) => {
    if (!projectName.trim()) { setError('Please enter a project name'); return null }
    const finalClientName = showNewClient ? newClientName.trim() : clientName
    setLoading(true)
    setError(null)
    try {
      const project = await createProject({
        name: projectName.trim(),
        clientName: finalClientName || null,
        dataSourceType,
        dataSourceMeta: { ...dataSourceMeta, templateId: selectedTemplate || 'auto' },
      })
      return project
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = useCallback(async (file) => {
    const project = await handleCreateProject('file', { originalFileName: file.name })
    if (!project) return

    setLoading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext === 'csv' || ext === 'tsv') {
        const Papa = (await import('papaparse')).default
        const text = await file.text()
        Papa.parse(text, {
          header: true, skipEmptyLines: true, dynamicTyping: true,
          complete: (results) => {
            if (results.errors.length > 0 && results.data.length === 0) {
              setError(`Parse error: ${results.errors[0].message}`)
              setLoading(false)
              return
            }
            loadData(results.data, file.name)
            onComplete?.()
            setLoading(false)
          },
          error: (err) => { setError(`Parse error: ${err.message}`); setLoading(false) }
        })
      } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        const firstSheet = workbook.SheetNames[0]
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null })
        if (data.length === 0) { setError('The spreadsheet appears to be empty.'); setLoading(false); return }
        loadData(data, file.name)
        onComplete?.()
        setLoading(false)
      } else {
        setError('Unsupported file type.')
        setLoading(false)
      }
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`)
      setLoading(false)
    }
  }, [projectName, loadData, onComplete])

  const handleGoogleSheets = async () => {
    const project = await handleCreateProject('google_sheets')
    if (!project) return
    // Trigger the Google Sheets picker — don't call onComplete yet,
    // the picker or OAuth redirect will handle the rest
    window.dispatchEvent(new Event('nb-open-sheets'))
  }

  const handleApiConnect = async (e) => {
    e.preventDefault()
    if (!apiUrl.trim()) { setError('Please enter an API URL'); return }

    const project = await handleCreateProject('api', {
      url: apiUrl,
      auth_method: apiAuthMethod,
      json_path: apiJsonPath,
    })
    if (!project) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fetch-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: apiUrl,
          auth_method: apiAuthMethod,
          auth_value: apiAuthValue,
          json_path: apiJsonPath,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to fetch API data')

      if (!result.rows || result.rows.length === 0) {
        throw new Error('No data rows found at the specified path')
      }

      loadData(result.rows, new URL(apiUrl).hostname)
      onComplete?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sources = [
    { id: 'file', label: 'Upload File', desc: 'CSV, TSV, Excel', icon: Upload, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'google_sheets', label: 'Google Sheets', desc: 'Connect your spreadsheet', icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: 'api', label: 'API', desc: 'Enter endpoint URL', icon: Globe, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4 border border-blue-200">
            <FolderPlus className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
            {wizardStep === 'connect-api' ? 'API Connector' : 'New Project'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {wizardStep === 'connect-api' ? 'Enter your API details' : 'Name it and pick your data source'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Combined: Name + Source */}
          {wizardStep !== 'connect-api' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Project name</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q1 Campaign Analysis" autoFocus
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Client assignment for Agency tier */}
              {isAgency && (
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Client (optional)
                  </label>
                  {!showNewClient ? (
                    <div className="space-y-2">
                      <select value={clientName} onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                        <option value="">Personal project (no client)</option>
                        {existingClients.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => setShowNewClient(true)}
                        className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-dark font-medium">
                        <Plus className="w-3 h-3" /> New client
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Client name (e.g. Nike, Adidas)"
                        className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                      <button onClick={() => { setShowNewClient(false); setNewClientName('') }}
                        className="text-xs text-slate-500 hover:text-slate-700">Choose existing client</button>
                    </div>
                  )}
                </div>
              )}

              {/* Template picker — shown after name is entered */}
              {projectName.trim() && (
                <div className="animate-fade-in">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Dashboard template (optional)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                    <button onClick={() => setSelectedTemplate(null)}
                      className={`p-2.5 rounded-lg border-2 text-left transition-all text-xs ${!selectedTemplate ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <span className="text-sm">✨</span>
                      <p className="font-medium text-slate-700 mt-0.5">Auto-detect</p>
                      <p className="text-[10px] text-slate-400">AI picks the best layout</p>
                    </button>
                    {TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                        className={`p-2.5 rounded-lg border-2 text-left transition-all text-xs ${selectedTemplate === t.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <span className="text-sm">{t.icon}</span>
                        <p className="font-medium text-slate-700 mt-0.5">{t.name}</p>
                        <p className="text-[10px] text-slate-400">{t.description}</p>
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Connect your data</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {sources.map(src => (
                      <button key={src.id} disabled={loading}
                        onClick={() => {
                          setSourceType(src.id)
                          if (src.id === 'file') fileRef.current?.click()
                          else if (src.id === 'google_sheets') handleGoogleSheets()
                          else if (src.id === 'api') setWizardStep('connect-api')
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left hover:shadow-sm transition-all ${src.color} hover:opacity-90 disabled:opacity-50`}>
                        <div className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center shrink-0">
                          <src.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{src.label}</p>
                          <p className="text-[10px] opacity-70">{src.desc}</p>
                        </div>
                        {loading && sourceType === src.id && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancel button */}
              <div className="flex items-center pt-1">
                {onCancel && (
                  <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          
          <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.xlsm" className="hidden"
            onChange={(e) => { const f = e.target.files[0]; if (f) handleFileSelect(f) }} />

          {/* API Connector */}
          {wizardStep === 'connect-api' && (
            <form onSubmit={handleApiConnect} className="space-y-4">
              <button type="button" onClick={() => setWizardStep('name')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">API Endpoint URL</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/data" autoFocus
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Authentication</label>
                <select value={apiAuthMethod} onChange={(e) => setApiAuthMethod(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-accent appearance-none">
                  <option value="none">No authentication</option>
                  <option value="api_key">API Key (header)</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
              {apiAuthMethod !== 'none' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    {apiAuthMethod === 'api_key' ? 'API Key' : 'Bearer Token'}
                  </label>
                  <input type="password" value={apiAuthValue} onChange={(e) => setApiAuthValue(e.target.value)}
                    placeholder={apiAuthMethod === 'api_key' ? 'Your API key' : 'Your bearer token'}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">JSON Path to data array (optional)</label>
                <input type="text" value={apiJsonPath} onChange={(e) => setApiJsonPath(e.target.value)}
                  placeholder="e.g. data.results or leave empty for root"
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                <p className="text-xs text-slate-400 mt-1">Dot notation path to the array of records in the JSON response</p>
              </div>
              <button type="submit" disabled={loading || !apiUrl.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Fetch & Connect</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 animate-slide-up">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
