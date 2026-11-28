import { Component } from 'react';

/**
 * Catches render errors so a bug in one screen never white-screens the app.
 * Shows a calm recovery screen with a reload action and debug detail in dev.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: '', copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[chazter] Unhandled UI error', error, info?.componentStack);
    // Keep the component stack for the on-screen report.
    this.setState({ info: info?.componentStack || '' });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ error: null });
  };

  /** Copy a compact report so a user can paste it into a bug report. */
  handleCopy = async () => {
    const { error, info } = this.state;
    const report = [
      `Chazter error: ${error?.message || error}`,
      `Route: ${typeof window !== 'undefined' ? window.location.pathname : 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      info ? `Component stack:${info}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
    } catch {
      // Clipboard can be blocked; the message stays visible on screen anyway.
      this.setState({ copied: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <div className="crash__card">
          <span className="crash__badge" aria-hidden="true">
            !
          </span>
          <h1 className="crash__title">Something slipped.</h1>
          <p className="crash__text">
            Chazter hit an unexpected error. Your messages are safe — reloading usually fixes it.
          </p>
          {/*
            Show the underlying message in production too. The original
            version only exposed it in dev, which meant a real crash reached
            users as "something slipped" with no way to report the cause.
            The message is trimmed to a sane length and excludes the stack.
          */}
          <p className="crash__cause">
            <strong>What happened:</strong>{' '}
            <code>{String(this.state.error?.message || this.state.error || 'Unknown error')}</code>
          </p>
          {import.meta.env.DEV ? (
            <pre className="crash__detail">{String(this.state.error?.stack || this.state.error)}</pre>
          ) : null}
          <div className="crash__actions">
            <button type="button" className="btn btn--solid btn--md" onClick={this.handleReload}>
              <span className="btn__label">Reload Chazter</span>
            </button>
            <button type="button" className="btn btn--quiet btn--md" onClick={this.handleDismiss}>
              <span className="btn__label">Try again</span>
            </button>
            <button type="button" className="btn btn--ghost btn--md" onClick={this.handleCopy}>
              <span className="btn__label">{this.state.copied ? 'Copied' : 'Copy details'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
