import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils/general.js';

/**
 * Button — the single button primitive.
 *
 * variants: solid (jade), outline, ghost, danger, quiet
 * sizes: sm, md, lg
 * `loading` disables interaction and swaps the icon for a spinner while
 * preserving the label width so layouts don't jump.
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'solid',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--block',
        loading && 'is-loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 className="btn__spinner" size={16} aria-hidden="true" />
      ) : Icon ? (
        <Icon className="btn__icon" size={16} aria-hidden="true" />
      ) : null}
      <span className="btn__label">{children}</span>
      {IconRight && !loading ? <IconRight className="btn__icon" size={16} aria-hidden="true" /> : null}
    </button>
  );
});

/** Square icon-only button with an accessible label. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', className, loading = false, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('icon-btn', `icon-btn--${size}`, `icon-btn--${variant}`, className)}
      aria-label={label}
      title={label}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={18} className="btn__spinner" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
    </button>
  );
});
