import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Spinner } from '../ui/States.jsx';
import { useDebouncedValue } from '../../hooks/useMisc.js';
import { searchMessages } from '../../lib/services/conversationService.js';
import { formatDayLabel, formatTime } from '../../lib/utils/time.js';
import { truncate } from '../../lib/utils/general.js';

/**
 * In-conversation message search.
 *
 * Scans the latest batch of messages client-side (bounded read) so it works
 * with no extra indexes or Cloud Functions. Results highlight the matched
 * term and jump to the message in the transcript.
 */
export function MessageSearch({ conversationId, conversationTitle, onClose, onJump }) {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 280);
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults([]);
      setState('idle');
      return undefined;
    }
    setState('searching');
    searchMessages(conversationId, debounced, { max: 300 })
      .then((hits) => {
        if (cancelled) return;
        setResults(hits);
        setState('done');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, debounced]);

  const needle = debounced.trim().toLowerCase();

  return (
    <div className="msg-search" role="search">
      <div className="msg-search__bar">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}
          placeholder={`Search in ${conversationTitle}`}
          aria-label={`Search messages in ${conversationTitle}`}
        />
        {state === 'searching' ? <Spinner size={15} /> : null}
        <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close search">
          <X size={16} />
        </button>
      </div>

      {needle.length >= 2 ? (
        <div className="msg-search__results">
          {state === 'error' ? (
            <p className="msg-search__hint">Search isn’t available right now. Try again in a moment.</p>
          ) : state === 'done' && results.length === 0 ? (
            <p className="msg-search__hint">No messages matched “{debounced.trim()}”.</p>
          ) : (
            <p className="msg-search__hint">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
          )}
          <ul>
            {results.slice(0, 30).map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  className="msg-search__result"
                  onClick={() => {
                    onJump(message.id);
                    onClose();
                  }}
                >
                  <span className="msg-search__result-top">
                    <strong>{message.senderName}</strong>
                    <small>
                      {formatDayLabel(message.createdAt)} · {formatTime(message.createdAt)}
                    </small>
                  </span>
                  <span className="msg-search__result-text">
                    {renderHighlighted(message.text, needle)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="msg-search__hint msg-search__hint--idle">
          Type at least two characters to search your history.
        </p>
      )}
    </div>
  );
}

function renderHighlighted(text, needle) {
  const source = truncate(text || '', 160);
  const index = source.toLowerCase().indexOf(needle);
  if (index === -1) return source;
  return (
    <>
      {source.slice(0, index)}
      <mark className="msg-search__mark">{source.slice(index, index + needle.length)}</mark>
      {source.slice(index + needle.length)}
    </>
  );
}
