import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  KeyRound,
  LogOut,
  Mail,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { Field, TextArea } from '../components/ui/Field.jsx';
import { Switch, SectionHeader } from '../components/ui/Misc.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { GoogleIcon } from '../components/brand/GoogleIcon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  validateDisplayName,
  validateBio,
  validateUsername,
  validateEmail,
  validatePassword,
  normaliseUsername,
  BIO_MAX,
} from '../lib/utils/validation.js';
import { isUsernameAvailable, updateUserProfile } from '../lib/services/userService.js';
import { uploadAvatar, validateImageFile } from '../lib/services/storageService.js';
import {
  linkEmailPasswordToCurrentUser,
  linkGoogleToCurrentUser,
  getLinkedProviders,
  updateAuthDisplayName,
  updateAuthPassword,
} from '../lib/firebase/auth.js';
import { errorMessage } from '../lib/utils/errors.js';
import { formatMonthYear } from '../lib/utils/time.js';
import { cx } from '../lib/utils/general.js';

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'account', label: 'Account & security', icon: ShieldCheck },
];

/** Settings — profile editing, theme and account/security controls. */
export default function SettingsPage() {
  const { user, signOutUser, replaceProfile } = useAuth();
  const [tab, setTab] = useState('profile');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Settings · Chazter';
  }, []);

  return (
    <div className="settings">
      <div className="settings__topbar">
        <IconButton icon={ArrowLeft} label="Back to chats" onClick={() => navigate('/app')} />
        <h1 className="settings__title">Settings</h1>
        <span />
      </div>

      <div className="settings__layout">
        <nav className="settings__tabs" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cx('settings__tab', tab === id && 'is-active')}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          <div className="settings__tabs-spacer" />
          <button
            type="button"
            className="settings__tab settings__tab--danger"
            onClick={async () => {
              await signOutUser();
              navigate('/signin', { replace: true });
            }}
          >
            <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </nav>

        <div className="settings__content page-fade">
          {tab === 'profile' ? <ProfileSettings user={user} replaceProfile={replaceProfile} /> : null}
          {tab === 'appearance' ? <AppearanceSettings /> : null}
          {tab === 'account' ? <AccountSettings user={user} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */
function ProfileSettings({ user, replaceProfile }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    photoURL: user?.photoURL || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [usernameState, setUsernameState] = useState({ state: 'idle', message: '' });
  const [savedBeat, setSavedBeat] = useState(false);

  const usernameChanged = normaliseUsername(form.username) !== (user?.usernameLower || user?.username || '').toLowerCase();

  useEffect(() => {
    if (!usernameChanged) {
      setUsernameState({ state: 'idle', message: '' });
      return undefined;
    }
    const error = validateUsername(form.username);
    if (error) {
      setUsernameState({ state: 'invalid', message: error });
      return undefined;
    }
    let cancelled = false;
    setUsernameState({ state: 'checking', message: 'Checking…' });
    const timer = setTimeout(() => {
      isUsernameAvailable(form.username)
        .then((result) => {
          if (cancelled) return;
          setUsernameState({
            state: result.available ? 'available' : 'taken',
            message: result.available ? `@${normaliseUsername(form.username)} is available` : result.reason,
          });
        })
        .catch(() => {});
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.username, usernameChanged]);

  const handleSave = async (event) => {
    event.preventDefault();
    const nextErrors = {
      displayName: validateDisplayName(form.displayName),
      username: validateUsername(form.username),
      bio: validateBio(form.bio),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    if (usernameState.state === 'taken') {
      setErrors({ username: usernameState.message });
      return;
    }

    setSaving(true);
    try {
      const patch = {};
      if (form.displayName.trim() !== user.displayName) patch.displayName = form.displayName.trim();
      if (form.bio.trim() !== (user.bio || '')) patch.bio = form.bio.trim();
      if (usernameChanged) patch.username = form.username.trim();
      if (form.photoURL !== user.photoURL) patch.photoURL = form.photoURL;

      if (Object.keys(patch).length === 0) {
        toast.info('Nothing to save', 'Your profile is already up to date.');
        setSaving(false);
        return;
      }

      const updated = await updateUserProfile(user.uid, patch);
      if (patch.displayName) await updateAuthDisplayName(patch.displayName).catch(() => {});
      replaceProfile({ ...user, ...patch, ...updated });
      toast.success('Profile saved');
      setSavedBeat(true);
      setTimeout(() => setSavedBeat(false), 1800);
    } catch (error) {
      toast.error('Could not save', errorMessage(error));
    } finally {
      setSaving(false);
    }
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
    try {
      const { url } = await uploadAvatar({ file, uid: user.uid });
      setForm((current) => ({ ...current, photoURL: url }));
      toast.success('Photo updated', 'Save your profile to apply it.');
    } catch (error) {
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="settings-panel" onSubmit={handleSave} noValidate>
      <header className="settings-panel__head">
        <div>
          <h2 className="settings-panel__title">Your profile</h2>
          <p className="settings-panel__lede">This is how you appear to everyone on Chazter.</p>
        </div>
        {savedBeat ? (
          <span className="settings-panel__saved">
            <Check size={14} aria-hidden="true" /> Saved
          </span>
        ) : null}
      </header>

      <div className="avatar-upload">
        <button
          type="button"
          className={cx('avatar-upload__target', uploading && 'is-uploading')}
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
        >
          <Avatar src={form.photoURL} name={form.displayName || 'You'} size={80} />
          <span className="avatar-upload__badge" aria-hidden="true">
            <Camera size={15} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatar} tabIndex={-1} />
        <div>
          <p className="avatar-upload__title">Profile photo</p>
          <p className="avatar-upload__hint">
            {uploading ? 'Uploading…' : 'Square images look best · up to 5 MB'}
          </p>
          <div className="avatar-upload__links">
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              Change
            </button>
            {form.photoURL ? (
              <button
                type="button"
                className="link-btn link-btn--danger"
                onClick={() => setForm((current) => ({ ...current, photoURL: '' }))}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Field
        label="Display name"
        value={form.displayName}
        onChange={(event) => {
          setForm((current) => ({ ...current, displayName: event.target.value }));
          setErrors((current) => ({ ...current, displayName: '' }));
        }}
        error={errors.displayName}
        maxLength={40}
        required
      />

      <Field
        label="Username"
        leading={<span aria-hidden="true">@</span>}
        value={form.username}
        onChange={(event) => {
          setForm((current) => ({ ...current, username: event.target.value.replace(/\s+/g, '').toLowerCase() }));
          setErrors((current) => ({ ...current, username: '' }));
        }}
        error={errors.username}
        hint={usernameState.message || 'Changing this frees your old handle for others.'}
        success={usernameState.state === 'available'}
        maxLength={24}
        required
      />

      <TextArea
        label="Bio"
        value={form.bio}
        onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
        error={errors.bio}
        maxLength={BIO_MAX}
        rows={3}
        hint="A short line shown on your profile."
      />

      <div className="settings-panel__footer">
        <Button type="submit" variant="solid" loading={saving} icon={Check}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Appearance
 * ------------------------------------------------------------------ */
function AppearanceSettings() {
  const { preference, resolved, setTheme } = useTheme();
  return (
    <section className="settings-panel">
      <header className="settings-panel__head">
        <div>
          <h2 className="settings-panel__title">Appearance</h2>
          <p className="settings-panel__lede">Choose how Chazter looks on this device.</p>
        </div>
      </header>

      <div className="theme-preview-grid">
        {[
          { id: 'light', label: 'Light', icon: Sun, hint: 'Warm parchment' },
          { id: 'dark', label: 'Dark', icon: Moon, hint: 'Deep ink' },
          { id: 'system', label: 'System', icon: Monitor, hint: 'Follows your OS' },
        ].map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            type="button"
            className={cx('theme-tile', preference === id && 'is-active')}
            onClick={() => setTheme(id)}
            aria-pressed={preference === id}
          >
            <span className={cx('theme-tile__swatch', `theme-tile__swatch--${id}`)}>
              <span className="theme-tile__bubble theme-tile__bubble--in" />
              <span className="theme-tile__bubble theme-tile__bubble--out" />
            </span>
            <span className="theme-tile__label">
              <Icon size={14} aria-hidden="true" /> {label}
            </span>
            <span className="theme-tile__hint">{hint}</span>
          </button>
        ))}
      </div>

      <p className="settings-panel__note">
        Currently showing the <strong>{resolved}</strong> theme. System mode follows your
        device appearance as it changes through the day.
      </p>

      <SectionHeader title="Message preferences" />
      <Switch
        id="pref-compact"
        label="Reduce motion"
        description="Turn off decorative animations and transitions across the app."
        checked={false}
        onChange={() => {}}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Account & security
 * ------------------------------------------------------------------ */
function AccountSettings({ user }) {
  const toast = useToast();
  const { firebaseUser } = useAuth();
  const [providers, setProviders] = useState(() => getLinkedProviders());
  const [email, setEmail] = useState(firebaseUser?.email || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [verifyState, setVerifyState] = useState('idle');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [linkBusy, setLinkBusy] = useState(null);
  const [linkEmailOpen, setLinkEmailOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ email: '', password: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasPassword = providers.includes('password');
  const hasGoogle = providers.includes('google.com');
  const emailError = validateEmail(email);
  const newPasswordError = newPassword ? validatePassword(newPassword) : '';

  const refreshProviders = () => setProviders(getLinkedProviders());

  const handleLinkGoogle = async () => {
    setLinkBusy('google');
    try {
      await linkGoogleToCurrentUser();
      refreshProviders();
      toast.success('Google connected', 'You can now sign in with Google too.');
    } catch (error) {
      toast.error('Could not connect Google', errorMessage(error));
    } finally {
      setLinkBusy(null);
    }
  };

  const handleLinkEmail = async (event) => {
    event.preventDefault();
    const errors = { email: validateEmail(linkForm.email), password: validatePassword(linkForm.password) };
    if (Object.values(errors).some(Boolean)) {
      toast.error('Check the fields', Object.values(errors).find(Boolean));
      return;
    }
    setLinkBusy('email');
    try {
      await linkEmailPasswordToCurrentUser(linkForm.email, linkForm.password);
      refreshProviders();
      setLinkEmailOpen(false);
      setLinkForm({ email: '', password: '' });
      toast.success('Password added', 'Sign in with your email whenever you like.');
    } catch (error) {
      toast.error('Could not add a password', errorMessage(error));
    } finally {
      setLinkBusy(null);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error('Check your new password', passwordError);
      return;
    }
    if (!currentPassword) {
      toast.error('Enter your current password', 'We need it to confirm it’s you.');
      return;
    }
    setChangingPassword(true);
    try {
      await updateAuthPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password updated');
    } catch (error) {
      toast.error('Could not update password', errorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleVerification = async () => {
    setVerifyState('sending');
    try {
      await sendVerificationNote();
      setVerifyState('sent');
      toast.success('Verification email sent');
    } catch (error) {
      setVerifyState('idle');
      toast.error('Could not send email', errorMessage(error));
    }
  };

  return (
    <div className="settings-panel">
      <header className="settings-panel__head">
        <div>
          <h2 className="settings-panel__title">Account &amp; security</h2>
          <p className="settings-panel__lede">Manage how you sign in and keep your account safe.</p>
        </div>
      </header>

      <section className="settings-card">
        <h3 className="settings-card__title">Sign-in methods</h3>
        <div className="method-list">
          <div className="method-row">
            <span className="method-row__icon method-row__icon--google">
              <GoogleIcon size={18} />
            </span>
            <div className="method-row__info">
              <p className="method-row__name">Google</p>
              <p className="method-row__meta">
                {hasGoogle ? firebaseUser?.providerData?.find((p) => p.providerId === 'google.com')?.email || 'Connected' : 'Not connected'}
              </p>
            </div>
            {hasGoogle ? (
              <span className="method-row__pill method-row__pill--on">Connected</span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLinkGoogle}
                loading={linkBusy === 'google'}
              >
                Connect
              </Button>
            )}
          </div>

          <div className="method-row">
            <span className="method-row__icon">
              <AtSign size={17} />
            </span>
            <div className="method-row__info">
              <p className="method-row__name">Email &amp; password</p>
              <p className="method-row__meta">{hasPassword ? user?.email || firebaseUser?.email : 'Not connected'}</p>
            </div>
            {hasPassword ? (
              <span className="method-row__pill method-row__pill--on">Connected</span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLinkEmailOpen(true)}>
                Add password
              </Button>
            )}
          </div>
        </div>
        <p className="settings-card__note">
          Linking both methods keeps one profile. We never automatically merge accounts — if an
          email already exists, sign in to that account and connect the other method from here.
        </p>
      </section>

      <section className="settings-card">
        <h3 className="settings-card__title">Email address</h3>
        <div className="settings-card__row">
          <Field
            label="Email"
            type="email"
            leading={<Mail size={15} aria-hidden="true" />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={
              email && emailError && email !== firebaseUser?.email ? emailError : ''
            }
            hint="Changing your email re-sends verification."
            autoComplete="email"
          />
          <Button
            variant="outline"
            onClick={async () => {
              if (emailError || email === firebaseUser?.email) return;
              setSavingEmail(true);
              try {
                const { updateEmail } = await import('firebase/auth');
                await updateEmail(firebaseUser, email.trim());
                await updateUserProfile(user.uid, {});
                toast.success('Email updated', 'Check your inbox to verify it.');
              } catch (error) {
                if (error?.code === 'auth/requires-recent-login') {
                  toast.error('Confirm your identity', 'Sign out and back in, then try again.');
                } else {
                  toast.error('Could not update email', errorMessage(error));
                }
              } finally {
                setSavingEmail(false);
              }
            }}
            loading={savingEmail}
            disabled={Boolean(emailError) || email === firebaseUser?.email}
          >
            Update
          </Button>
        </div>
        {firebaseUser && firebaseUser.email && !firebaseUser.emailVerified && hasPassword ? (
          <div className="verify-banner">
            <div>
              <p className="verify-banner__title">Your email isn’t verified yet</p>
              <p className="verify-banner__text">Verify it to unlock password recovery and account security.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleVerification} loading={verifyState === 'sending'}>
              {verifyState === 'sent' ? 'Resend email' : 'Send verification'}
            </Button>
          </div>
        ) : null}
      </section>

      {hasPassword ? (
        <section className="settings-card">
          <h3 className="settings-card__title">Change password</h3>
          <form className="settings-card__form" onSubmit={handlePasswordChange} noValidate>
            <Field
              label="Current password"
              type="password"
              leading={<KeyRound size={15} aria-hidden="true" />}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Field
              label="New password"
              type="password"
              leading={<KeyRound size={15} aria-hidden="true" />}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={newPasswordError}
              hint="At least 8 characters, with a letter and a number."
              autoComplete="new-password"
            />
            <div>
              <Button type="submit" variant="solid" size="md" loading={changingPassword} disabled={!currentPassword || !newPassword}>
                Update password
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="settings-card settings-card--muted">
        <h3 className="settings-card__title">Session</h3>
        <p className="settings-card__note">
          Member since {formatMonthYear(user?.createdAt)} · signed in as{' '}
          <strong>{firebaseUser?.email || 'Chazter account'}</strong>
        </p>
        <SignOutButton />
      </section>

      <section className="settings-card settings-card--danger">
        <h3 className="settings-card__title">Danger zone</h3>
        <p className="settings-card__note">
          Deleting your account removes your profile and handle. Messages you’ve sent to others
          stay in their conversations, marked as removed.
        </p>
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setDeleteOpen(true)}>
          Delete my account
        </Button>
      </section>

      <Modal
        open={linkEmailOpen}
        onClose={() => setLinkEmailOpen(false)}
        title="Add a password"
        description="You’ll be able to sign in with this email and password as well as Google."
        footer={
          <>
            <Button variant="quiet" onClick={() => setLinkEmailOpen(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={handleLinkEmail} loading={linkBusy === 'email'}>
              Connect
            </Button>
          </>
        }
      >
        <form className="stack" style={{ gap: '1rem' }} onSubmit={handleLinkEmail}>
          <Field
            label="Email"
            type="email"
            value={linkForm.email}
            onChange={(event) => setLinkForm((current) => ({ ...current, email: event.target.value }))}
            required
            data-autofocus
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={linkForm.password}
            onChange={(event) => setLinkForm((current) => ({ ...current, password: event.target.value }))}
            required
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
          />
        </form>
      </Modal>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

function SignOutButton() {
  const { signOutUser } = useAuth();
  const navigate = useNavigate();
  return (
    <Button
      variant="quiet"
      size="md"
      icon={LogOut}
      onClick={async () => {
        await signOutUser();
        navigate('/signin', { replace: true });
      }}
    >
      Sign out of this device
    </Button>
  );
}

async function sendVerificationNote() {
  const { resendVerificationEmail } = await import('../lib/firebase/auth.js');
  return resendVerificationEmail();
}

function DeleteAccountDialog({ open, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setBusy(true);
    try {
      const [{ deleteAccount }, { deleteUserProfile }] = await Promise.all([
        import('../lib/firebase/auth.js'),
        import('../lib/services/userService.js'),
      ]);
      await deleteUserProfile(user.uid, user.usernameLower || user.username);
      await deleteAccount();
      toast.info('Account deleted', 'Sorry to see you go.');
      navigate('/', { replace: true });
    } catch (error) {
      if (error?.code === 'auth/requires-recent-login') {
        toast.error('Please sign in again', 'For your security, deleting an account needs a fresh sign-in.');
        await signOutUser();
        navigate('/signin', { replace: true });
      } else {
        toast.error('Could not delete account', errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete your account?"
      description="This is permanent. Your profile and @handle are released immediately."
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Keep my account
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={busy} disabled={confirmText !== 'DELETE'}>
            Delete permanently
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <p className="settings-card__note">
          Type <strong>DELETE</strong> to confirm.
        </p>
        <Field
          label="Confirmation"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value.toUpperCase())}
          placeholder="DELETE"
          data-autofocus
        />
      </div>
    </Modal>
  );
}
