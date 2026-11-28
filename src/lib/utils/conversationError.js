/**
 * User-facing copy for a failed conversations listener.
 *
 * Kept pure and exported so the wording can be tested without mounting the
 * workspace.
 */
export function conversationErrorCopy(error) {
  const code = error?.code || '';
  if (code === 'permission-denied') {
    return {
      title: 'Your chats aren’t available yet',
      description:
        'Chazter can’t read them with the current permissions. This usually means the database rules haven’t been published for this project yet.',
    };
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal') {
    return {
      title: 'Reconnecting…',
      description: 'The connection dropped. Chazter will resume as soon as it’s back.',
    };
  }
  return {
    title: 'We couldn’t load your chats',
    description: 'Something went wrong on the way to the server. Try again in a moment.',
  };
}
