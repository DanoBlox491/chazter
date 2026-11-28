import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils/general.js';

/**
 * Loading, empty and error states shared across the app.
 * Consistent, friendly, never a bare spinner on a blank canvas.
 */

export function Spinner({ size = 20, label = 'Loading', className }) {
  return (
    <span className={cx('spinner', className)} role="status" aria-label={label}>
      <Loader2 size={size} aria-hidden="true" />
    </span>
  );
}

/** Full-page boot screen used while auth + profile resolve. */
export function AppLoading({ label = 'Opening Chazter…' }) {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <div className="boot-mark" aria-hidden="true">
        <span className="boot-mark__ring" />
        <span className="boot-mark__dot" />
      </div>
      <p className="boot-label">{label}</p>
    </div>
  );
}

/** Inline skeleton rows for lists (conversation list, people search). */
export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index} style={{ animationDelay: `${index * 60}ms` }}>
          <span className="skeleton skeleton--avatar" />
          <span className="skeleton-row__lines">
            <span className="skeleton skeleton--line" style={{ width: `${52 + ((index * 7) % 30)}%` }} />
            <span className="skeleton skeleton--line skeleton--line-sm" style={{ width: `${70 - ((index * 5) % 25)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the message pane while history loads. */
export function MessageSkeleton() {
  return (
    <div className="message-skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div className={cx('skeleton-bubble', index % 2 === 0 ? 'is-in' : 'is-out')} key={index}>
          <span className="skeleton skeleton--bubble" style={{ width: `${140 + ((index * 43) % 130)}px` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * EmptyState — illustration slot + copy + action.
 * `icon` is a lucide component; `art` allows richer custom shapes.
 */
export function EmptyState({ icon: Icon, art, title, description, action, compact = false, className }) {
  return (
    <div className={cx('empty-state', compact && 'empty-state--compact', className)}>
      {art || (Icon ? (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={compact ? 20 : 26} strokeWidth={1.6} />
        </span>
      ) : null)}
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

/** Error state with retry. */
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  /** Optional technical detail (a Firebase error code) shown in small type. */
  detail,
}) {
  return (
    <div className="empty-state empty-state--error" role="alert">
      <span className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {detail ? (
        <p className="empty-state__detail">
          <code>{detail}</code>
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
          <span className="btn__label">{retryLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
