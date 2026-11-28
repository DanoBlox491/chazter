import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AtSign, Lock } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell.jsx';
import { GoogleButton } from '../components/auth/GoogleButton.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateEmail } from '../lib/utils/validation.js';
import { errorMessage } from '../lib/utils/errors.js';
import { linkGuidance } from '../lib/services/authFlow.js';
import { describeEmailMethods } from '../lib/firebase/auth.js';

/**
 * Sign in — email + password, or Google.
 *
 * Google collisions are handled gracefully: if the email already belongs to a
 * password account, Firebase refuses the popup (account-exists-with-different-
 * credential). We detect that case and steer the user to the password form
 * instead of creating a duplicate or a confusing dead end.
 */
export function SignInPage() {
  const { signInEmail, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const emailRef = useRef(null);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'password' | 'google'

  const redirectTo = location.state?.from?.pathname || '/app';

  useEffect(() => {
    document.title = 'Sign in · Chazter';
  }, []);

  useEffect(() => {
    if (location.state?.notice) {
      toast.info(location.state.notice);
      window.history.replaceState({}, '');
    }
  }, [location.state, toast]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(form.email),
      password: form.password ? '' : 'Enter your password.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setBusy('password');
    setFormError('');
    try {
      await signInEmail({ email: form.email.trim(), password: form.password });
      toast.success('Welcome back');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'We couldn’t sign you in.'));
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy('google');
    setFormError('');
    try {
      await signInGoogle();
      toast.success('Signed in with Google');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const code = error?.code || '';
      if (code === 'auth/account-exists-with-different-credential') {
        const methods = await describeEmailMethods(form.email);
        const guidance = linkGuidance(methods);
        setFormError(guidance.message);
        emailRef.current?.focus();
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setFormError('Google sign-in was cancelled.');
      } else {
        setFormError(errorMessage(error, 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={
        <>
          Pick up where you <em>left off</em>
        </>
      }
      subtitle="Sign in to keep your conversations moving."
      footer={
        <>
          New to Chazter? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogle} loading={busy === 'google'} disabled={busy === 'password'} />

      <div className="auth-divider" role="separator">
        <span>or with email</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          leading={<AtSign size={16} aria-hidden="true" />}
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          required
        />
        <div className="auth-form__row">
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            leading={<Lock size={16} aria-hidden="true" />}
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            required
          />
        </div>

        <div className="auth-form__aside">
          <Link to="/forgot-password" className="auth-link">
            Forgot your password?
          </Link>
        </div>

        {formError ? (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" fullWidth loading={busy === 'password'} disabled={busy === 'google'}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
