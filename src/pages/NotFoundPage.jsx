import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { BrandLockup } from '../components/brand/Brand.jsx';
import { EmptyState } from '../components/ui/States.jsx';

/** 404 — friendly, branded dead end with real ways forward. */
export default function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="ambient" aria-hidden="true" />
      <div className="not-found__card page-fade">
        <BrandLockup size={34} />
        <p className="not-found__code">404</p>
        <EmptyState
          icon={Compass}
          title="This page took a wrong turn"
          description="The link may be old, or the page may have moved. Your conversations are safe."
          action={
            <div className="not-found__actions">
              <Link to="/app" className="btn btn--solid btn--md">
                <span className="btn__label">Go to my chats</span>
              </Link>
              <Link to="/" className="btn btn--ghost btn--md">
                <span className="btn__label">Home</span>
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
