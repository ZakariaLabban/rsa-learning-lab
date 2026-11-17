import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
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
import type { PracticeKind } from './practice';
import { PrimalityPage } from './PrimalityPage';
import { RsaPage } from './RsaPage';
import { SignaturesPage } from './SignaturesPage';
import { StartPage } from './StartPage';
import { WhyPage } from './WhyPage';
import './lecture.css';
import './lecture-course.css';
import './lecture-art.css';
import './lecture-polish.css';

type Lesson = {
  path: string;
  label: string;
  title: string;
  text: string;
  source: string;
  element: ReactNode;
  /** A practice question that matches this lesson. */
  practice?: PracticeKind;
};
type Group = { name: string; blurb: string; lessons: Lesson[] };

/** The course, in the order a first-time student should follow it. */
export const GROUPS: Group[] = [
  {
    name: 'Start here',
    blurb: 'Two minutes: what RSA is, with a picture.',
    lessons: [
      {
        path: '/lecture/start',
        label: 'The big picture',
        title: 'The big picture',
        text: 'Alice, Bob, a locked box and two keys.',
        source: 'Overview',
        element: <StartPage />,
      },
    ],
  },
  {
    name: 'The tools',
    blurb: 'The three calculations RSA is built from (lecture chapters 4 and 9).',
    lessons: [
      {
        path: '/lecture/gcd',
        label: 'GCD',
        title: 'Greatest common divisor',
        text: 'Divide and keep the remainder until it is 0.',
        source: 'Chapter 4',
        element: <GcdPage />,
        practice: 'gcd',
      },
      {
        path: '/lecture/inverse',
        label: 'Inverse mod m',
        title: 'Inverse mod m',
        text: 'Fill the Q, A1–A3, B1–B3 table to find b⁻¹.',
        source: 'Chapter 4',
        element: <InversePage />,
        practice: 'inverse',
      },
      {
        path: '/lecture/power',
        label: 'Fast powers',
        title: 'Square and multiply',
        text: 'Compute a^b mod n with small steps and the lecture table.',
        source: 'Chapter 9',
        element: <PowerPage />,
        practice: 'power',
      },
    ],
  },
  {
    name: 'RSA',
    blurb: 'The algorithm itself (lecture chapter 9).',
    lessons: [
      {
        path: '/lecture/rsa',
        label: 'RSA by hand',
        title: 'RSA by hand',
        text: 'Make keys, encrypt, decrypt: the lecture example.',
        source: 'Chapter 9',
        element: <RsaPage />,
        practice: 'encrypt',
      },
      {
        path: '/lecture/why',
        label: 'Why it works',
        title: 'Why RSA works',
        text: 'Fermat, Euler and the proof, with real numbers.',
        source: 'Chapters 8 and 9',
        element: <WhyPage />,
        practice: 'phi',
      },
      {
        path: '/lecture/signatures',
        label: 'Signatures',
        title: 'Digital signatures',
        text: 'Sign with the private key, verify with the public key.',
        source: 'Chapter 9',
        element: <SignaturesPage />,
      },
    ],
  },
  {
    name: 'Going further',
    blurb: 'How real keys are found, and faster decryption (lecture chapter 8).',
    lessons: [
      {
        path: '/lecture/primality',
        label: 'Is n prime?',
        title: 'Miller–Rabin primality test',
        text: 'How the primes for a key are found.',
        source: 'Chapter 8',
        element: <PrimalityPage />,
        practice: 'mr',
      },
      {
        path: '/lecture/crt',
        label: 'Remainders (CRT)',
        title: 'Chinese Remainder Theorem',
        text: 'Rebuild a number from its remainders, and decrypt faster.',
        source: 'Chapters 8 and 9',
        element: <CrtPage />,
        practice: 'crt',
      },
    ],
  },
  {
    name: 'Break it',
    blurb: 'Why the choices in RSA matter: three attacks.',
    lessons: [
      {
        path: '/lecture/factoring',
        label: 'Factor n',
        title: 'Break a small key by factoring',
        text: 'Find p and q, rebuild d, read the message.',
        source: 'Chapter 9',
        element: <FactoringPage />,
      },
      {
        path: '/lecture/small-e',
        label: 'Small e',
        title: 'Same message, small e',
        text: 'Combine ciphertexts with the CRT and take a root.',
        source: 'Chapter 9',
        element: <BroadcastPage />,
      },
      {
        path: '/lecture/guessing',
        label: 'YES or NO?',
        title: 'Guessing a predictable message',
        text: 'Why textbook RSA needs random padding.',
        source: 'Chapter 9',
        element: <GuessingPage />,
      },
    ],
  },
  {
    name: 'Use it for real',
    blurb: 'Real keys and real messages in your browser.',
    lessons: [
      {
        path: '/lecture/keys',
        label: 'My keys',
        title: 'My keys',
        text: 'Make, import and manage key pairs.',
        source: 'Chapter 9',
        element: <KeysPage />,
      },
      {
        path: '/lecture/contacts',
        label: 'Contacts',
        title: 'Contacts and sharing keys',
        text: 'Share your public key and check fingerprints.',
        source: 'Chapter 9',
        element: <ContactsPage />,
      },
      {
        path: '/lecture/messages',
        label: 'Messages and files',
        title: 'Send and receive secrets',
        text: 'Encrypt text and files, and sign them.',
        source: 'Chapter 9',
        element: <MessagesPage />,
      },
    ],
  },
  {
    name: 'Practice',
    blurb: 'Test yourself, like in the exam.',
    lessons: [
      {
        path: '/lecture/practice',
        label: 'Practice questions',
        title: 'Practice with the lecture’s numbers',
        text: 'Nine questions with hints and full solutions.',
        source: 'All chapters',
        element: <PracticePage />,
      },
    ],
  },
];
export const LESSONS = GROUPS.flatMap((group) => group.lessons);

