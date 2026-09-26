import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '400px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            padding: '40px',
            borderRadius: '24px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              color: '#ef4444'
            }}>⚠️</div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 8px 0',
              color: '#f1f5f9'
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              lineHeight: '1.6',
              margin: '0 0 24px 0',
              fontWeight: 600
            }}>
              Something went wrong. Please refresh.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
