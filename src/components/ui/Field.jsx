import { forwardRef, useId, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { cx } from '../../lib/utils/general.js';

/**
 * Text field with label, hint, error and optional validity tick.
 *
 * Wired for accessibility: label → input via id, error announced with
 * aria-describedby + aria-invalid, and a stable hint slot that does not
 * cause layout jumps.
 */
export const Field = forwardRef(function Field(
  {
    label,
    hint,
    error,
    success,
    type = 'text',
    id,
    leading,
    trailing,
    className,
    inputClassName,
    required,
    autoComplete,
    inputMode,
    maxLength,
    showCount = false,
    value,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId}`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && reveal ? 'text' : type;
  const describedBy = [error ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cx('field', error && 'field--error', success && !error && 'field--success', className)}>
      {label ? (
        <div className="field__top">
          <label htmlFor={fieldId} className="field__label">
            {label}
            {required ? (
              <span className="field__required" aria-hidden="true">
                {' '}
                *
              </span>
            ) : null}
          </label>
          {showCount && maxLength ? (
            <span className="field__count" aria-hidden="true">
              {String(value || '').length}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="field__control">
        {leading ? <span className="field__leading">{leading}</span> : null}
        <input
          ref={ref}
          id={fieldId}
          type={resolvedType}
          className={cx('field__input', leading && 'has-leading', inputClassName)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="field__action"
            onClick={() => setReveal((current) => !current)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            tabIndex={-1}
          >
            {reveal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        ) : success ? (
          <span className="field__valid" aria-hidden="true">
            <Check size={16} />
          </span>
        ) : trailing ? (
          <span className="field__trailing">{trailing}</span>
        ) : null}
      </div>

      {error ? (
        <p className="field__message field__message--error" id={`${fieldId}-error`} role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="field__message" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** Multi-line variant sharing the field styling. */
export const TextArea = forwardRef(function TextArea(
  { label, hint, error, id, className, maxLength, value, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId}`;
  return (
    <div className={cx('field', error && 'field--error', className)}>
      {label ? (
        <div className="field__top">
          <label htmlFor={fieldId} className="field__label">
            {label}
          </label>
          {maxLength ? (
            <span className="field__count" aria-hidden="true">
              {String(value || '').length}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="field__control field__control--area">
        <textarea
          ref={ref}
          id={fieldId}
          className="field__input field__textarea"
          rows={rows}
          maxLength={maxLength}
          value={value}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p className="field__message field__message--error" id={`${fieldId}-error`} role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="field__message" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
