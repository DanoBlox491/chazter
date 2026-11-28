import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCheck, ImageIcon, Lock, Moon, Search, Sun, Users, Zap } from 'lucide-react';
import { BrandLockup, BrandMark } from '../components/brand/Brand.jsx';
import { IconButton } from '../components/ui/Button.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time, always',
    body: 'Messages arrive instantly, typing cues land as you type, and read receipts close the loop.',
  },
  {
    icon: Users,
    title: 'Small groups, done right',
    body: 'Create a circle for the people who matter. Admins can add, promote or remove — cleanly.',
  },
  {
    icon: Search,
    title: 'Find any word',
    body: 'Search inside a conversation and jump straight back to the message you were thinking of.',
  },
  {
    icon: ImageIcon,
    title: 'Share the moment',
    body: 'Send photos inline with previews, captions and progress — no context lost.',
  },
  {
    icon: CheckCheck,
    title: 'Know it was read',
    body: 'Live unread counts in your inbox and precise double-tick receipts in every chat.',
  },
  {
    icon: Lock,
    title: 'Private by architecture',
    body: 'Firestore rules verify membership on every read and write. Only members can see a chat.',
  },
];

/** Public marketing page — also the app's fallback route. */
export function LandingPage() {
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = 'Chazter — conversations, considered';
  }, []);

  return (
    <div className="landing">
      <div className="ambient" aria-hidden="true" />

      <header className="landing__nav">
        <BrandLockup size={32} />
        <nav className="landing__nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="landing__nav-actions">
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          />
          <Link to="/signin" className="btn btn--ghost btn--sm">
            <span className="btn__label">Sign in</span>
          </Link>
          <Link to="/signup" className="btn btn--solid btn--sm landing__cta">
            <span className="btn__label">Get started</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero__copy page-fade">
            <span className="hero__pill">
              <span className="hero__pill-dot" aria-hidden="true" />
              A calmer place to message
            </span>
            <h1 className="hero__title display">
              Conversations,
              <br />
              <em>considered.</em>
            </h1>
            <p className="hero__lede">
              Chazter is a modern messaging platform for the conversations that deserve your
              attention. Real-time, private, and beautiful on every screen.
            </p>
            <div className="hero__actions">
              <Link to="/signup" className="btn btn--solid btn--lg">
                <span className="btn__label">Create your account</span>
                <ArrowRight size={17} className="btn__icon" aria-hidden="true" />
              </Link>
              <Link to="/signin" className="btn btn--outline btn--lg">
                <span className="btn__label">I already have one</span>
              </Link>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>Two ways in</dt>
                <dd>Google or CHAZTER account</dd>
              </div>
              <div>
                <dt>Zero noise</dt>
                <dd>No ads, no feeds</dd>
              </div>
              <div>
                <dt>Every device</dt>
                <dd>Responsive by default</dd>
              </div>
            </dl>
          </div>

          <div className="hero__art" aria-hidden="true">
            <div className="hero__glow" />
            <div className="mockapp">
              <div className="mockapp__rail">
                <BrandMark size={26} />
                <span className="mockapp__rail-dot is-active" />
                <span className="mockapp__rail-dot" />
                <span className="mockapp__rail-dot" />
                <span className="mockapp__rail-spacer" />
                <span className="mockapp__me">AR</span>
              </div>
              <div className="mockapp__list">
                <div className="mockapp__search">
                  <Search size={13} />
                  <span>Search people and chats</span>
                </div>
                {[
                  { name: 'Amara Reyes', text: 'Booked it. I’ll bring the prints.', time: '10:04', active: true, tone: 'coral' },
                  { name: 'Design Circle', text: 'Ravi: the palette works 🔥', time: '09:12', tone: 'plum' },
                  { name: 'Jonah Park', text: 'Sent you the notes', time: 'Yest.', tone: 'sky' },
                  { name: 'Studio Ops', text: 'Ada: Thursday works', time: 'Yest.', tone: 'amber' },
                ].map((row) => (
                  <div key={row.name} className={`mockapp__row ${row.active ? 'is-active' : ''}`}>
                    <span className={`mockapp__avatar avatar--${row.tone}`}>{row.name.slice(0, 2).toUpperCase()}</span>
                    <span className="mockapp__row-text">
                      <span className="mockapp__row-top">
                        <strong>{row.name}</strong>
                        <small>{row.time}</small>
                      </span>
                      <span className="mockapp__row-preview">{row.text}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mockapp__chat">
                <div className="mockapp__chat-head">
                  <span className="mockapp__avatar avatar--coral">AR</span>
                  <span>
                    <strong>Amara Reyes</strong>
                    <small>
                      <span className="mockapp__online" /> online now
                    </small>
                  </span>
                </div>
                <div className="mockapp__chat-body">
                  <div className="mockapp__bubble is-in">
                    The studio is free on Thursday — shall we take it?
                    <small>10:02</small>
                  </div>
                  <div className="mockapp__bubble is-out">
                    Booked it. I’ll bring the prints.
                    <small>
                      10:04 <CheckCheck size={11} />
                    </small>
                  </div>
                  <div className="mockapp__bubble is-in">
                    Perfect — see you at nine?
                    <small>10:05</small>
                  </div>
                  <div className="mockapp__typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="mockapp__composer">
                  <span>Write a message…</span>
                  <span className="mockapp__send">
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="features">
          <div className="features__head">
            <span className="eyebrow">Everything you need</span>
            <h2 className="display">
              Built for <em>real</em> conversations
            </h2>
            <p>No bloat, no algorithm. Just the features a good chat needs — executed with care.</p>
          </div>
          <div className="features__grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article className="feature-card" key={title}>
                <span className="feature-card__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.7} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="privacy" id="privacy">
          <div className="privacy__card">
            <div>
              <span className="eyebrow">Privacy</span>
              <h2 className="display">
                Your chat is <em>yours</em>.
              </h2>
              <p>
                Chazter is built on Firebase Authentication and Cloud Firestore with strict
                security rules: reads and writes are only allowed for verified members of a
                conversation. Passwords are never stored by us — Firebase handles them with
                industry-standard hashing.
              </p>
            </div>
            <ul className="privacy__list">
              <li>
                <CheckCheck size={16} aria-hidden="true" /> Membership checked server-side
              </li>
              <li>
                <CheckCheck size={16} aria-hidden="true" /> Usernames protected from duplicates
              </li>
              <li>
                <CheckCheck size={16} aria-hidden="true" /> Profiles editable only by their owner
              </li>
              <li>
                <CheckCheck size={16} aria-hidden="true" /> No admin credentials in the client
              </li>
            </ul>
          </div>
        </section>

        <section className="closing">
          <h2 className="display">
            Ready when <em>you</em> are.
          </h2>
          <p>Create your account in under a minute. Bring a friend.</p>
          <div className="hero__actions">
            <Link to="/signup" className="btn btn--solid btn--lg">
              <span className="btn__label">Get started free</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <BrandLockup size={24} />
        <p>© {new Date().getFullYear()} Chazter. Conversations, considered.</p>
        <Link to="/signin" className="landing__footer-link">
          Sign in
        </Link>
      </footer>
    </div>
  );
}
