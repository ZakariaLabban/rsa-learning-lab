import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Moon, PanelLeft, Sun } from 'lucide-react';
import { useLabTheme } from '../../app/LabTheme';
import { rememberInterface } from '../../app/interfacePreference';
import { BroadcastPage, FactoringPage, GuessingPage } from './AttackPages';
import { ContactsPage } from './ContactsPage';
import { CrtPage } from './CrtPage';
import { GcdPage, InversePage } from './EuclidPages';
import { KeysPage } from './KeysPage';
import { MessagesPage } from './MessagesPage';
import { PowerPage } from './PowerPage';
import { PracticePage } from './PracticePage';
import { clauseNumber, GROUPS, LESSONS } from './lessons';
import { PrimalityPage } from './PrimalityPage';
import { RsaPage } from './RsaPage';
import { SignaturesPage } from './SignaturesPage';
import { StartPage } from './StartPage';
import { WhyPage } from './WhyPage';
import { resetPageMeta, setPageMeta } from './pageMeta';
import './standard.css';
import './standard-figures.css';

const ELEMENTS: Record<string, ReactNode> = {
  '/lecture/start': <StartPage />,
  '/lecture/gcd': <GcdPage />,
  '/lecture/inverse': <InversePage />,
  '/lecture/power': <PowerPage />,
  '/lecture/rsa': <RsaPage />,
  '/lecture/why': <WhyPage />,
  '/lecture/signatures': <SignaturesPage />,
  '/lecture/primality': <PrimalityPage />,
  '/lecture/crt': <CrtPage />,
  '/lecture/factoring': <FactoringPage />,
  '/lecture/small-e': <BroadcastPage />,
  '/lecture/guessing': <GuessingPage />,
  '/lecture/keys': <KeysPage />,
  '/lecture/contacts': <ContactsPage />,
  '/lecture/messages': <MessagesPage />,
  '/lecture/practice': <PracticePage />,
};

