import { createContext, useContext } from 'react';

/**
 * Shared workspace state provided by <AppShell>: the live conversation list,
 * unread totals and the new-chat composer controls.
 */
export const NewChatContext = createContext(null);

export function useWorkspace() {
  const context = useContext(NewChatContext);
  if (!context) throw new Error('useWorkspace must be used inside <AppShell>');
  return context;
}
