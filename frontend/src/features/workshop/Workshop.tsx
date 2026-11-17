import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useLabTheme } from '../../app/LabTheme';
import { rememberInterface } from '../../app/interfacePreference';
import { routes } from '../../app/routes';
import { MachineCutaway } from './MachineCutaway';
import { WorkshopScene } from './WorkshopScene';
import {
  advanceJourney,
  initialJourney,
  journeyPhase,
  messageJourney,
  readMessage,
  type Journey,
  type LearningMode,
  type Station,
} from './model';
import { usePlayback } from './usePlayback';

export function Workshop() {
  const [mode, setMode] = useState<LearningMode>('guided');
  const [message, setMessage] = useState(88n),
    [input, setInput] = useState('88');
  const [error, setError] = useState(''),
    [altered, setAltered] = useState(false);
  const [selected, setSelected] = useState<Station>('sender');
  const [journey, setJourney] = useState<Journey>(initialJourney);
  const [speed, setSpeed] = useState(1);
  const systemReduced = useReducedMotion();
  const [motionChoice, setMotionChoice] = useState<boolean | null>(null);
  const reduced = motionChoice ?? Boolean(systemReduced);
  const { theme, setTheme } = useLabTheme();
  useEffect(() => {
    document.title = 'Animated workshop · RSA Lab';
  }, []);
  const advance = useCallback(
    (delta: number) => setJourney((old) => advanceJourney(old, delta / 160)),
    [],
  );
  usePlayback(journey.playing, speed, advance);
  const focusAfterClose = useRef(false);
  const playButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!journey.machine && focusAfterClose.current) {
      playButton.current?.focus({ preventScroll: true });
      focusAfterClose.current = false;
    }
  }, [journey.machine]);
  const { ciphertext, wire, recovered } = messageJourney(message, altered);
  const phase = journeyPhase(journey.progress);
  function inspect(station: Station) {
    setSelected(station);
    if (station === 'encrypt' || station === 'decrypt')
      setJourney({
        progress: station === 'encrypt' ? 16 : 64,
        machine: station,
        playing: false,
        automatic: false,
      });
    else if (mode === 'explore')
      setJourney({
        ...initialJourney,
        progress: station === 'sender' ? 0 : station === 'eve' ? 45 : 100,
      });
  }
  const continueJourney = useCallback(() => {
    focusAfterClose.current = true;
    setJourney((old) => ({
      ...initialJourney,
      progress: old.machine === 'encrypt' ? 39 : 87,
      playing: true,
    }));
  }, []);
  const closeMachine = useCallback(() => {
    focusAfterClose.current = true;
    setJourney((old) => ({ ...old, machine: null, playing: false, automatic: false }));
  }, []);
  function send() {
    const value = readMessage(input);
    if (value === null) {
      setError('Choose a whole number from 0 to 186.');
      return;
    }
    setError('');
    setMessage(value);
    setAltered(false);
    setJourney({ ...initialJourney, playing: true });
  }
  function stopAt(stop: number) {
    const station: Station = (['sender', 'encrypt', 'eve', 'decrypt', 'receiver'] as const)[stop];
    setSelected(station);
    setJourney({
      ...initialJourney,
      progress: [0, 16, 45, 64, 100][stop],
      machine: station === 'encrypt' || station === 'decrypt' ? station : null,
    });
  }
  const stories = [
    [
      'Alice has something to say.',
      `The message is ${message}. Press Play to follow it through both machines.`,
    ],
    [
      'The public key sets the machine in motion.',
      `${message} raised to 7, reduced modulo 187, becomes ${ciphertext}.`,
    ],
    [
      'The wire carries a different number.',
      `Eve sees ${wire} and the public key. Bob’s private exponent stays with Bob.`,
    ],
    [
      'Bob’s private key reverses the transformation.',
      `${wire} raised to 23, reduced modulo 187, becomes ${recovered}.`,
    ],
    [
      altered ? 'Something changed on the wire.' : 'The message comes home.',
      altered
        ? `Alice sent ${message}, but Bob receives ${recovered}. Textbook RSA does not detect this change.`
        : `${message} → ${ciphertext} → ${recovered}. Different keys, one complete journey.`,
    ],
  ];
  return (
    <main
      className={`rsa-playground ${journey.machine ? 'inside-machine' : ''}`}
      id="workshop-content"
    >
      <a className="skip-link" href="#workshop-scene">
        Skip to workshop
      </a>
      <header className="world-header">
        <Link to="/playground" className="wordmark" aria-label="RSA playground home">
          rsa<span>playground</span>
          <span className="prototype">THE LEARNING LAB</span>
        </Link>
        <div className="world-links">
          <Link className="legacy-switch" to="/legacy" onClick={() => rememberInterface('legacy')}>
            Legacy lab <ArrowRight size={14} />
          </Link>
          <button
            className="theme-switch"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>
      </header>
      <section className="world-intro">
        <div>
          <div className="eyebrow">THE ENCRYPTION WORKSHOP / 01</div>
          <h1>
            A secret.
            <br />A little machinery.
          </h1>
        </div>
        <div className="intro-aside">
          <p>Send it. Follow it. Take it apart.</p>
          <span>Small teaching keys · actual RSA calculations</span>
        </div>
      </section>
      <div className="entry-controls">
        <div className="mode-switch" aria-label="Learning mode">
          <button aria-pressed={mode === 'guided'} onClick={() => setMode('guided')}>
            Guide me
          </button>
          <button aria-pressed={mode === 'explore'} onClick={() => setMode('explore')}>
            Explore freely
          </button>
        </div>
        <span>
          {mode === 'guided'
            ? 'Follow the journey, one idea at a time.'
            : 'Open any machine. Change the message. Intercept it.'}
        </span>
      </div>
      <section id="workshop-scene" aria-label="Encryption journey">
        {journey.machine ? (
          <MachineCutaway
            key={`${journey.machine}-${message}-${altered}`}
            kind={journey.machine}
            base={journey.machine === 'encrypt' ? message : wire}
            automatic={journey.automatic}
            reduced={reduced}
            speed={speed}
            onSpeed={setSpeed}
            onClose={closeMachine}
            onContinue={continueJourney}
          />
        ) : (
          <WorkshopScene
            progress={journey.progress}
            playing={journey.playing}
            reduced={reduced}
            message={message}
            ciphertext={ciphertext}
            wire={wire}
            recovered={recovered}
            altered={altered}
            selected={selected}
            onInspect={inspect}
            onReduce={() => setMotionChoice(!reduced)}
          />
        )}
      </section>
      <div className="story-strip">
        <span className="story-number">0{phase + 1}</span>
        <div aria-live="polite">
          <strong>
            {journey.machine
              ? `Inside the ${journey.machine === 'encrypt' ? 'encryption' : 'decryption'} machine.`
              : stories[phase][0]}
          </strong>
          <p>
            {journey.machine
              ? 'Read each exponent bit: square, multiply if the bit is 1, and keep the remainder.'
              : stories[phase][1]}
          </p>
        </div>
        <span className="story-tag">
          {mode === 'guided' ? 'GUIDED JOURNEY' : 'FREE EXPLORATION'}
        </span>
      </div>
      {!journey.machine && (
        <>
          <div className="transport">
            <button
              className="play"
              ref={playButton}
              onClick={() =>
                setJourney((old) => ({
                  ...old,
                  progress: old.progress >= 100 ? 0 : old.progress,
                  playing: !old.playing,
                }))
              }
            >
              {journey.playing ? <Pause size={14} /> : <Play size={14} />}
              <span>
                {journey.playing
                  ? 'Pause journey'
                  : journey.progress >= 100
                    ? 'Replay journey'
                    : 'Play journey'}
              </span>
            </button>
            <button
              className="replay"
              aria-label="Rewind journey"
              onClick={() => setJourney(initialJourney)}
            >
              <RotateCcw size={15} />
            </button>
            <div className="journey-timeline">
              <label htmlFor="journey-progress">
                Journey <output>{Math.round(journey.progress)}%</output>
              </label>
              <input
                id="journey-progress"
                type="range"
                min="0"
                max="100"
                step=".1"
                value={journey.progress}
                onChange={(e) =>
                  setJourney({ ...initialJourney, progress: Number(e.target.value) })
                }
              />
              <div className="journey-timeline-labels">
                <span>Write</span>
                <span>Encrypt</span>
                <span>Travel</span>
                <span>Decrypt</span>
                <span>Read</span>
              </div>
            </div>
            <label className="speed">
              Speed
              <select
                aria-label="Journey speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.6}>0.6×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
            </label>
          </div>
          {mode === 'guided' && (
            <nav className="guided-stops" aria-label="Guided journey stops">
              {['Write', 'Encrypt', 'Travel', 'Decrypt', 'Read'].map((label, i) => (
                <button
                  key={label}
                  aria-current={i === phase ? 'step' : undefined}
                  onClick={() => stopAt(i)}
                >
                  <span>0{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
          )}
          <section className="inspection" aria-label="Object inspector">
            <div className="inspector-heading">
              <span className="eyebrow">
                {selected === 'sender'
                  ? 'ALICE / MESSAGE'
                  : selected === 'eve'
                    ? 'EVE / INTERCEPTION'
                    : selected === 'receiver'
                      ? 'BOB / DELIVERY'
                      : 'ON THE WORKBENCH'}
              </span>
              <span className="inspect-hint">Select any machine to watch its calculations</span>
            </div>
            {selected === 'sender' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <div className="inspector-layout">
                  <div>
                    <h2>What would you like to send?</h2>
                    <p className="inspect-copy">
                      Try a number from 0 to 186. These tiny keys let you follow every calculation.
                    </p>
                  </div>
                  <div className="edit-message">
                    <label htmlFor="workshop-message">
                      YOUR MESSAGE
                      <input
                        id="workshop-message"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value);
                          setError('');
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'message-error' : undefined}
                      />
                    </label>
                    <button type="submit" className="action">
                      Send it through
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="error" id="message-error" role="alert">
                    {error}
                  </p>
                )}
              </form>
            )}
            {selected === 'eve' && (
              <>
                <div className="inspector-layout">
                  <div>
                    <h2>Meet the person on the wire.</h2>
                    <p className="inspect-copy">
                      Eve sees ciphertext {String(wire)}. Alter it to see why textbook RSA alone
                      does not detect tampering. Tiny keys are easy to break too.
                    </p>
                  </div>
                  <button
                    className="action"
                    onClick={() => {
                      setAltered(!altered);
                      setJourney({ ...initialJourney, progress: 45 });
                    }}
                  >
                    {altered ? 'Restore original ciphertext' : 'Alter ciphertext (+1)'}
                  </button>
                </div>
                <div className="math-work">
                  <small>ON THE WIRE</small>
                  <span className="math-part">{String(wire)}</span>
                  <small>BOB WILL RECEIVE</small>
                  <span className="math-part">{String(recovered)}</span>
                </div>
              </>
            )}
            {selected === 'receiver' && (
              <div className="inspector-layout">
                <div>
                  <h2>{altered ? 'A changed message arrives.' : 'Back where we started.'}</h2>
                  <p className="inspect-copy">
                    Alice sent {String(message)}. Bob receives {String(recovered)}.
                    {altered
                      ? ' Real protocols need integrity protection as well as encryption.'
                      : ' The journey follows real modular arithmetic with deliberately small keys.'}
                  </p>
                </div>
                <button
                  className="action"
                  onClick={() => {
                    setSelected('sender');
                    setJourney(initialJourney);
                  }}
                >
                  Try another message
                </button>
              </div>
            )}
            {(selected === 'encrypt' || selected === 'decrypt') && (
              <div className="inspector-layout">
                <div>
                  <h2>
                    {selected === 'encrypt'
                      ? 'A public key anyone can use.'
                      : 'Only Bob needs this key.'}
                  </h2>
                  <p className="inspect-copy">
                    Public key: (7, 187). Private exponent: 23. The modulus is 17 × 11.
                  </p>
                </div>
                <button className="action" onClick={() => inspect(selected)}>
                  Watch inside
                </button>
              </div>
            )}
          </section>
        </>
      )}
      <details className="lesson-directory">
        <summary>
          Explore all lessons and tools <span>Open in the Legacy lab</span>
        </summary>
        <nav aria-label="All lessons">
          {['Learn', 'Break', 'Tools'].map((group) => (
            <div key={group}>
              <h2>{group}</h2>
              {routes
                .filter((route) => route.group === group)
                .map((route) => (
                  <Link key={route.path} to={route.path}>
                    {route.label}
                    <ArrowRight size={13} />
                  </Link>
                ))}
            </div>
          ))}
        </nav>
      </details>
      <footer className="world-footer">
        <span>Learning by taking things apart.</span>
        <span>Textbook RSA · intentionally insecure demo keys · use demonstration data</span>
      </footer>
    </main>
  );
}
