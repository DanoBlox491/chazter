import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  BellOff,
  ImageOff,
  Info,
  Search,
} from 'lucide-react';
import { Avatar, GroupAvatar } from '../ui/Avatar.jsx';
import { IconButton } from '../ui/Button.jsx';
import { MessageSkeleton, ErrorState, EmptyState } from '../ui/States.jsx';
import { MessageBubble, DayDivider, TypingBubble } from './MessageBubble.jsx';
import { Composer } from './Composer.jsx';
import { ConversationDetails } from './ConversationDetails.jsx';
import { ImageLightbox } from './ImageLightbox.jsx';
import { MessageSearch } from './MessageSearch.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useWorkspace } from '../../context/NewChatContext.jsx';
import { useMessages } from '../../hooks/useMessages.js';
import { useTyping } from '../../hooks/useTyping.js';
import { useScrollAnchor } from '../../hooks/useMisc.js';
import { conversationDisplay } from '../../lib/utils/conversationDisplay.js';
import { groupMessages } from '../../lib/utils/messageGroups.js';
import { sendMessage, deleteMessage } from '../../lib/services/messageService.js';
import { markConversationRead } from '../../lib/services/conversationService.js';
import { uploadChatImage } from '../../lib/services/storageService.js';
import { isUserOnline } from '../../lib/services/presence.js';
import { cx, randomId } from '../../lib/utils/general.js';
import { formatLastSeen } from '../../lib/utils/time.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { CONVERSATION_TYPES } from '../../lib/services/models.js';

/**
 * ChatWindow — the conversation pane.
 *
 * Responsibilities:
 *  - header (identity, presence/typing, search, details)
 *  - message list with day dividers, grouping and read receipts
 *  - composer with optimistic sending and image upload
 *  - clearing the unread counter when the chat opens
 */
