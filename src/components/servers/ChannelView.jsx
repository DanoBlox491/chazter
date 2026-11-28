import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Menu, Info } from 'lucide-react';
import { IconButton } from '../ui/Button.jsx';
import { MessageSkeleton, ErrorState, EmptyState } from '../ui/States.jsx';
import { MessageBubble, DayDivider, TypingBubble } from '../chat/MessageBubble.jsx';
import { Composer } from '../chat/Composer.jsx';
import { ImageLightbox } from '../chat/ImageLightbox.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMessages } from '../../hooks/useMessages.js';
import { useTyping } from '../../hooks/useTyping.js';
import { useScrollAnchor } from '../../hooks/useMisc.js';
import { groupMessages } from '../../lib/utils/messageGroups.js';
import { sendMessage, deleteMessage } from '../../lib/services/messageService.js';
import { markConversationRead } from '../../lib/services/conversationService.js';
import { uploadChatImage } from '../../lib/services/storageService.js';
import { randomId } from '../../lib/utils/general.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { conversationErrorCopy } from '../../lib/utils/conversationError.js';

/**
 * ChannelView — messages inside a server channel.
 *
 * Deliberately smaller than ChatWindow: channels have no per-person presence,
 * read-receipt theatre or "delete chat", so none of that machinery is dragged
 * in. It shares the message hook, bubble component, composer and scroll
 * anchoring with 1:1 chats, which is where the value is.
 */
export function ChannelView({ channelId, channel, server, onOpenSidebar }) {
  const { uid, user } = useAuth();
  const toast = useToast();
  const {
    messages,
    loading,
    error,
    hasMore,
    loadingOlder,
    loadOlder,
    receipts,
    appendOptimistic,
    replaceOptimistic,
    dropOptimistic,
  } = useMessages(channelId, uid);
  const { typingNames, signalTyping, stopTyping } = useTyping(channelId, uid, user);
  const scrollRef = useRef(null);
  const { scrollToBottom } = useScrollAnchor(scrollRef, [messages.length, channelId]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (channelId && uid) markConversationRead(channelId, uid).catch(() => {});
  }, [channelId, uid]);

  useEffect(() => {
    if (channel?.name) document.title = `#${channel.name} · Chazter`;
    return () => {
      document.title = 'Chazter';
    };
  }, [channel?.name]);

  // groupMessages returns a flat list of divider/message entries, not nested
  // groups — render it as one sequence.
  const entries = useMemo(() => groupMessages(messages, uid), [messages, uid]);

  const handleSend = useCallback(
    async (text) => {
      const tempId = `temp-${randomId('m')}`;
      const optimistic = {
        id: tempId,
        tempId,
        pending: true,
        type: 'text',
        text,
        senderId: uid,
        senderName: user.displayName,
        senderUsername: user.username,
        senderPhotoURL: user.photoURL,
        createdAt: new Date(),
        clientCreatedAt: Date.now(),
      };
      appendOptimistic(optimistic);
      scrollToBottom('smooth');
      try {
        stopTyping();
        const realId = await sendMessage(channelId, user, { text });
        replaceOptimistic(tempId, { ...optimistic, id: realId, pending: false });
      } catch (sendError) {
        dropOptimistic(tempId);
        toast.error('Message not sent', errorMessage(sendError));
      }
    },
    [channelId, uid, user, appendOptimistic, replaceOptimistic, dropOptimistic, scrollToBottom, stopTyping, toast],
  );

  const handleImage = useCallback(
    async (file) => {
      try {
        const { url, storagePath } = await uploadChatImage(file, channelId);
        await sendMessage(channelId, user, { image: { url, storagePath } });
      } catch (uploadError) {
        toast.error('Could not send that image', errorMessage(uploadError));
      }
    },
    [channelId, user, toast],
  );

  const handleDelete = useCallback(
    async (message) => {
      try {
        await deleteMessage(channelId, message.id, uid);
      } catch (deleteError) {
        toast.error('Could not delete', errorMessage(deleteError));
      }
    },
    [channelId, uid, toast],
  );

  const copy = conversationErrorCopy(error);

  return (
    <div className="channel-view">
      <header className="channel-view__head">
        <IconButton icon={Menu} label="Show channels" onClick={onOpenSidebar} className="channel-view__menu" />
        <span className="channel-view__hash" aria-hidden="true">
          <Hash size={17} strokeWidth={2.2} />
        </span>
        <div className="channel-view__identity">
          <h1 className="channel-view__name">{channel?.name || 'channel'}</h1>
          {channel?.topic ? <p className="channel-view__topic">{channel.topic}</p> : null}
        </div>
        <span className="channel-view__server" title={server?.name}>
          <Info size={13} aria-hidden="true" /> {server?.name}
        </span>
      </header>

      <div className="channel-view__scroll chat-scroll" ref={scrollRef}>
        {hasMore ? (
          <div className="channel-view__older">
            <button type="button" className="link-btn" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        ) : null}

        {loading ? <MessageSkeleton /> : null}

        {error ? (
          <ErrorState
            title={copy.title}
            description={copy.description}
            detail={error?.code}
            onRetry={() => window.location.reload()}
            retryLabel="Reload"
          />
        ) : null}

        {!loading && !error && !messages.length ? (
          <EmptyState
            title={`This is #${channel?.name || 'the channel'}`}
            description="The very beginning. Say something to get it started."
          />
        ) : null}

        {entries.map((entry) =>
          entry.kind === 'divider' ? (
            <DayDivider key={entry.key} label={entry.label} />
          ) : (
            <MessageBubble
              key={entry.message.id}
              message={entry.message}
              isOwn={entry.isOwn}
              showAvatar={entry.showAvatar}
              showSender={entry.showSender}
              groupSize={2}
              cursors={receipts}
              conversationType="group"
              onDelete={handleDelete}
              onOpenImage={() => setLightbox(entry.message)}
            />
          ),
        )}

        {typingNames.length ? (
          <TypingBubble names={typingNames} />
        ) : null}
      </div>

      <Composer
        conversationId={channelId}
        onSend={handleSend}
        onImageSend={handleImage}
        onTyping={signalTyping}
        onStopTyping={stopTyping}
        placeholder={channel?.name ? `Message #${channel.name}` : 'Message the channel'}
      />

      <ImageLightbox
        open={Boolean(lightbox)}
        message={lightbox}
        onClose={() => setLightbox(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}