function CourseMap({ current }: { current: string }) {
  return (
    <nav className="course-map" aria-label="Course map">
      {GROUPS.map((group) => (
        <details
          key={`${group.name}-${group.lessons.some((l) => l.path === current)}`}
          open={group.lessons.some((lesson) => lesson.path === current)}
        >
          <summary>{group.name}</summary>
          <ul>
            {group.lessons.map((lesson) => (
              <li key={lesson.path}>
                <NavLink to={lesson.path}>{lesson.label}</NavLink>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}

function Home() {
  let number = 0;
  return (
    <article>
      <header>
        <p className="eyebrow">RSA Learning Lab</p>
        <h1>Learn RSA, one step at a time</h1>
        <p className="lead">
          This course follows the lecture slides. Every page shows the same tables as the slides and
          fills them in one row at a time. You decide when to move on: press “Next step”.
        </p>
      </header>
      <div className="start-cta">
        <Link to={LESSONS[0].path} className="button primary big">
          Start with lesson 1 →
        </Link>
        <span className="note">
          New to RSA? Follow the lessons in order. Already know some? Jump in anywhere.
        </span>
      </div>
      {GROUPS.map((group) => (
        <section key={group.name} className="course-group">
          <h2>{group.name}</h2>
          <p className="note">{group.blurb}</p>
          <ol className="cards" start={number + 1}>
            {group.lessons.map((lesson) => {
              number++;
              return (
                <li key={lesson.path}>
                  <Link to={lesson.path}>
                    <span className="number">{number}</span>
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.source}</small>
                      <span className="text">{lesson.text}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
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
            <small>← Previous</small>
            {previous.label}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={next.path} className="next">
            <small>Next lesson →</small>
            {next.label}
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
  useEffect(() => rememberInterface('lecture'), []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const lesson = LESSONS.find((item) => item.path === current);
    document.title = lesson ? `${lesson.title} · RSA Lab` : 'RSA Lab · Learn RSA step by step';
  }, [current]);
  return (
    <div className="lecture">
      <header className="bar">
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
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>
      <div className="layout">
        <aside className="side">
          <details className="map-toggle" open={false}>
            <summary>Course map</summary>
            <CourseMap current={current} />
          </details>
          <div className="map-desktop">
            <CourseMap current={current} />
          </div>
        </aside>
        <main>
          <Routes>
            {LESSONS.map((lesson) => (
              <Route key={lesson.path} path={lesson.path} element={lesson.element} />
            ))}
            <Route path="*" element={<Home />} />
          </Routes>
          <LessonNav path={current} />
        </main>
      </div>
    </div>
  );
}
