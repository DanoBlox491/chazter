import { GoogleIcon } from '../brand/GoogleIcon.jsx';
import { Spinner } from '../ui/States.jsx';
import { cx } from '../../lib/utils/general.js';

/** "Continue with Google" button shared by sign-in and sign-up. */
export function GoogleButton({ onClick, loading = false, disabled = false, label = 'Continue with Google' }) {
  return (
    <button
      type="button"
      className={cx('google-btn', loading && 'is-loading')}
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size={18} label="Connecting to Google" /> : <GoogleIcon size={18} />}
      <span>{loading ? 'Connecting…' : label}</span>
    </button>
  );
}
