import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import LogoMark from './LogoMark'
import { FileSpreadsheet, Loader2, ArrowLeft, RefreshCw, Search, AlertCircle } from 'lucide-react'

export default function GoogleSheetsPicker({ accessToken, onBack, onDone }) {
  const { loadData } = useData()
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSheet, setLoadingSheet] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchSheets()
  }, [accessToken])

  const fetchSheets = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google-sheets-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch sheets')
      }
      const data = await res.json()
      setSheets(data.files || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSheet = async (sheet) => {
    setLoadingSheet(sheet.id)
    setError(null)
    try {
      const res = await fetch('/api/google-sheets-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, spreadsheet_id: sheet.id })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch sheet data')
      }
      const data = await res.json()
      if (!data.rows || data.rows.length === 0) {
        throw new Error('The spreadsheet appears to be empty.')
      }
      loadData(data.rows, sheet.name + '.gsheet')
      // Close the picker so the column tagger can show
      onDone?.()
    } catch (err) {
      setError(err.message)
      setLoadingSheet(null)
    }
  }

  const filtered = sheets.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200">
              <LogoMark className="w-10 h-10 object-contain" alt="NB" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-display font-bold tracking-tight text-slate-900">Meuris</h1>
              <p className="text-[10px] font-display font-semibold tracking-[0.3em] text-accent uppercase -mt-0.5">Analytics</p>
            </div>
          </div>
          <p className="text-slate-500 text-lg font-light mt-4">Select a Google Sheet to analyze</p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to upload
            </button>
            <button onClick={fetchSheets} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search spreadsheets..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-sm text-slate-400">Loading your spreadsheets...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 px-4">
                <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
                <p className="text-sm text-red-500">{error}</p>
                <button onClick={fetchSheets} className="mt-3 text-xs text-accent hover:underline">Try again</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">{search ? 'No sheets match your search' : 'No spreadsheets found in your Google Drive'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map(sheet => (
                  <button key={sheet.id} onClick={() => handleSelectSheet(sheet)}
                    disabled={loadingSheet !== null}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      {loadingSheet === sheet.id
                        ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                        : <svg className="w-4 h-4" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58"/><rect x="6" y="7" width="12" height="1.5" rx="0.5" fill="white" opacity="0.9"/><rect x="6" y="11" width="12" height="1.5" rx="0.5" fill="white" opacity="0.9"/><rect x="6" y="15" width="12" height="1.5" rx="0.5" fill="white" opacity="0.9"/><rect x="11" y="7" width="1.5" height="9.5" rx="0.5" fill="white" opacity="0.7"/></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{sheet.name}</p>
                      {sheet.modifiedTime && (
                        <p className="text-xs text-slate-400">Modified {new Date(sheet.modifiedTime).toLocaleDateString()}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
