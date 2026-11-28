import { cx } from '../../lib/utils/general.js';

/**
 * The Chazter mark: an open "C" ring drawn with a brush-like stroke, and a
 * coral dot — the spark of a new message. Pure SVG so it scales and themes.
 */
export function BrandMark({ size = 32, className, tone = 'brand' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cx('brand-mark', `brand-mark--${tone}`, className)}
      role="img"
      aria-label="Chazter"
    >
      <defs>
        <linearGradient id={`jade-${size}`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--chat-jade)" />
          <stop offset="1" stopColor="var(--jade-700)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" className="brand-mark__tile" />
      <path
        d="M46.6 18.9A19 19 0 1 0 50 32.6"
        fill="none"
        stroke={`url(#jade-${size})`}
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <circle cx="49.6" cy="38.4" r="5" fill="var(--coral-400)" />
    </svg>
  );
}

/** Mark + wordmark lockup used in the sidebar and auth pages. */
export function BrandLockup({ size = 30, showTagline = false, className }) {
  return (
    <span className={cx('brand-lockup', className)}>
      <BrandMark size={size} />
      <span className="brand-lockup__text">
        <span className="brand-lockup__name">Chazter</span>
        {showTagline ? <span className="brand-lockup__tagline">conversations, considered</span> : null}
      </span>
    </span>
  );
}
