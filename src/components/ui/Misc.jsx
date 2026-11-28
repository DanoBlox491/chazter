import { useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/utils/general.js';

/** Small count badge used for unread messages. */
export function Badge({ count, max = 99, muted = false, className }) {
  if (!count) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cx('badge', muted && 'badge--muted', className)}
      aria-label={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
    >
      {label}
    </span>
  );
}

/** Section eyebrow + action row used in panels and sheets. */
export function SectionHeader({ title, action, className }) {
  return (
    <div className={cx('section-header', className)}>
      <h3 className="section-header__title">{title}</h3>
      {action}
    </div>
  );
}

/** Segmented control for two or three mutually exclusive options. */
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div className={cx('segmented', `segmented--${size}`)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx('segmented__option', value === option.value && 'is-active')}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <option.icon size={15} aria-hidden="true" /> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Simple accessible switch. */
export function Switch({ checked, onChange, label, description, id }) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {description ? <span className="switch-row__description">{description}</span> : null}
      </span>
      <span className={cx('switch', checked && 'is-on')}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={Boolean(checked)}
          onChange={(event) => onChange?.(event.target.checked)}
          aria-label={label}
        />
        <span className="switch__track" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
      </span>
    </label>
  );
}

/** Copy-to-clipboard button with inline confirmation. */
export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={cx('copy-btn', className)} onClick={copy}>
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Password strength meter used by sign-up. */
export function StrengthMeter({ strength }) {
  return (
    <div className="strength" aria-hidden="true">
      <div className="strength__track">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={cx('strength__seg', strength.score >= step && 'is-on')} />
        ))}
      </div>
      <span className="strength__label">{strength.label}</span>
    </div>
  );
}
