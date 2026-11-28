import { Info, RotateCw } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { ReleaseBadge } from '../system/UpdateChecker.jsx';
import { useWorkspace } from '../../context/NewChatContext.jsx';
import { formatBuildTime, shortBuildId } from '../../lib/utils/releases.js';

/**
 * About — build identity and the manual "check for updates" entry point.
 *
 * Reads the shared update state from the workspace context so there is only
 * ever one polling loop and one opinion about whether an update exists.
 */
export function AboutSettings() {
  const { update, openUpdateDialog } = useWorkspace();
  const latest = update?.latest;

  return (
    <section className="settings-panel">
      <header className="settings-panel__head">
        <div>
          <h2 className="settings-panel__title">About Chazter</h2>
          <p className="settings-panel__lede">
            Which build you’re running, and whether a newer one has been published.
          </p>
        </div>
        <ReleaseBadge status={update?.status || 'idle'} />
      </header>

      <dl className="about-grid">
        <div className="about-grid__row">
          <dt>Version</dt>
          <dd>
            {update?.running?.version || '—'}
            <span className="about-grid__hint"> from package.json</span>
          </dd>
        </div>
        <div className="about-grid__row">
          <dt>Build</dt>
          <dd>
            <code>{shortBuildId(update?.running?.buildId)}</code>
          </dd>
        </div>
        <div className="about-grid__row">
          <dt>Built on</dt>
          <dd>{formatBuildTime(update?.running?.builtAt)}</dd>
        </div>
        <div className="about-grid__row">
          <dt>Latest published</dt>
          <dd>
            {latest ? (
              <>
                <code>{shortBuildId(latest.buildId)}</code>
                <span className="about-grid__hint"> v{latest.version}</span>
              </>
            ) : (
              'not available'
            )}
          </dd>
        </div>
        <div className="about-grid__row">
          <dt>Update channel</dt>
          <dd>stable · checked every 5 minutes</dd>
        </div>
      </dl>

      <p className="settings-panel__note">
        Chazter is a live web app, so there is nothing to install. When a new build is
        published, a banner appears and you can reload into it — you stay signed in, and your
        drafts are kept.
      </p>

      <div className="about-actions">
        <Button
          variant="outline"
          size="md"
          icon={RotateCw}
          loading={update?.status === 'checking'}
          onClick={() => update?.check({ silent: false })}
        >
          Check for updates
        </Button>
        <Button variant="quiet" size="md" icon={Info} onClick={openUpdateDialog}>
          Release notes
        </Button>
      </div>
    </section>
  );
}