export default function ChatWindow({ conversationId, conversation, onBack }) {
  const { uid, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { conversations } = useWorkspace();
  const liveConversation = conversations.find((entry) => entry.id === conversationId) || conversation;

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
  } = useMessages(conversationId, uid);
  const { typingNames, signalTyping, stopTyping } = useTyping(conversationId, uid, user);
  const scrollRef = useRef(null);
  const { showJumpButton, scrollToBottom } = useScrollAnchor(scrollRef, [messages.length, conversationId]);
  const drafts = useRef(new Map());

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const display = conversationDisplay(liveConversation, uid);
  const isGroup = liveConversation?.type === CONVERSATION_TYPES.group;
  const memberCount = liveConversation?.memberIds?.length || 2;
  const online = display.partner
    ? isUserOnline({ presence: liveConversation?.presence?.[display.partner.uid] })
    : false;

  // Clear unread counter + mark the top of the chat as read.
  useEffect(() => {
    if (!conversationId || !uid) return;
    markConversationRead(conversationId, uid).catch(() => {});
  }, [conversationId, uid]);

  useEffect(() => {
    if (liveConversation) {
      document.title = `${display.title} · Chazter`;
    }
    return () => {
      document.title = 'Chazter';
    };
  }, [display.title, liveConversation]);

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
        const realId = await sendMessage(conversationId, user, { text });
        replaceOptimistic(tempId, { ...optimistic, id: realId, tempId: undefined, pending: false });
      } catch (sendError) {
        dropOptimistic(tempId);
        toast.error('Message not sent', errorMessage(sendError));
      }
    },
    [appendOptimistic, conversationId, dropOptimistic, replaceOptimistic, scrollToBottom, stopTyping, toast, uid, user],
  );

  const handleImageSend = useCallback(
    async ({ file, caption, previewUrl }) => {
      const tempId = `temp-${randomId('img')}`;
      const optimistic = {
        id: tempId,
        tempId,
        pending: true,
        type: 'image',
        text: caption || '',
        image: { url: previewUrl, width: 0, height: 0 },
        senderId: uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        createdAt: new Date(),
        clientCreatedAt: Date.now(),
      };
      appendOptimistic(optimistic);
      try {
        const uploaded = await uploadChatImage({ file, conversationId, uid });
        const realId = await sendMessage(conversationId, user, { text: caption, image: uploaded });
        replaceOptimistic(tempId, {
          ...optimistic,
          id: realId,
          tempId: undefined,
          pending: false,
          image: uploaded,
        });
      } catch (uploadError) {
        dropOptimistic(tempId);
        toast.error('Photo not sent', errorMessage(uploadError));
      }
    },
    [appendOptimistic, conversationId, dropOptimistic, replaceOptimistic, toast, uid, user],
  );

  const handleDelete = useCallback(
    async (message) => {
      try {
        await deleteMessage(conversationId, message.id, uid, { isAdmin: liveConversation?.isAdmin });
        toast.success('Message deleted');
      } catch (deleteError) {
        toast.error('Could not delete', errorMessage(deleteError));
      }
    },
    [conversationId, liveConversation?.isAdmin, toast, uid],
  );

  const jumpToMessage = useCallback((messageId) => {
    const node = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!node) {
      toast.info('That message is further up', 'Scroll back to find it.');
      return;
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 1800);
  }, [toast]);

  const grouped = useMemo(() => groupMessages(messages, uid), [messages, uid]);

  if (!liveConversation && !loading) {
    return (
      <ErrorState
        title="This conversation isn’t available"
        description="It may have been deleted, or you may have left the group."
        onRetry={() => navigate('/app')}
        retryLabel="Back to chats"
      />
    );
  }

  return (
    <div className="chat-window">
      <header className="chat-header">
        <IconButton icon={ArrowLeft} label="Back to conversations" className="chat-header__back" onClick={onBack} />

        <button
          type="button"
          className="chat-header__identity"
          onClick={() => setDetailsOpen(true)}
          aria-label={`Conversation details for ${display.title}`}
        >
          <span className="chat-header__avatar">
            {isGroup ? (
              <GroupAvatar conversation={liveConversation} size={42} />
            ) : (
              <Avatar
                src={display.partner?.photoURL}
                name={display.title}
                userId={display.partner?.uid}
                size={42}
                showStatus={Boolean(display.partner)}
                online={online}
              />
            )}
          </span>
          <span className="chat-header__text">
            <span className="chat-header__name truncate">{display.title}</span>
            <span className="chat-header__status">
              {typingNames.length ? (
                <span className="chat-header__typing">
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing…`
                    : typingNames.length === 2
                      ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                      : 'Several people are typing…'}
                </span>
              ) : isGroup ? (
                <>
                  {liveConversation?.memberIds?.length || 0} members
                  {liveConversation?.muted ? (
                    <>
                      {' '}
                      · <BellOff size={11} aria-hidden="true" style={{ display: 'inline' }} /> muted
                    </>
                  ) : null}
                </>
              ) : online ? (
                <span className="chat-header__online">
                  <span className="chat-header__dot" aria-hidden="true" /> Online
                </span>
              ) : (
                formatLastSeen(liveConversation?.presence?.[display.partner?.uid]?.lastActiveAt)
              )}
            </span>
          </span>
        </button>

        <div className="chat-header__actions">
          <IconButton
            icon={Search}
            label="Search this conversation"
            onClick={() => setSearchOpen((current) => !current)}
            aria-pressed={searchOpen}
          />
          <IconButton icon={Info} label="Conversation details" onClick={() => setDetailsOpen(true)} />
        </div>
      </header>

      {searchOpen ? (
        <MessageSearch
          conversationId={conversationId}
          conversationTitle={display.title}
          onClose={() => setSearchOpen(false)}
          onJump={jumpToMessage}
        />
      ) : null}

      <div className="chat-body" ref={scrollRef} tabIndex={-1}>
        {loading ? (
          <MessageSkeleton />
        ) : error ? (
          <ErrorState
            title="Messages didn’t load"
            description="We’ll keep trying. Check your connection."
            onRetry={() => window.location.reload()}
          />
        ) : messages.length === 0 ? (
          <ChatStartEmpty conversation={liveConversation} display={display} isGroup={isGroup} />
        ) : (
          <>
            {hasMore ? (
              <div className="chat-body__more">
                <button type="button" className="load-more" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </button>
              </div>
            ) : (
              <div className="chat-start">
                <div className="chat-start__mark">
                  {isGroup ? (
                    <GroupAvatar conversation={liveConversation} size={40} />
                  ) : (
                    <Avatar
                      src={display.partner?.photoURL}
                      name={display.title}
                      userId={display.partner?.uid}
                      size={40}
                    />
                  )}
                </div>
                <p className="chat-start__text">
                  This is the beginning of your conversation with <strong>{display.title}</strong>.
                </p>
              </div>
            )}

            <ol className="msg-list">
              {grouped.map((entry) => {
                if (entry.kind === 'divider') {
                  return (
                    <li key={entry.key}>
                      <DayDivider label={entry.label} />
                    </li>
                  );
                }
                const { message, isOwn, showAvatar, showSender, previousSender } = entry;
                return (
                  <li
                    key={message.id}
                    data-message-id={message.id}
                    className={cx(
                      'msg-list__item',
                      previousSender === message.senderId && 'msg-list__item--grouped',
                    )}
                  >
                    <MessageBubble
                      message={message}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      showSender={showSender}
                      groupSize={memberCount}
                      cursors={receipts}
                      conversationType={liveConversation?.type}
                      onDelete={handleDelete}
                      onOpenImage={setLightbox}
                      onJumpTo={jumpToMessage}
                      isHighlighted={highlightId === message.id}
                    />
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {typingNames.length ? <TypingBubble names={typingNames} /> : null}
      </div>

      {showJumpButton ? (
        <button type="button" className="jump-latest" onClick={() => scrollToBottom('smooth')}>
          <ArrowDown size={15} aria-hidden="true" />
          <span>Latest</span>
        </button>
      ) : null}

      <Composer
        conversationId={conversationId}
        onSend={handleSend}
        onImageSend={handleImageSend}
        onTyping={signalTyping}
        onStopTyping={stopTyping}
        drafts={drafts.current}
        placeholder={
          isGroup ? `Message ${liveConversation?.name || 'the group'}…` : `Message ${display.title}…`
        }
      />

      <ConversationDetails
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        conversation={liveConversation}
        uid={uid}
        onOpenImage={setLightbox}
      />

      <ImageLightbox
        open={Boolean(lightbox)}
        message={lightbox}
        onClose={() => setLightbox(null)}
        onDelete={
          lightbox?.senderId === uid
            ? async () => {
                await handleDelete(lightbox);
                setLightbox(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function ChatStartEmpty({ conversation, display, isGroup }) {
  return (
    <div className="chat-empty">
      <div className="chat-empty__avatar">
        {isGroup ? (
          <GroupAvatar conversation={conversation} size={64} />
        ) : (
          <Avatar src={display.partner?.photoURL} name={display.title} userId={display.partner?.uid} size={64} />
        )}
      </div>
      <EmptyState
        compact
        icon={ImageOff}
        title={`Say hello to ${display.title}`}
        description={
          isGroup
            ? 'This group is ready. Send the first message to get everyone talking.'
            : 'No messages yet. A simple hello is a great place to start.'
        }
      />
    </div>
  );
}
