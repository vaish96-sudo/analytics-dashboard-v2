import React, { useState, useCallback, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, Plus } from 'lucide-react'
import { useData } from '../context/DataContext'

export default function FileUpload() {
  const { loadData, datasets, switchDataset } = useData()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef(null)

  const parseFile = useCallback(async (file) => {
    setError(null); setParsing(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext === 'csv' || ext === 'tsv') {
        const Papa = (await import('papaparse')).default
        const text = await file.text()
        Papa.parse(text, {
          header: true, skipEmptyLines: true, dynamicTyping: true,
          complete: (results) => { if (results.errors.length > 0 && results.data.length === 0) { setError(`Parse error: ${results.errors[0].message}`); setParsing(false); return }; loadData(results.data, file.name); setParsing(false) },
          error: (err) => { setError(`Parse error: ${err.message}`); setParsing(false) }
        })
      } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        const firstSheet = workbook.SheetNames[0]
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null })
        if (data.length === 0) { setError('The spreadsheet appears to be empty.'); setParsing(false); return }
        loadData(data, file.name); setParsing(false)
      } else { setError('Unsupported file type. Please upload a .csv, .tsv, .xlsx, or .xls file.'); setParsing(false) }
    } catch (err) { setError(`Failed to parse file: ${err.message}`); setParsing(false) }
  }, [loadData])

  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file) }, [parseFile])
  const handleGoogleSheets = () => { window.dispatchEvent(new Event('nb-open-sheets')) }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200">
              <img src="/logo_mark.png" alt="NB" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900">NORTHERN BIRD</h1>
              <p className="text-[9px] sm:text-[10px] font-display font-semibold tracking-[0.3em] text-accent uppercase -mt-0.5">Analytics</p>
            </div>
          </div>
          <p className="text-slate-500 text-base sm:text-lg font-light mt-4">
            {datasets.length > 0 ? 'Add another dataset' : 'Upload your data. Get instant intelligence.'}
          </p>
        </div>

        <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onClick={() => fileRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 transition-all duration-300 group
            ${dragging ? 'border-accent bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-slate-400 bg-white'}
            ${parsing ? 'pointer-events-none opacity-60' : ''}`}>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.xlsm" onChange={(e) => { const f = e.target.files[0]; if (f) parseFile(f) }} className="hidden" />
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            {parsing ? (
              <><div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 flex items-center justify-center animate-pulse"><FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7 text-accent" /></div>
              <p className="text-base sm:text-lg font-display font-medium text-slate-800 text-center">Parsing your data...</p></>
            ) : (
              <><div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all ${dragging ? 'bg-blue-100 scale-110' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                <Upload className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${dragging ? 'text-accent' : 'text-slate-400 group-hover:text-slate-500'}`} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-display font-medium text-slate-800 text-center">Drop your file here</p>
                <p className="text-sm text-slate-400 mt-1 text-center">or click to browse - CSV, TSV, Excel</p>
              </div></>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3"><div className="flex-1 h-px bg-slate-200" /><span className="text-xs text-slate-400 font-medium">or connect a source</span><div className="flex-1 h-px bg-slate-200" /></div>

        <button onClick={handleGoogleSheets}
          className="mt-4 w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all group">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M19.5 3H4.5C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3z" fill="#0F9D58"/>
            <rect x="5" y="7" width="14" height="2" rx="0.5" fill="white" opacity="0.9"/><rect x="5" y="11" width="14" height="2" rx="0.5" fill="white" opacity="0.9"/><rect x="5" y="15" width="14" height="2" rx="0.5" fill="white" opacity="0.9"/><rect x="11" y="7" width="2" height="10" rx="0.5" fill="white" opacity="0.7"/>
          </svg>
          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Connect Google Sheets</span>
        </button>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 animate-slide-up">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {datasets.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">Your datasets ({datasets.length})</p>
            <div className="space-y-1.5">
              {datasets.map(ds => (
                <button key={ds.id} onClick={() => switchDataset(ds.id)}
                  className="w-full flex items-center gap-2 text-xs text-slate-600 hover:text-accent p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-left">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate flex-1">{ds.fileName}</span>
                  <span className="text-slate-400 shrink-0">{ds.rawData.length} rows</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {datasets.length === 0 && (
          <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            {[{ label: 'Auto Charts', desc: 'Instant visualizations' }, { label: 'Ask AI', desc: 'Query in plain English' }, { label: 'Report Builder', desc: 'Drag & drop metrics' }].map((feat) => (
              <div key={feat.label} className="text-center p-3 sm:p-4 rounded-xl bg-white border border-slate-200">
                <p className="text-xs sm:text-sm font-display font-medium text-slate-700">{feat.label}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{feat.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
