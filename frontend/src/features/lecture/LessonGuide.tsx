import { useEffect, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { LESSONS } from './lessons';
import { LESSON_GUIDES } from './lessonGuides';
import './lesson-guide.css';

export const guidePreferenceKey = (path: string) => `rsa-lab-guide.v1:${path}`;
function isHidden(path: string) {
  try {
    return localStorage.getItem(guidePreferenceKey(path)) === 'hidden';
  } catch {
    return false;
  }
}
function visibleTarget(selector: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (element) =>
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
  );
}
type Spot = { left: number; top: number; width: number; height: number };
type Placement = { spot: Spot | null; left: number; top: number; above: boolean };

export function LessonGuide({ path }: { path: string }) {
  const content = LESSON_GUIDES[path];
  if (!content) return null;
  return <Guide path={path} content={content} />;
}
function Guide({ path, content }: { path: string; content: (typeof LESSON_GUIDES)[string] }) {
  const lesson = LESSONS.find((item) => item.path === path)!;
  const [stage, setStage] = useState<'intro' | number | null>(() =>
    isHidden(path) ? null : 'intro',
  );
  const [hideNextTime, setHideNextTime] = useState(() => isHidden(path));
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [tried, setTried] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const target = useRef<HTMLElement | undefined>(undefined);
  const step = typeof stage === 'number' ? content.steps[stage] : null;
  const open = stage !== null;

  function close() {
    try {
      if (hideNextTime) localStorage.setItem(guidePreferenceKey(path), 'hidden');
      else localStorage.removeItem(guidePreferenceKey(path));
    } catch {
      /* The guide still works without browser storage. */
    }
    dialog.current?.close();
    setStage(null);
    help.current?.focus({ preventScroll: true });
  }
  function move(nextStage: 'intro' | number) {
    setPlacement(null);
    setTried(false);
    setStage(nextStage);
  }
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    return () => {
      element?.close();
    };
  }, [open]);
  useEffect(() => {
    if (stage === null) return;
    title.current?.focus({ preventScroll: true });
    if (!step) return;
    const element = visibleTarget(step.target);
    target.current = element;
    if (element) {
      // Keep the real control above the callout, also on small screens.
      window.scrollBy({ top: element.getBoundingClientRect().top - 100, behavior: 'instant' });
    }
    let frame = 0;
    const measure = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const panel = card.current;
      if (!panel) return;
      const bounds = visibleTarget(step.target)?.getBoundingClientRect();
      const spot = bounds
        ? {
            left: Math.max(8, bounds.left - 6),
            top: Math.max(8, bounds.top - 6),
            width: Math.max(
              0,
              Math.min(width - 8, bounds.right + 6) - Math.max(8, bounds.left - 6),
            ),
            height: Math.max(
              0,
              Math.min(height - 8, bounds.bottom + 6) - Math.max(8, bounds.top - 6),
            ),
          }
        : null;
      const panelHeight = panel.getBoundingClientRect().height;
      const panelWidth = panel.getBoundingClientRect().width;
      const above = Boolean(
        spot && spot.top + spot.height + panelHeight + 28 > height && spot.top > panelHeight + 28,
      );
      const preferredTop = spot
        ? above
          ? spot.top - panelHeight - 18
          : spot.top + spot.height + 18
        : (height - panelHeight) / 2;
      setPlacement({
        spot,
        above,
        left: Math.max(
          12,
          Math.min(width - panelWidth - 12, spot?.left ?? (width - panelWidth) / 2),
        ),
        top: Math.max(12, Math.min(height - panelHeight - 12, preferredTop)),
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (element) observer.observe(element);
    if (card.current) observer.observe(card.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [stage, step]);

  const spot = placement?.spot;
  return (
    <>
      <button
        ref={help}
        type="button"
        className="lesson-guide-trigger"
        onClick={() => move('intro')}
      >
        <CircleHelp size={18} aria-hidden="true" /> Page guide
      </button>
      <dialog
        ref={dialog}
        className={`lesson-guide ${step ? 'tour' : 'intro'}`}
        aria-labelledby="lesson-guide-title"
        aria-describedby="lesson-guide-description"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {step && spot ? (
          <div aria-hidden="true" className="guide-shade">
            <div style={{ left: 0, top: 0, width: '100%', height: spot.top }} />
            <div style={{ left: 0, top: spot.top, width: spot.left, height: spot.height }} />
            <div
              style={{ left: spot.left + spot.width, top: spot.top, right: 0, height: spot.height }}
            />
            <div style={{ left: 0, top: spot.top + spot.height, width: '100%', bottom: 0 }} />
            <span className="guide-spot" data-target={step.target} style={spot} />
          </div>
        ) : (
          <div aria-hidden="true" className="guide-full-shade" />
        )}
        <section
          ref={card}
          className={`guide-card${step && spot ? ' pointing' : ''}${placement?.above ? ' above' : ''}`}
          style={step && placement ? { left: placement.left, top: placement.top } : undefined}
        >
          <button
            type="button"
            className="guide-close"
            aria-label="Close page guide"
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <p className="guide-eyebrow">
            {step
              ? `QUICK TOUR · ${Number(stage) + 1} / ${content.steps.length}`
              : 'BEFORE YOU BEGIN'}
          </p>
          <h2 ref={title} id="lesson-guide-title" tabIndex={-1}>
            {step?.title ?? lesson.title}
          </h2>
          <p id="lesson-guide-description">{step?.text ?? content.purpose}</p>
          {!step && (
            <div className="guide-takeaway">
              <strong>What you will learn</strong>
              <p>{content.takeaway}</p>
            </div>
          )}
          {step && !spot && placement && (
            <p className="note">
              This control is not shown in your current view. You can explore it after the tour.
            </p>
          )}
          {step?.tryNext && spot && (
            <div className="guide-try">
              <button
                type="button"
                disabled={tried || target.current?.getAttribute('aria-disabled') === 'true'}
                onClick={() => {
                  const control = visibleTarget('[data-guide="next"]');
                  if (control?.getAttribute('aria-disabled') !== 'true') {
                    control?.click();
                    setTried(true);
                  }
                }}
              >
                {tried ? 'Step advanced ✓' : 'Try the highlighted Next step'}
              </button>
              <small>You are using the real lesson. This is optional.</small>
            </div>
          )}
          {!step && (
            <label className="guide-remember">
              <input
                type="checkbox"
                checked={hideNextTime}
                onChange={(event) => setHideNextTime(event.target.checked)}
              />{' '}
              Don’t open automatically for this lesson
            </label>
          )}
          <div className="guide-actions">
            <button type="button" className="quiet" onClick={close}>
              {step ? 'End tour' : 'Skip for now'}
            </button>
            {typeof stage === 'number' && stage > 0 && (
              <button type="button" onClick={() => move(stage - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (stage === 'intro') move(0);
                else if (typeof stage === 'number' && stage < content.steps.length - 1)
                  move(stage + 1);
                else close();
              }}
            >
              {!step
                ? 'Show me how to use this page →'
                : stage === content.steps.length - 1
                  ? 'Finish & explore'
                  : 'Next →'}
            </button>
          </div>
          <p className="guide-footnote">
            {step
              ? 'The tour moves only when you choose. Press Esc to leave.'
              : 'No account needed. You can reopen this with Page guide.'}
          </p>
        </section>
      </dialog>
    </>
  );
}
