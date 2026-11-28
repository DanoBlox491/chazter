import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Lock, User } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell.jsx';
import { GoogleButton } from '../components/auth/GoogleButton.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { StrengthMeter } from '../components/ui/Misc.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  passwordStrength,
  normaliseUsername,
} from '../lib/utils/validation.js';
import { errorMessage } from '../lib/utils/errors.js';
import { isUsernameAvailable } from '../lib/services/userService.js';

/**
 * Create a Chazter account.
 *
 * Username uniqueness is checked live (debounced) for fast feedback, then
 * enforced transactionally on save — the client check is a courtesy, the
 * database guarantee is the truth.
 *
 * Order matters: we create the Firebase Auth user first, then the Firestore
 * profile. If profile creation fails, the user stays signed in and lands on
 * the onboarding screen to retry — no orphaned accounts reachable by email
 * without a profile.
 */
export function SignUpPage() {
  const { signUpEmail, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const nameRef = useRef(null);

  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null);
  const [availability, setAvailability] = useState({ state: 'idle', message: '' });
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  useEffect(() => {
    document.title = 'Create your account · Chazter';
    nameRef.current?.focus();
  }, []);

  // Debounced availability probe.
  useEffect(() => {
    const raw = form.username.trim();
    if (!raw) {
      setAvailability({ state: 'idle', message: '' });
      return undefined;
    }
    const clientError = validateUsername(raw);
    if (clientError) {
      setAvailability({ state: 'invalid', message: clientError });
      return undefined;
    }
    setAvailability({ state: 'checking', message: 'Checking availability…' });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await isUsernameAvailable(raw);
        if (cancelled) return;
        setAvailability({
          state: result.available ? 'available' : 'taken',
          message: result.available ? `@${normaliseUsername(raw)} is yours` : result.reason,
        });
      } catch {
        if (!cancelled) setAvailability({ state: 'idle', message: '' });
      }
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.username]);

  const update = (key) => (event) => {
    let value = event.target.value;
    if (key === 'username') value = value.replace(/\s+/g, '').toLowerCase();
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      displayName: form.displayName.trim().length < 2 ? 'Add your name.' : '',
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    if (availability.state === 'taken') {
      setErrors({ username: 'That username is already taken. Try another.' });
      return;
    }

    setBusy('create');
    setFormError('');
    try {
      await signUpEmail({ email: form.email.trim(), password: form.password });
      // Auth user exists — carry the desired profile into onboarding.
      navigate('/welcome', {
        replace: true,
        state: {
          prefill: {
            displayName: form.displayName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
          },
        },
      });
    } catch (error) {
      setFormError(errorMessage(error, 'We couldn’t create your account.'));
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
      navigate('/app', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'Google sign-in failed. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const usernameState =
    availability.state === 'available'
      ? { success: true, hint: availability.message }
      : availability.state === 'checking' || availability.state === 'taken'
        ? { error: availability.state === 'taken' ? availability.message : undefined, hint: availability.message }
        : { hint: availability.message || 'Your public @handle. Letters, numbers, . _ -' };

  return (
    <AuthShell
      eyebrow="Create your account"
      title={
        <>
          Start a better <em>conversation</em>
        </>
      }
      subtitle="Free, private and yours in under a minute."
      footer={
        <>
          Already have an account? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <GoogleButton onDoubleClick={undefined} onClick={handleGoogle} loading={busy === 'google'} disabled={busy === 'create'} label="Sign up with Google" />

      <div className="auth-divider" role="separator">
        <span>or with email</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field
          ref={nameRef}
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          leading={<User size={16} aria-hidden="true" />}
          value={form.displayName}
          onChange={update('displayName')}
          error={errors.displayName}
          maxLength={40}
          required
        />
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          placeholder="ada"
          leading={<span aria-hidden="true">@</span>}
          value={form.username}
          onChange={update('username')}
          error={errors.username || (availability.state === 'taken' ? availability.message : '')}
          hint={usernameState.hint}
          success={availability.state === 'available'}
          maxLength={24}
          required
        />
        <Field
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
        <div>
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            leading={<Lock size={16} aria-hidden="true" />}
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            required
          />
          {form.password ? (
            <div style={{ marginTop: 10 }}>
              <StrengthMeter strength={strength} />
            </div>
          ) : null}
        </div>

        {formError ? (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        ) : null}

        <p className="auth-terms">
          By creating an account you agree to keep Chazter a respectful place. We never store
          your password in plain text.
        </p>

        <Button type="submit" size="lg" fullWidth loading={busy === 'create'} disabled={busy === 'google'}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
