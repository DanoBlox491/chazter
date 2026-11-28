import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, RefreshCw, ShieldOff } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createInvite,
  inviteUrl,
  listInvites,
  revokeInvite,
} from '../../lib/services/serverService.js';
import { INVITE_TYPES } from '../../lib/services/models.js';
import { errorMessage } from '../../lib/utils/errors.js';

/**
 * InviteDialog — mint and manage no-expiry invite links.
 *
 * Deliberately explicit about the trade-off: a link that never expires is a
 * convenience and a standing risk, so the copy says so and revocation is one
 * click away. Saying "no expiry" without offering revocation would be
 * irresponsible.
 */
export function InviteDialog({ open, onClose, type, targetId, targetName, canCreate = true }) {
  const toast = useToast();
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState('');
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const list = await listInvites({ type, targetId });
      setInvites(list);
      setError('');
    } catch (loadError) {
      // A member without admin rights cannot list invites — that is expected,
      // not an error worth shouting about.
      setError(loadError?.code === 'permission-denied' ? 'admins-only' : errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [type, targetId]);

  useEffect(() => {
    if (open) {
      setCreated(null);
      setCopied('');
      load();
    }
  }, [open, load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const invite = await createInvite(user, { type, targetId, targetName });
      setCreated(invite);
      await load();
      toast.success('Invite created', 'This link never expires — revoke it any time.');
    } catch (createError) {
      toast.error('Could not create invite', errorMessage(createError));
    } finally {
      setCreating(false);
    }
  };

  const copy = async (code) => {
    const url = inviteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      toast.success('Link copied');
      setTimeout(() => setCopied(''), 1800);
    } catch {
      // Clipboard access can be denied; show the link so it can be copied by
      // hand rather than silently failing.
      toast.info('Copy this link', url);
    }
  };

  const handleRevoke = async (code) => {
    try {
      await revokeInvite(code);
      await load();
      toast.info('Invite revoked', 'That link no longer works.');
    } catch (revokeError) {
      toast.error('Could not revoke', errorMessage(revokeError));
    }
  };

  const kind = type === INVITE_TYPES.server ? 'server' : 'group';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invite people to this ${kind}`}
      description="Anyone signed in to Chazter who opens the link joins automatically."
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Done
          </Button>
          {canCreate ? (
            <Button variant="solid" icon={Link2} onClick={handleCreate} loading={creating}>
              Create link
            </Button>
          ) : null}
        </>
      }
    >
      <div className="invite-panel">
        {created ? (
          <div className="invite-panel__fresh">
            <p className="invite-panel__fresh-label">New link — copy it now</p>
            <div className="invite-panel__link">
              <code>{inviteUrl(created.code)}</code>
              <Button
                variant="outline"
                size="sm"
                icon={copied === created.code ? Check : Copy}
                onClick={() => copy(created.code)}
              >
                {copied === created.code ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="invite-panel__warn">
              This link never expires. Anyone who has it can join until you revoke it.
            </p>
          </div>
        ) : null}

        <div className="invite-panel__list-head">
          <h3 className="invite-panel__list-title">Active links</h3>
          <button type="button" className="link-btn" onClick={load} disabled={loading}>
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </button>
        </div>

        {error === 'admins-only' ? (
          <p className="invite-panel__note">
            Only owners and admins can see the invite list for this {kind}.
          </p>
        ) : null}

        {loading ? (
          <p className="invite-panel__note">Loading links…</p>
        ) : invites.length ? (
          <ul className="invite-list">
            {invites.map((invite) => (
              <li key={invite.code} className="invite-list__row">
                <div className="invite-list__info">
                  <code className="invite-list__code">{invite.code}</code>
                  <span className="invite-list__meta">
                    {invite.uses === 0 ? 'Never used' : `${invite.uses} join${invite.uses === 1 ? '' : 's'}`}
                    {' · '}
                    by {invite.createdByName || 'an admin'}
                  </span>
                </div>
                <div className="invite-list__actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => copy(invite.code)}
                    aria-label={`Copy invite ${invite.code}`}
                  >
                    {copied === invite.code ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    className="link-btn link-btn--danger"
                    onClick={() => handleRevoke(invite.code)}
                    aria-label={`Revoke invite ${invite.code}`}
                  >
                    <ShieldOff size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : error && error !== 'admins-only' ? (
          <p className="invite-panel__note">{error}</p>
        ) : (
          <p className="invite-panel__note">No active links yet.</p>
        )}
      </div>
    </Modal>
  );
}
