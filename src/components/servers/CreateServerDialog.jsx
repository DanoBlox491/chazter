import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createServer, validateServerName } from '../../lib/services/serverService.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { SERVER_NAME_MAX } from '../../lib/services/models.js';

export function CreateServerDialog({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nameError = validateServerName(name);
    setError(nameError);
    if (nameError) return;

    setBusy(true);
    try {
      const { serverId, channelId } = await createServer(user, { name });
      toast.success('Server created', 'Share an invite to bring people in.');
      setName('');
      onClose();
      navigate(`/app/s/${serverId}/c/${channelId}`);
    } catch (createError) {
      toast.error('Could not create server', errorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a server"
      description="A server is a home for your community, with channels for different topics. You can invite people once it exists."
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="solid" onClick={submit} loading={busy} disabled={!name.trim()}>
            Create server
          </Button>
        </>
      }
    >
      <form className="stack" style={{ gap: '1rem' }} onSubmit={submit}>
        <Field
          label="Server name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          error={error}
          hint="You can change this later. A #general channel is created for you."
          maxLength={SERVER_NAME_MAX}
          data-autofocus
          required
        />
      </form>
    </Modal>
  );
}
