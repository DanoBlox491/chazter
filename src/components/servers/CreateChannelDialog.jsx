import { useState } from 'react';
import { Hash } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createChannel, normaliseChannelName, validateChannelName } from '../../lib/services/serverService.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { CHANNEL_TOPIC_MAX } from '../../lib/services/models.js';

export function CreateChannelDialog({ open, onClose, serverId, onCreated }) {
  const toast = useToast();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nameError = validateChannelName(name);
    setError(nameError);
    if (nameError) return;

    setBusy(true);
    try {
      const channelId = await createChannel(serverId, user, { name, topic });
      toast.success(`#${normaliseChannelName(name)} created`);
      setName('');
      setTopic('');
      onClose();
      onCreated?.(channelId);
    } catch (createError) {
      toast.error('Could not create channel', errorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a channel"
      description="Channels are rooms inside this server. Names are lowercase with dashes."
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="solid" onClick={submit} loading={busy} disabled={!normaliseChannelName(name)}>
            Create channel
          </Button>
        </>
      }
    >
      <form className="stack" style={{ gap: '1rem' }} onSubmit={submit}>
        <Field
          label="Channel name"
          leading={<Hash size={15} aria-hidden="true" />}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          error={error}
          hint={
            normaliseChannelName(name) && normaliseChannelName(name) !== name
              ? `Will be created as #${normaliseChannelName(name)}`
              : 'e.g. design, product-updates'
          }
          maxLength={32}
          data-autofocus
          required
        />
        <Field
          label="Topic (optional)"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          hint="Shown at the top of the channel."
          maxLength={CHANNEL_TOPIC_MAX}
        />
      </form>
    </Modal>
  );
}
