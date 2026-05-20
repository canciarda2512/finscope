import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: 'var(--red-muted)', color: 'var(--red)' }}>
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm mb-6 max-w-md" style={{ color: 'var(--text-muted)' }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={this.handleReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      </div>
    );
  }
}
