import { useEffect, useRef, useState } from 'react';
import { ImagePlus, SendHorizontal, Smile, X } from 'lucide-react';
import { IconButton } from '../ui/Button.jsx';
import { cx } from '../../lib/utils/general.js';
import { MESSAGE_MAX } from '../../lib/utils/validation.js';
import { validateImageFile } from '../../lib/services/storageService.js';

const EMOJI = ['😀', '😂', '🙂', '😍', '🤔', '👏', '🙌', '🔥', '💯', '🎉', '❤️', '✨', '👍', '👀', '☕', '🌿'];

/**
 * Message composer.
 *
 * Behaviours that make it feel finished:
 * - Enter sends, Shift+Enter adds a line (desktop); mobile uses the button.
 * - Auto-grows to a comfortable max height, then scrolls.
 * - Image attaches with a client-side preview; caption becomes the message.
 * - Draft text is kept per conversation in memory so switching chats is safe.
 * - Typing is signalled on real input, not on focus.
 */
export function Composer({
  conversationId,
  onSend,
  onTyping,
  onStopTyping,
  onImageSend,
  disabled = false,
  placeholder = 'Write a message…',
  drafts,
}) {
  const [value, setValue] = useState(() => drafts?.get(conversationId) || '');
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const emojiRef = useRef(null);

  // Swap drafts when the conversation changes.
  useEffect(() => {
    setValue(drafts?.get(conversationId) || '');
    setImage(null);
    setImageError('');
    setShowEmoji(false);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      autosize(node);
      node.focus({ preventScroll: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Persist the draft while typing.
  useEffect(() => {
    if (!drafts) return;
    if (value) drafts.set(conversationId, value);
    else drafts.delete(conversationId);
  }, [value, conversationId, drafts]);

  // Dismiss the emoji popover on outside click.
  useEffect(() => {
    if (!showEmoji) return undefined;
    const onPointer = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [showEmoji]);

  const autosize = (node) => {
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 176)}px`;
  };

  const handleChange = (event) => {
    setValue(event.target.value);
    autosize(event.target);
    if (event.target.value.trim()) onTyping?.();
    else onStopTyping?.();
  };

  const reset = () => {
    setValue('');
    setImage(null);
    setImageError('');
    onStopTyping?.();
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus({ preventScroll: true });
      }
    });
  };

  const submit = async (event) => {
    event?.preventDefault();
    const text = value.trim();
    if ((!text && !image) || sending || disabled) return;
    setSending(true);
    try {
      if (image) {
        await onImageSend?.({ file: image.file, caption: text, previewUrl: image.previewUrl });
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
        reset();
      } else {
        await onSend?.(text);
        reset();
      }
    } catch (error) {
      // The parent surfaces a toast; keep the draft so nothing is lost.
      console.warn('[chazter] send failed', error?.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape') {
      setShowEmoji(false);
    }
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setImageError(error);
      return;
    }
    setImageError('');
    setImage({ file, previewUrl: URL.createObjectURL(file), name: file.name });
    textareaRef.current?.focus();
  };

  useEffect(() => () => {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSend = Boolean(value.trim() || image) && !disabled;

  return (
    <div className="composer-wrap">
      {image ? (
        <div className="composer-attachment">
          <img src={image.previewUrl} alt="Attachment preview" />
          <div className="composer-attachment__meta">
            <p className="truncate">{image.name}</p>
            <span>{(image.file.size / 1024).toFixed(0)} KB · ready to send</span>
          </div>
          <IconButton
            icon={X}
            label="Remove attachment"
            size="sm"
            onClick={() => {
              URL.revokeObjectURL(image.previewUrl);
              setImage(null);
            }}
          />
        </div>
      ) : null}

      {imageError ? (
        <p className="composer-error" role="alert">
          {imageError}
        </p>
      ) : null}

      <form className="composer" onSubmit={submit} aria-label="Message composer">
        <div className="composer__tools">
          <IconButton
            icon={ImagePlus}
            label="Attach a photo"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || sending}
            size="sm"
          />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} tabIndex={-1} />
          <div className="composer__emoji-anchor" ref={emojiRef}>
            <IconButton
              icon={Smile}
              label="Insert emoji"
              onClick={() => setShowEmoji((current) => !current)}
              disabled={disabled}
              size="sm"
              aria-expanded={showEmoji}
            />
            {showEmoji ? (
              <div className="emoji-pop" role="dialog" aria-label="Emoji picker">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setValue((current) => `${current}${emoji}`);
                      setShowEmoji(false);
                      requestAnimationFrame(() => {
                        if (textareaRef.current) autosize(textareaRef.current);
                        textareaRef.current?.focus();
                      });
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="composer__field">
          <textarea
            ref={textareaRef}
            className="composer__input"
            rows={1}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => onStopTyping?.()}
            maxLength={MESSAGE_MAX}
            aria-label="Message"
            disabled={disabled}
          />
          {value.length > MESSAGE_MAX * 0.85 ? (
            <span className="composer__count" aria-hidden="true">
              {value.length}/{MESSAGE_MAX}
            </span>
          ) : null}
        </div>

        <button
          type="submit"
          className={cx('composer__send', canSend && 'is-ready')}
          disabled={!canSend || sending}
          aria-label={sending ? 'Sending' : 'Send message'}
        >
          <SendHorizontal size={19} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
