import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RotateCw, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  RELEASE_STATUS_LABEL,
  formatBuildTime,
  shortBuildId,
} from '../../lib/utils/releases.js';
import { cx } from '../../lib/utils/general.js';

/** Small status pill, used in Settings. */
export function ReleaseBadge({ status }) {
  return (
    <span className={cx('release-badge', `release-badge--${status}`)}>
      {RELEASE_STATUS_LABEL[status] || status}
    </span>
  );
}

/**
 * The banner. Deliberately not a modal: it sits above the workspace until
 * dismissed or acted on, and remembers the dismissal per build id so it
 * reappears for the *next* release.
 */
export function UpdateBanner({ update, onOpen }) {
  const [dismissedFor, setDismissedFor] = useState(() => {
    try {
      return sessionStorage.getItem('chazter:update-dismissed') || '';
    } catch {
      return '';
    }
  });

  const buildId = update?.latest?.buildId || '';
  if (!update || update.status !== 'stale' || !buildId || buildId === dismissedFor) return null;

  const dismiss = () => {
    setDismissedFor(buildId);
    try {
      sessionStorage.setItem('chazter:update-dismissed', buildId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="update-banner" role="status">
      <span className="update-banner__icon" aria-hidden="true">
        <Sparkles size={16} />
      </span>
      <div className="update-banner__text">
        <p className="update-banner__title">A new version of Chazter is ready</p>
        <p className="update-banner__meta">
          You’re on {shortBuildId(update.running?.buildId)} · latest is {shortBuildId(buildId)}
        </p>
      </div>
      <div className="update-banner__actions">
        <button type="button" className="link-btn" onClick={onOpen}>
          What’s new
        </button>
        <button type="button" className="link-btn update-banner__dismiss" onClick={dismiss}>
          Later
        </button>
      </div>
    </div>
  );
}

/**
 * The full panel: build identity, update status, release notes and the
 * reload action. Also the place people land from Settings → About.
 */
export function UpdateDialog({ open, onClose, update, onCheck, checking }) {
  const toast = useToast();
  const navigate = useNavigate();
  const latest = update?.latest || null;
  const notes = Array.isArray(latest?.notes) ? latest.notes : [];

  const reload = async () => {
    // Clear cached shell/manifest so the reload really fetches new code.
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      /* cache API unavailable — a plain reload is still correct */
    }
    window.location.reload();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={update?.status === 'stale' ? 'Update available' : 'About Chazter'}
      description={
        update?.status === 'stale'
          ? 'A newer build has been published. Reloading keeps you signed in.'
          : 'Build details and the latest release notes.'
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const result = await onCheck?.();
              if (result?.status === 'same') toast.success('You’re up to date');
              else if (result?.status === 'stale') toast.info('Update available');
              else toast.info('Couldn’t check for updates', result?.message);
            }}
            loading={checking}
          >
            Check now
          </Button>
          {update?.status === 'stale' ? (
            <Button variant="solid" icon={RotateCw} onClick={reload}>
              Reload to update
            </Button>
          ) : null}
        </>
      }
    >
      <div className="update-panel">
        <dl className="update-panel__grid">
          <div>
            <dt>Running</dt>
            <dd>
              <code>{shortBuildId(update?.running?.buildId)}</code>
              <span className="update-panel__sub">v{update?.running?.version}</span>
            </dd>
          </div>
          <div>
            <dt>Built</dt>
            <dd>{formatBuildTime(update?.running?.builtAt)}</dd>
          </div>
          <div>
            <dt>Latest published</dt>
            <dd>
              {latest ? (
                <>
                  <code>{shortBuildId(latest.buildId)}</code>
                  <span className="update-panel__sub">v{latest.version}</span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <ReleaseBadge status={update?.status || 'idle'} />
            </dd>
          </div>
        </dl>

        {update?.status === 'error' ? (
          <p className="update-panel__note">
            Couldn’t reach the release manifest ({String(update.error)}). You can still keep
            using Chazter — this only affects update checks.
          </p>
        ) : null}

        {notes.length ? (
          <div className="update-panel__notes">
            <h3 className="update-panel__notes-title">What’s new</h3>
            <ul>
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : latest ? (
          <p className="update-panel__note">
            This build has no release notes published.
          </p>
        ) : null}

        <p className="update-panel__note">
          Chazter is a live web app — there is nothing to download. Reloading picks up a new
          build; your chats, drafts and settings stay exactly where they are.{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/app/settings?tab=about')}>
            About this build
          </button>
        </p>
        <span className="update-panel__download" aria-hidden="true">
          <Download size={14} /> No installation required
        </span>
      </div>
    </Modal>
  );
}
