import { Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { BrandLockup } from '../brand/Brand.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { IconButton } from '../ui/Button.jsx';

/**
 * AuthShell — two-panel layout for sign-in, sign-up and password reset.
 *
 * Left: the Chazter story (display type + a live-looking chat preview) so the
 * page feels like a product, not a form. Right: the task.
 * On narrow screens the story collapses into a compact brand header.
 */
export function AuthShell({ children, eyebrow, title, subtitle, footer, backTo }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="auth-shell">
      <div className="ambient" aria-hidden="true" />

      <aside className="auth-story" aria-hidden="true">
        <div className="auth-story__inner">
          <BrandLockup size={38} showTagline />

          <h1 className="auth-story__headline display">
            Talk like it&nbsp;matters.
            <br />
            <em>Every word, kept.</em>
          </h1>

          <p className="auth-story__lede">
            Chazter is a quiet place for the conversations that deserve your attention —
            one-to-one or in a small circle, with everything in sync.
          </p>

          <ChatPreview />

          <ul className="auth-story__points">
            <li>
              <span className="auth-story__dot auth-story__dot--jade" />
              Real-time delivery, read receipts and typing cues
            </li>
            <li>
              <span className="auth-story__dot auth-story__dot--coral" />
              Groups built for small circles, not server empires
            </li>
            <li>
              <span className="auth-story__dot auth-story__dot--amber" />
              Private by design: only members can read a chat
            </li>
          </ul>
        </div>
        <p className="auth-story__foot">© {new Date().getFullYear()} Chazter · Crafted with care</p>
      </aside>

      <main className="auth-panel">
        <header className="auth-panel__top">
          <div className="auth-panel__top-left">
            {backTo ? (
              <Link to={backTo} className="auth-back">
                <ArrowLeft size={16} aria-hidden="true" />
                Back
              </Link>
            ) : (
              <span className="auth-panel__brand-mobile">
                <BrandLockup size={28} />
              </span>
            )}
          </div>
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          />
        </header>

        <div className="auth-panel__content page-fade">
          <div className="auth-card">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="auth-card__title display">{title}</h2>
            {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
            {children}
          </div>
          {footer ? <div className="auth-card__footer">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** Decorative chat mock-up that sells the product on the sign-in screen. */
function ChatPreview() {
  return (
    <div className="chat-preview">
      <div className="chat-preview__head">
        <span className="chat-preview__avatar">AR</span>
        <span>
          <strong>Amara &amp; Ravi</strong>
          <small>typing…</small>
        </span>
        <span className="chat-preview__live">live</span>
      </div>
      <div className="chat-preview__body">
        <div className="chat-preview__bubble chat-preview__bubble--in">
          The studio is free on Thursday — shall we take it?
          <span>10:02</span>
        </div>
        <div className="chat-preview__bubble chat-preview__bubble--out">
          Booked it. I’ll bring the prints.
          <span>10:04 · Read</span>
        </div>
        <div className="chat-preview__typing">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
