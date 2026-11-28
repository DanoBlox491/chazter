import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/utils/general.js';
import { IconButton } from './Button.jsx';

/**
 * Modal — portal-rendered dialog with focus trapping, Escape handling and
 * scroll locking. Renders as a right-hand sheet on mobile for a native feel.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', labelledBy }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first meaningful control after the panel paints.
    const timer = setTimeout(() => {
      const target =
        panelRef.current?.querySelector('[data-autofocus]') ||
        panelRef.current?.querySelector('input, textarea, select, button');
      target?.focus?.();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cx('modal', open ? 'is-open' : 'is-closing')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy || (title ? 'modal-title' : undefined)}
      aria-label={!title && !labelledBy ? 'Dialog' : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modal__scrim" aria-hidden="true" />
      <div ref={panelRef} className={cx('modal__panel', `modal__panel--${size}`)}>
        <header className="modal__header">
          <div>
            {title ? (
              <h2 className="modal__title" id="modal-title">
                {title}
              </h2>
            ) : null}
            {description ? <p className="modal__description">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--quiet btn--md" onClick={onClose} disabled={loading}>
            <span className="btn__label">{cancelLabel}</span>
          </button>
          <button
            type="button"
            className={cx('btn', 'btn--md', tone === 'danger' ? 'btn--danger' : 'btn--solid')}
            onClick={onConfirm}
            disabled={loading}
            data-autofocus
          >
            <span className="btn__label">{loading ? 'Working…' : confirmLabel}</span>
          </button>
        </>
      }
    >
      {null}
    </Modal>
  );
}
