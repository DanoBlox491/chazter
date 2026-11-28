import { useEffect, useState } from 'react';
import { Gauge, Rocket, Sparkles, Zap } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Switch } from '../ui/Misc.jsx';
import { usePreferences, prefersReducedMotion } from '../../lib/preferences.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Performance & motion settings.
 *
 * Every switch is wired to a real effect on the DOM — see
 * `src/lib/preferences.js` for the attribute and `src/styles/performance.css`
 * for what each attribute actually changes. Nothing here is decorative, and
 * nothing claims to do something a web page cannot do.
 */
export function PerformanceSettings() {
  const prefs = usePreferences();
  const toast = useToast();
  const [osReducedMotion, setOsReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  // Report what the OS asks for, so the switch state is never a mystery.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setOsReducedMotion(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const motionSuppressed = prefersReducedMotion(prefs);

  const set = (key) => (value) => {
    prefs.set({ [key]: value });
  };

  return (
    <section className="settings-panel">
      <header className="settings-panel__head">
        <div>
          <h2 className="settings-panel__title">Performance &amp; motion</h2>
          <p className="settings-panel__lede">
            Tune how Chazter renders on this device. These settings are stored on this device
            only — your phone and your laptop can disagree.
          </p>
        </div>
      </header>

      <div className="perf-grid">
        <article className="perf-card">
          <span className="perf-card__icon" aria-hidden="true">
            <Rocket size={17} />
          </span>
          <h3 className="perf-card__title">Launch acceleration</h3>
          <p className="perf-card__text">
            Keeps the last conversation list in local storage so the inbox paints immediately on
            cold start, instead of waiting for the first network snapshot.
          </p>
          <Switch
            id="perf-instant-launch"
            label="Instant launch"
            description={
              prefs.instantLaunch
                ? 'Cached inbox shown first, then reconciled live.'
                : 'Starting from an empty screen while data loads.'
            }
            checked={prefs.instantLaunch}
            onChange={set('instantLaunch')}
          />
        </article>

        <article className="perf-card">
          <span className="perf-card__icon" aria-hidden="true">
            <Zap size={17} />
          </span>
          <h3 className="perf-card__title">Low latency profile</h3>
          <p className="perf-card__text">
            Removes backdrop blur, drop shadows and text shadows, and shortens every transition.
            Blur is the most expensive thing a chat UI asks the GPU to re-rasterise while
            scrolling.
          </p>
          <Switch
            id="perf-low-latency"
            label="Low latency profile"
            description={
              prefs.lowLatency
                ? 'On — flat rendering, minimum transition work.'
                : 'Off — full visual effects.'
            }
            checked={prefs.lowLatency}
            onChange={set('lowLatency')}
          />
        </article>

        <article className="perf-card">
          <span className="perf-card__icon" aria-hidden="true">
            <Gauge size={17} />
          </span>
          <h3 className="perf-card__title">Hardware acceleration</h3>
          <p className="perf-card__text">
            Browsers compose transforms and blurs on the GPU. That is usually faster, but on
            some drivers it causes tearing, flicker or black rectangles while scrolling.
            Turning it off forces stable software rendering.
          </p>
          <Switch
            id="perf-hwaccel"
            label="Use GPU compositing"
            description={
              prefs.hardwareAccel
                ? 'On — smooth, but relies on your graphics driver.'
                : 'Off — software rendering. Slower, but immune to driver glitches.'
            }
            checked={prefs.hardwareAccel}
            onChange={set('hardwareAccel')}
          />
        </article>

        <article className="perf-card">
          <span className="perf-card__icon" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <h3 className="perf-card__title">Ambient background</h3>
          <p className="perf-card__text">
            The slowly drifting colour wash behind the app. Purely decorative, and the first
            thing to switch off on battery.
          </p>
          <Switch
            id="perf-ambient"
            label="Animated background"
            checked={prefs.ambientEffects}
            onChange={set('ambientEffects')}
          />
        </article>
      </div>

      <div className="perf-motion">
        <div className="perf-motion__head">
          <h3 className="perf-motion__title">Reduce motion</h3>
          <span className="perf-motion__os">
            System preference: <strong>{osReducedMotion ? 'reduce motion' : 'full motion'}</strong>
          </span>
        </div>
        <p className="perf-motion__text">
          Turns off decorative animation and transitions across the whole app — message
          pop-in, modal slide, page fades and the typing dots.
        </p>
        <Switch
          id="perf-reduce-motion"
          label="Reduce motion in Chazter"
          description={
            osReducedMotion && !prefs.reduceMotion
              ? 'Your system already asks for reduced motion, so the app is honouring it even with this switch off.'
              : motionSuppressed
                ? 'On — motion is suppressed.'
                : 'Off — animations play normally.'
          }
          checked={prefs.reduceMotion}
          onChange={(value) => {
            prefs.set({ reduceMotion: value });
            toast.info(value ? 'Motion reduced' : 'Motion restored');
          }}
        />
        {motionSuppressed && !prefs.reduceMotion ? (
          <p className="perf-motion__hint">
            Detected from your operating system. Turning this switch on makes the choice
            explicit and keeps it even if the OS setting changes.
          </p>
        ) : null}
      </div>

      <div className="perf-reset">
        <Button variant="quiet" size="sm" onClick={() => prefs.reset()}>
          Reset to defaults
        </Button>
        <span className="perf-reset__note">Applies to this device only.</span>
      </div>
    </section>
  );
}
