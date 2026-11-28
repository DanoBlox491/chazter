/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cx } from '../lib/utils/general.js';

const ToastContext = createContext(null);
let idCounter = 0;

/**
 * Lightweight toast system (no dependency).
 * Renders into a fixed, aria-live region so screen readers announce results.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ title, description, variant = 'info', duration = 4200 }) => {
      idCounter += 1;
      const id = `toast-${idCounter}`;
      setToasts((current) => [...current.slice(-3), { id, title, description, variant }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: 'success' }),
      error: (title, description) => push({ title, description, variant: 'error', duration: 6000 }),
      info: (title, description) => push({ title, description, variant: 'info' }),
      dismiss,
    }),
    [push, dismiss],
  );

  const icons = {
    success: <CheckCircle2 size={18} aria-hidden="true" />,
    error: <AlertCircle size={18} aria-hidden="true" />,
    info: <Info size={18} aria-hidden="true" />,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        <div aria-live="polite" aria-atomic="false" className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={cx('toast', `toast--${toast.variant}`)} role="status">
              <span className="toast__icon">{icons[toast.variant]}</span>
              <div className="toast__body">
                <p className="toast__title">{toast.title}</p>
                {toast.description ? <p className="toast__description">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
