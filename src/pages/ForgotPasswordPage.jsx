import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, MailCheck } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { sendPasswordReset } from '../lib/firebase/auth.js';
import { validateEmail } from '../lib/utils/validation.js';
import { errorMessage } from '../lib/utils/errors.js';

/**
 * Password reset.
 *
 * Firebase deliberately doesn't reveal whether an address exists, and neither
 * do we: the success screen appears regardless, so this page can't be used to
 * enumerate accounts.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = 'Reset your password · Chazter';
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;
    setBusy(true);
    setFormError('');
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (submitError) {
      setFormError(errorMessage(submitError, 'We couldn’t send that email. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      backTo="/signin"
      eyebrow={sent ? 'Check your inbox' : 'Password reset'}
      title={
        sent ? (
          <>
            Link <em>sent</em>
          </>
        ) : (
          <>
            Find your way <em>back in</em>
          </>
        )
      }
      subtitle={
        sent
          ? `If an account exists for ${email}, a reset link is on its way. It expires in one hour.`
          : 'Enter the email on your account and we’ll send a secure reset link.'
      }
      footer={
        <>
          Remembered it? <Link to="/signin">Back to sign in</Link>
        </>
      }
    >
      {sent ? (
        <div className="auth-success">
          <span className="auth-success__icon" aria-hidden="true">
            <MailCheck size={26} />
          </span>
          <p>
            Didn’t get it? Check spam, or{' '}
            <button
              type="button"
              className="auth-link auth-link--inline"
              onClick={() => setSent(false)}
            >
              try another address
            </button>
            .
          </p>
          <Link to="/signin" className="btn btn--outline btn--md">
            <span className="btn__label">Back to sign in</span>
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            leading={<AtSign size={16} aria-hidden="true" />}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError('');
              setFormError('');
            }}
            error={error}
            required
            data-autofocus
          />

          {formError ? (
            <p className="auth-alert" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
