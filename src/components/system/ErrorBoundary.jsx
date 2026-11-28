import { Component } from 'react';

/**
 * Catches render errors so a bug in one screen never white-screens the app.
 * Shows a calm recovery screen with a reload action and debug detail in dev.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[chazter] Unhandled UI error', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ error: null });
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
          </div>
        </div>
      </div>
    );
  }
}
