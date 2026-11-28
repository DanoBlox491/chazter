import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, Check, LogOut, Sparkles } from 'lucide-react';
import { BrandLockup } from '../components/brand/Brand.jsx';
import { Field, TextArea } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { onboardingDefaults } from '../lib/services/authFlow.js';
import {
  validateUsername,
  validateDisplayName,
  validateBio,
  normaliseUsername,
  suggestUsername,
  BIO_MAX,
  USERNAME_MAX,
} from '../lib/utils/validation.js';
import { isUsernameAvailable } from '../lib/services/userService.js';
import { uploadAvatar, validateImageFile } from '../lib/services/storageService.js';
import { errorMessage } from '../lib/utils/errors.js';
import { cx } from '../lib/utils/general.js';

/**
 * Onboarding — profile setup for every new account, Google or email.
 *
 * The username check runs live AND is enforced transactionally on submit.
 * Avatar upload is optional and degrades gracefully when Storage isn't
 * configured (Google photos are used as-is).
 */
export function WelcomePage() {
  const { firebaseUser, completeOnboarding, signOutUser, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const fileRef = useRef(null);

  const defaults = useMemo(() => onboardingDefaults(firebaseUser), [firebaseUser]);
  const prefill = location.state?.prefill || {};

  const [form, setForm] = useState({
    displayName: prefill.displayName || defaults.displayName || '',
    username: prefill.username || suggestUsername(prefill.displayName || defaults.displayName || defaults.email),
    bio: '',
    photoURL: defaults.photoURL || '',
  });
  const [errors, setErrors] = useState({});
  const [availability, setAvailability] = useState({ state: 'idle', message: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    document.title = 'Set up your profile · Chazter';
  }, []);

  // Returning users who already finished onboarding shouldn't see this page.
  useEffect(() => {
    if (user?.onboardingComplete) navigate('/app', { replace: true });
  }, [user, navigate]);

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
    let cancelled = false;
    setAvailability({ state: 'checking', message: 'Checking availability…' });
    const timer = setTimeout(async () => {
      try {
        const result = await isUsernameAvailable(raw);
        if (cancelled) return;
        setAvailability({
          state: result.available ? 'available' : 'taken',
          message: result.available ? `@${normaliseUsername(raw)} is available` : result.reason,
        });
      } catch {
        if (!cancelled) setAvailability({ state: 'idle', message: '' });
      }
    }, 400);
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

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const fileError = validateImageFile(file);
    if (fileError) {
      toast.error('That image can’t be used', fileError);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadAvatar({ file, uid: firebaseUser.uid, onProgress: setUploadProgress });
      setForm((current) => ({ ...current, photoURL: result.url }));
      toast.success('Photo added');
    } catch (error) {
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      displayName: validateDisplayName(form.displayName),
      username: validateUsername(form.username),
      bio: validateBio(form.bio),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    if (availability.state === 'taken') {
      setErrors({ username: availability.message });
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      await completeOnboarding({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        bio: form.bio,
        photoURL: form.photoURL,
      });
      toast.success('You’re all set', 'Welcome to Chazter.');
      navigate('/app', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'We couldn’t save your profile. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="onboarding">
      <div className="ambient" aria-hidden="true" />
      <header className="onboarding__header">
        <BrandLockup size={30} />
        <div className="onboarding__header-right">
          <span className="onboarding__step">
            <Sparkles size={14} aria-hidden="true" /> Almost there
          </span>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="onboarding__main page-fade">
        <div className="onboarding__intro">
          <span className="eyebrow">Step 1 of 1 · Your profile</span>
          <h1 className="onboarding__title display">
            Make it <em>yours</em>.
          </h1>
          <p className="onboarding__lede">
            This is how people will find and recognise you on Chazter. Your username is your
            unique handle — it can’t be changed to one someone else already has.
          </p>

          <div className="onboarding__preview">
            <Avatar src={form.photoURL} name={form.displayName || 'You'} size={72} ring />
            <div>
              <p className="onboarding__preview-name">{form.displayName || 'Your name'}</p>
              <p className="onboarding__preview-handle">
                @{normaliseUsername(form.username) || 'username'}
              </p>
              {form.bio ? <p className="onboarding__preview-bio">{form.bio}</p> : null}
            </div>
          </div>
        </div>

        <form className="onboarding__form" onSubmit={handleSubmit} noValidate>
          <div className="avatar-upload">
            <button
              type="button"
              className={cx('avatar-upload__target', uploading && 'is-uploading')}
              onClick={() => fileRef.current?.click()}
              aria-label="Upload a profile photo"
            >
              <Avatar src={form.photoURL} name={form.displayName || 'You'} size={84} />
              <span className="avatar-upload__badge" aria-hidden="true">
                <Camera size={15} />
              </span>
              {uploading ? (
                <span className="avatar-upload__progress" style={{ '--progress': uploadProgress }} />
              ) : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleAvatar}
              tabIndex={-1}
            />
            <div>
              <p className="avatar-upload__title">Profile photo</p>
              <p className="avatar-upload__hint">
                {uploading ? `Uploading… ${Math.round(uploadProgress * 100)}%` : 'Optional · JPG, PNG or WebP up to 5 MB'}
              </p>
            </div>
          </div>

          <Field
            label="Display name"
            name="displayName"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={form.displayName}
            onChange={update('displayName')}
            error={errors.displayName}
            maxLength={40}
            required
            data-autofocus
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
            hint={
              availability.message ||
              `3–${USERNAME_MAX} characters · letters, numbers, dots, underscores, hyphens`
            }
            success={availability.state === 'available'}
            maxLength={USERNAME_MAX}
            required
            trailing={
              availability.state === 'available' ? (
                <span className="field__valid" aria-hidden="true">
                  <Check size={16} />
                </span>
              ) : null
            }
          />

          <TextArea
            label="Bio"
            name="bio"
            placeholder="A line or two about you — what you’re working on, what you love."
            value={form.bio}
            onChange={update('bio')}
            error={errors.bio}
            maxLength={BIO_MAX}
            rows={3}
            hint="Optional · shown on your profile"
          />

          {formError ? (
            <p className="auth-alert" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={busy} icon={Check}>
            Enter Chazter
          </Button>
        </form>
      </main>
    </div>
  );
}
