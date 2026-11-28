/**
 * User-facing copy for a failed data listener.
 *
 * Kept pure and exported so the wording can be tested without mounting a
 * screen.
 *
 * The `subject` argument exists because the original version said "your chats"
 * for every failure — including a failure loading **servers**, which is both
 * confusing and, when the cause is an undeployed rules file, actively
 * misleading about what to fix.
 */
export function conversationErrorCopy(error, { subject = 'chats' } = {}) {
  const code = error?.code || '';
  const plural = { chats: 'chats', servers: 'servers', channels: 'channels' }[subject] || subject;

  if (code === 'permission-denied') {
    return {
      title: `Your ${plural} aren’t available yet`,
      description:
        'Chazter can’t read them with the current permissions. This usually means the database rules haven’t been published for this project yet.',
      action: 'deploy-rules',
    };
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal') {
    return {
      title: 'Reconnecting…',
      description: 'The connection dropped. Chazter will resume as soon as it’s back.',
      action: 'retry',
    };
  }
  if (code === 'not-found') {
    return {
      title: `These ${plural} don’t exist`,
      description: 'They may have been deleted. Try another from the list.',
      action: 'back',
    };
  }
  return {
    title: `We couldn’t load your ${plural}`,
    description: 'Something went wrong on the way to the server. Try again in a moment.',
    action: 'retry',
  };
}

/**
 * Extra guidance for the one failure that has a specific, non-obvious fix.
 *
 * This is shown as a copyable command because "the rules haven't been
 * published" is useless if the reader does not know that means running a
 * deploy from their own machine.
 */
export const DEPLOY_RULES_COMMAND = 'npm run deploy:rules';
