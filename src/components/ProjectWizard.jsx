import React, { useState, useCallback, useRef } from 'react'
import { useProject } from '../context/ProjectContext'
import { useData } from '../context/DataContext'
import {
  FolderPlus, Upload, FileSpreadsheet, Globe, ArrowRight, ArrowLeft, Loader2, AlertCircle, Link2
} from 'lucide-react'

export default function ProjectWizard({ onComplete, onCancel }) {
  const { createProject } = useProject()
  const { loadData } = useData()
  const [wizardStep, setWizardStep] = useState('name') // name | source | connect-api
  const [projectName, setProjectName] = useState('')
  const [sourceType, setSourceType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  // API connector state
  const [apiUrl, setApiUrl] = useState('')
  const [apiAuthMethod, setApiAuthMethod] = useState('none') // none | api_key | bearer
  const [apiAuthValue, setApiAuthValue] = useState('')
  const [apiJsonPath, setApiJsonPath] = useState('')

  const handleCreateProject = async (dataSourceType, dataSourceMeta = {}) => {
    if (!projectName.trim()) { setError('Please enter a project name'); return null }
    setLoading(true)
    setError(null)
    try {
      const project = await createProject({
        name: projectName.trim(),
        dataSourceType,
        dataSourceMeta,
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
    // Trigger the Google Sheets picker via custom event (same as v1)
    window.dispatchEvent(new Event('nb-open-sheets'))
    onComplete?.()
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
    { id: 'api', label: 'REST API', desc: 'Enter endpoint URL', icon: Globe, color: 'bg-purple-50 text-purple-600 border-purple-200' },
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
            {wizardStep === 'name' ? 'Create New Project' : wizardStep === 'source' ? 'Connect Data' : 'API Connector'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {wizardStep === 'name' ? 'Give your project a name' : wizardStep === 'source' ? 'Choose how to bring in your data' : 'Enter your REST API details'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Step 1: Name */}
          {wizardStep === 'name' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Project name</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q1 Campaign Analysis" autoFocus
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  onKeyDown={(e) => { if (e.key === 'Enter' && projectName.trim()) setWizardStep('source') }}
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                {onCancel && (
                  <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-4 h-4" /> Cancel
                  </button>
                )}
                <button onClick={() => setWizardStep('source')} disabled={!projectName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50 ml-auto">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Data Source */}
          {wizardStep === 'source' && (
            <div className="space-y-3">
              <button onClick={() => setWizardStep('name')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Data source for "{projectName}"</p>
              {sources.map(src => (
                <button key={src.id} disabled={loading}
                  onClick={() => {
                    setSourceType(src.id)
                    if (src.id === 'file') fileRef.current?.click()
                    else if (src.id === 'google_sheets') handleGoogleSheets()
                    else if (src.id === 'api') setWizardStep('connect-api')
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left hover:shadow-sm transition-all ${src.color} hover:opacity-90 disabled:opacity-50`}>
                  <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center shrink-0">
                    <src.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{src.label}</p>
                    <p className="text-xs opacity-70">{src.desc}</p>
                  </div>
                  {loading && sourceType === src.id && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                </button>
              ))}
              <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.xlsm" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (f) handleFileSelect(f) }} />
            </div>
          )}

          {/* Step 3: API Connector */}
          {wizardStep === 'connect-api' && (
            <form onSubmit={handleApiConnect} className="space-y-4">
              <button type="button" onClick={() => setWizardStep('source')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
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
