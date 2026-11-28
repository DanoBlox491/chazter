import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  User,
  Users,
  UserRoundPlus,
  UserRoundSearch,
  CheckCheck,
  LayoutGrid,
} from 'lucide-react';
import { BrandMark } from '../brand/Brand.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Badge } from '../ui/Misc.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useWorkspace } from '../../context/NewChatContext.jsx';
import { useDismiss, useMediaQuery } from '../../hooks/useMisc.js';
import { cx } from '../../lib/utils/general.js';

/**
 * NavRail — slim vertical navigation on desktop, bottom bar on mobile.
 *
 * The primary action is "new chat"; secondary destinations live behind the
 * avatar menu so the rail stays quiet. Unread totals are surfaced on the
 * Chats destination, never as competing badges.
 */
export function NavRail() {
  const { user, signOutUser } = useAuth();
  const { isDark, toggleTheme, preference } = useTheme();
  const { totalUnread, openComposer } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Only one navigation landmark is exposed per viewport, so screen readers
  // and tests see a single, unambiguous "Main navigation".
  const isDesktop = useMediaQuery('(min-width: 900px)');

  useDismiss(menuRef, () => setMenuOpen(false), { enabled: menuOpen });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOutUser();
      toast.info('Signed out', 'See you soon.');
      navigate('/signin', { replace: true });
    } catch {
      toast.error('Could not sign out', 'Please try again.');
    }
  };

  const chatsActive = location.pathname === '/app' || location.pathname.startsWith('/app/c/');
  const settingsActive = location.pathname.startsWith('/app/settings');
  const peopleActive = location.pathname === '/app/people';
  const serversActive = location.pathname.startsWith('/app/s');
  const profileActive = location.pathname.startsWith('/app/u/');

  return (
    <>
      <aside className="nav-rail">
        <Link to="/app" className="nav-rail__brand" aria-label="Chazter home">
          <BrandMark size={34} />
        </Link>

        <nav className="nav-rail__nav" aria-label="Main navigation">
          <NavLink
            to="/app"
            className={cx('nav-rail__item', chatsActive && 'is-active')}
            aria-label={`Chats${totalUnread ? `, ${totalUnread} unread` : ''}`}
            title="Chats"
          >
            <span className="nav-rail__icon">
              <MessageCircle size={21} strokeWidth={1.8} aria-hidden="true" />
              {totalUnread > 0 ? <Badge count={totalUnread} className="nav-rail__badge" /> : null}
            </span>
            <span className="nav-rail__label">Chats</span>
          </NavLink>

          <NavLink
            to="/app/people"
            className={cx('nav-rail__item', peopleActive && 'is-active')}
            aria-label="Find people"
            title="Find people"
          >
            <span className="nav-rail__icon">
              <Users size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="nav-rail__label">People</span>
          </NavLink>

          <NavLink
            to="/app/servers"
            className={cx('nav-rail__item', serversActive && 'is-active')}
            aria-label="Servers"
            title="Servers"
          >
            <span className="nav-rail__icon">
              <LayoutGrid size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="nav-rail__label">Servers</span>
          </NavLink>

          <button
            type="button"
            className="nav-rail__item nav-rail__item--action"
            onClick={() => openComposer('direct')}
            aria-label="Start a new conversation"
            title="New conversation"
          >
            <span className="nav-rail__action-icon" aria-hidden="true">
              <UserRoundPlus size={19} strokeWidth={1.9} />
            </span>
            <span className="nav-rail__label">New</span>
          </button>

          <NavLink
            to="/app/settings"
            className={cx('nav-rail__item', settingsActive && 'is-active')}
            aria-label="Settings"
            title="Settings"
          >
            <span className="nav-rail__icon">
              <Settings size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="nav-rail__label">Settings</span>
          </NavLink>
        </nav>

        <div className="nav-rail__footer">
          <div className="nav-rail__theme">
            <IconButton
              icon={isDark ? Sun : Moon}
              label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              size="sm"
            />
            <span className="nav-rail__theme-label">{preference === 'system' ? 'Auto' : isDark ? 'Dark' : 'Light'}</span>
          </div>

          <div className="nav-rail__avatar" ref={menuRef}>
            <button
              type="button"
              className={cx('nav-rail__avatar-btn', menuOpen && 'is-open')}
              onClick={() => setMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Your account menu"
            >
              <Avatar
                src={user?.photoURL}
                name={user?.displayName}
                userId={user?.uid}
                size={36}
                showStatus
                online
              />
            </button>

            {menuOpen ? (
              <div className="account-menu" role="menu" aria-label="Account">
                <div className="account-menu__head">
                  <Avatar src={user?.photoURL} name={user?.displayName} userId={user?.uid} size={40} />
                  <div className="account-menu__identity">
                    <p className="account-menu__name">{user?.displayName}</p>
                    <p className="account-menu__handle">@{user?.username}</p>
                  </div>
                  <CheckCheck size={16} className="account-menu__verified" aria-hidden="true" />
                </div>
                <div className="account-menu__items">
                  <Link
                    to={`/app/u/${user?.username}`}
                    role="menuitem"
                    className={cx('account-menu__item', profileActive && 'is-active')}
                  >
                    <User size={16} aria-hidden="true" /> Your profile
                  </Link>
                  <Link
                    to="/app/people"
                    role="menuitem"
                    className={cx('account-menu__item', peopleActive && 'is-active')}
                  >
                    <UserRoundSearch size={16} aria-hidden="true" /> Find people
                  </Link>
                  <Link
                    to="/app/settings"
                    role="menuitem"
                    className={cx('account-menu__item', settingsActive && 'is-active')}
                  >
                    <Settings size={16} aria-hidden="true" /> Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="account-menu__item account-menu__item--danger"
                    onClick={handleSignOut}
                  >
                    <LogOut size={16} aria-hidden="true" /> Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      {isDesktop ? null : (
      <nav className="bottom-bar" aria-label="Mobile navigation">
        <Link to="/app" className={cx('bottom-bar__item', chatsActive && 'is-active')}>
          <span className="bottom-bar__icon">
            <MessageCircle size={22} strokeWidth={1.8} aria-hidden="true" />
            {totalUnread > 0 ? <Badge count={totalUnread} className="bottom-bar__badge" /> : null}
          </span>
          <span>Chats</span>
        </Link>
        <Link to="/app/people" className={cx('bottom-bar__item', peopleActive && 'is-active')}>
          <Users size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>People</span>
        </Link>
        <Link to="/app/servers" className={cx('bottom-bar__item', serversActive && 'is-active')}>
          <LayoutGrid size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>Servers</span>
        </Link>
        <button
          type="button"
          className="bottom-bar__item bottom-bar__item--fab"
          onClick={() => openComposer('direct')}
          aria-label="Start a new conversation"
        >
          <UserRoundPlus size={22} strokeWidth={2} aria-hidden="true" />
        </button>
        <Link to="/app/settings" className={cx('bottom-bar__item', settingsActive && 'is-active')}>
          <Settings size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>Settings</span>
        </Link>
        <Link
          to={`/app/u/${user?.username}`}
          className={cx('bottom-bar__item', profileActive && 'is-active')}
        >
          <Avatar src={user?.photoURL} name={user?.displayName} userId={user?.uid} size={22} />
          <span>You</span>
        </Link>
      </nav>
      )}
    </>
  );
}
