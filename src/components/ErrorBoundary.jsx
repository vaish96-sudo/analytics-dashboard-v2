import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? ` - ${this.props.name}` : ''}]:`, error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset })
      }

      const isInline = this.props.variant === 'inline'

      if (isInline) {
        return (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {this.props.name ? `${this.props.name} failed to load` : 'Something went wrong'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>This section encountered an error.</p>
            </div>
            <button onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: 'var(--accent)', background: 'var(--bg-surface)' }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-overlay)' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="text-base font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {this.props.name ? `${this.props.name} encountered an error` : 'Something went wrong'}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              An unexpected error occurred. Try refreshing this section.
            </p>
            <button onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors"
              style={{ background: 'var(--accent)' }}>
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