function CourseMap({ current }: { current: string }) {
  return (
    <nav className="course-map" aria-label="Course map">
      {GROUPS.map((group, g) => {
        const here = group.lessons.some((l) => l.path === current);
        return (
          <details key={`${group.name}-${here}`} open={here}>
            <summary>
              <span className="cn">{g}</span>
              {group.name}
            </summary>
            <ul>
              {group.lessons.map((lesson) => (
                <li key={lesson.path}>
                  <NavLink to={lesson.path}>
                    <span className="cn" aria-hidden="true">
                      {clauseNumber(lesson.path)}
                    </span>
                    {lesson.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

function Home() {
  return (
    <article>
      <header>
        <h1>Learn RSA, one step at a time</h1>
      </header>
      <p className="lead">
        This course follows the lecture slides. Every page shows the same tables as the slides and
        fills them in one row at a time. You decide when to move on: press “Next step”.
      </p>
      <div className="start-cta">
        <Link to={LESSONS[0].path} className="button primary big">
          Start with lesson 1 →
        </Link>
        <span className="note">
          New to RSA? Follow the clauses in order. Already know some? Jump in anywhere.
        </span>
      </div>
      <h2 className="contents-title">Contents</h2>
      {GROUPS.map((group, g) => (
        <section key={group.name} className="course-group">
          <h3 className="part">
            <span className="number">{g}</span>
            {group.name}
            <small>{group.blurb}</small>
          </h3>
          <ol className="cards">
            {group.lessons.map((lesson) => (
              <li key={lesson.path}>
                <Link to={lesson.path}>
                  <span className="number">{clauseNumber(lesson.path)}</span>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.source}</small>
                  <span className="text">{lesson.text}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="more">
        Prefer the animated workshop? It is still here:{' '}
        <Link to="/playground">open the workshop</Link>.
      </p>
    </article>
  );
}

function NotFound() {
  return (
    <article>
      <header>
        <h1>Page not found</h1>
      </header>
      <p className="lead">
        Error 404. This address does not match a lesson. It may have been mistyped, or the lesson
        may have moved.
      </p>
      <div className="start-cta">
        <Link to="/lecture" className="button primary big">
          Back to the course map
        </Link>
        <Link to={LESSONS[0].path} className="button">
          Start with lesson 1
        </Link>
      </div>
    </article>
  );
}

function LessonNav({ path }: { path: string }) {
  const index = LESSONS.findIndex((lesson) => lesson.path === path);
  if (index < 0) return null;
  const lesson = LESSONS[index],
    previous = LESSONS[index - 1],
    next = LESSONS[index + 1];
  return (
    <>
      {lesson.practice && (
        <aside className="try-it" aria-label="Try it yourself">
          <div>
            <strong>Your turn</strong>
            <span>Check that you got it with a question on this topic.</span>
          </div>
          <Link to={`/lecture/practice?q=${lesson.practice}`} className="button">
            Try a practice question →
          </Link>
        </aside>
      )}
      <nav className="lesson-nav" aria-label="Previous and next lesson">
        {previous ? (
          <Link to={previous.path} className="prev">
            <small>Previous lesson</small>← {previous.label}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={next.path} className="next">
            <small>Next lesson</small>
            {next.label} →
          </Link>
        ) : (
          <Link to="/lecture" className="next">
            <small>Finished</small>
            Back to the course map
          </Link>
        )}
      </nav>
    </>
  );
}

export function LectureShell() {
  const { theme, setTheme } = useLabTheme();
  const { pathname } = useLocation();
  const current = pathname.replace(/\/$/, '').toLowerCase();
  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem('rsa-lab-rail') !== 'closed';
    } catch {
      return true;
    }
  });
  const toggleRail = () => {
    const next = !railOpen;
    setRailOpen(next);
    try {
      localStorage.setItem('rsa-lab-rail', next ? 'open' : 'closed');
    } catch {
      /* the choice just is not remembered */
    }
  };
  useEffect(() => rememberInterface('lecture'), []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const lesson = LESSONS.find((item) => item.path === current);
    const atHome = current === '' || current === '/lecture';
    if (lesson) setPageMeta({ title: lesson.title, description: lesson.text, path: lesson.path });
    else if (atHome) setPageMeta({});
    else setPageMeta({ title: 'Page not found', notFound: true });
    // reset the page info when we leave
    return resetPageMeta;
  }, [current]);
  return (
    <div className="lecture">
      <a className="skip-link" href="#lesson">
        Skip to the lesson
      </a>
      <header className="bar">
        <button
          type="button"
          className="rail-toggle"
          aria-expanded={railOpen}
          aria-controls="course-rail"
          onClick={toggleRail}
        >
          <PanelLeft size={16} aria-hidden="true" />
          <span>{railOpen ? 'Hide contents' : 'Show contents'}</span>
        </button>
        <Link to="/" className="brand">
          RSA Lab
        </Link>
        <span className="tagline">Learn RSA step by step</span>
        <Link to="/playground" className="alt">
          Animated workshop
        </Link>
        <button
          type="button"
          className="theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
          <span aria-hidden="true">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>
      <div className={`layout${railOpen ? '' : ' rail-closed'}`}>
        <aside className="side" id="course-rail">
          <details className="map-toggle" open={false}>
            <summary>Course map</summary>
            <CourseMap current={current} />
          </details>
          <div className="map-desktop">
            <CourseMap current={current} />
          </div>
        </aside>
        <main id="lesson" tabIndex={-1}>
          <Routes>
            {LESSONS.map((lesson) => (
              <Route key={lesson.path} path={lesson.path} element={ELEMENTS[lesson.path]} />
            ))}
            <Route path="/" element={<Home />} />
            <Route path="/lecture" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <LessonNav path={current} />
        </main>
      </div>
    </div>
  );
}
