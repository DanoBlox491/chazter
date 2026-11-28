import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Trash2, X } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/time.js';

/**
 * Full-screen image viewer.
 * Escape closes, Escape/click outside dismisses, download opens in a new tab.
 */
export function ImageLightbox({ open, message, onClose, onDelete }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || !message?.image?.url) return null;

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <div className="lightbox__bar" onClick={(event) => event.stopPropagation()}>
        <div className="lightbox__meta">
          <strong>{message.senderName}</strong>
          <span>{formatDateTime(message.createdAt)}</span>
        </div>
        <div className="lightbox__actions">
          <a
            className="icon-btn icon-btn--ghost"
            href={message.image.url}
            target="_blank"
            rel="noreferrer noopener"
            download
            aria-label="Download photo"
            title="Download"
          >
            <Download size={18} />
          </a>
          {onDelete ? (
            <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete} aria-label="Delete photo message">
              <Trash2 size={18} />
            </button>
          ) : null}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close viewer">
            <X size={20} />
          </button>
        </div>
      </div>
      <figure className="lightbox__figure" onClick={(event) => event.stopPropagation()}>
        <img src={message.image.url} alt={message.text || 'Shared photo'} />
        {message.text ? <figcaption>{message.text}</figcaption> : null}
      </figure>
    </div>,
    document.body,
  );
}
