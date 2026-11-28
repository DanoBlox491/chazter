import { useMemo, useState } from 'react';
import { cx } from '../../lib/utils/general.js';
import { colourFor } from '../../lib/utils/colour.js';

/** Two-letter monogram that stays readable for emoji/unicode names. */
function initialsFor(name = '') {
  const clean = String(name).trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const chars = [...parts[0]];
    return chars.slice(0, 2).join('').toUpperCase();
  }
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}

/**
 * Avatar — photo when available, otherwise a warm monogram tile.
 * Sizes are in px and drive the font scale so one component serves
 * the 24px presence dot next to text and the 96px profile header alike.
 */
export function Avatar({
  src,
  name,
  size = 40,
  colour,
  online,
  showStatus = false,
  ring = false,
  className,
  userId,
}) {
  const [failed, setFailed] = useState(false);
  const tone = useMemo(() => colour || colourFor(userId || name || ''), [colour, userId, name]);
  const showImage = src && !failed;
  const dotSize = Math.max(9, Math.round(size * 0.26));

  return (
    <span
      className={cx('avatar', `avatar--${tone}`, ring && 'avatar--ring', className)}
      style={{ '--avatar-size': `${size}px`, '--dot-size': `${dotSize}px` }}
      aria-hidden={!name}
    >
      {showImage ? (
        <img
          className="avatar__img"
          src={src}
          alt={name ? `${name}’s avatar` : ''}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="avatar__initials">{initialsFor(name)}</span>
      )}
      {showStatus ? (
        <span
          className={cx('avatar__status', online ? 'is-online' : 'is-offline')}
          title={online ? 'Online' : 'Offline'}
          aria-label={online ? 'Online' : 'Offline'}
          role="img"
        />
      ) : null}
    </span>
  );
}

/**
 * Group avatar: for 1–4 people show a small cluster of member monograms,
 * otherwise the group's own initials + colour.
 */
export function GroupAvatar({ conversation, size = 44, className }) {
  const members = Object.entries(conversation?.members || {})
    .map(([uid, value]) => ({ uid, ...value }))
    .slice(0, 4);

  if (conversation?.photoURL) {
    return <Avatar src={conversation.photoURL} name={conversation.name} size={size} className={className} />;
  }

  if (members.length >= 2) {
    return (
      <span
        className={cx('avatar-cluster', className)}
        style={{ '--avatar-size': `${size}px` }}
        aria-hidden="true"
      >
        {members.map((member) => (
          <Avatar
            key={member.uid}
            src={member.photoURL}
            name={member.displayName}
            userId={member.uid}
            size={Math.round(size / 2)}
          />
        ))}
      </span>
    );
  }

  return (
    <Avatar
      name={conversation?.name || 'Group'}
      size={size}
      colour={conversation?.color || colourFor(conversation?.name || '')}
      className={className}
    />
  );
}
