import { localClearRevision } from '../../auth/localDataKey';
import { useAuth } from '../../auth/AuthProvider';
import { Term } from '../../components/Term';
import { useMemo, useState } from 'react';
import { LessonTrace } from './LessonTrace';
import { practiceQuestions, type Difficulty } from './practiceModel';
import { readProgress, recordAnswer, saveProgress } from './practiceProgress';

export function PracticeLesson() {
  const { accountId } = useAuth();
  const [seed, setSeed] = useState(632),
    [seedInput, setSeedInput] = useState('632'),
    [difficulty, setDifficulty] = useState<Difficulty>('intro');
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(''),
    [checked, setChecked] = useState(false),
    [solution, setSolution] = useState(false),
    [hint, setHint] = useState(false),
    [seedError, setSeedError] = useState('');
  const [clearRevision] = useState(() => localClearRevision(accountId));
  const [progress, setProgress] = useState(() => readProgress(accountId));
  const questions = useMemo(() => practiceQuestions(seed, difficulty), [seed, difficulty]),
    question = questions[index];
  const valid = /^\d{1,620}$/.test(answer.trim()),
    correct = valid && BigInt(answer.trim()) === question.answer;
  function choose(next: number) {
    setIndex(next);
    setAnswer('');
    setChecked(false);
    setSolution(false);
    setHint(false);
  }
  function check() {
    setChecked(true);
    if (!valid || clearRevision !== localClearRevision(accountId)) return;
    const next = recordAnswer(progress, question.id, question.topic, correct);
    setProgress(next);
    saveProgress(next, accountId, clearRevision);
  }
  const weak = Object.entries(progress.topics)
    .filter(([, stats]) => stats.correct < stats.attempts)
    .sort(([, a], [, b]) => a.correct / a.attempts - b.correct / b.attempts)
    .slice(0, 3);
  return (
    <section className="panel feature-body practice-lesson">
      <h2>Try it, then open the machine.</h2>
      <p>
        Ten reproducible exercises cover key setup, encryption/decryption,{' '}
        <Term term="modularInverse">inverse</Term>,{' '}
        <Term term="squareAndMultiply">modular powers</Term>, <Term term="millerRabin" />,{' '}
        <Term term="crt">CRT</Term> and <Term term="totient">totients</Term>. Progress is saved on
        this device when storage is available.
      </p>
      <div className="lesson-inputs">
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as Difficulty);
              choose(0);
            }}
          >
            <option value="intro">Intro · lecture-sized examples</option>
            <option value="exam">Exam · varied small inputs</option>
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(seedInput);
            if (
              !/^\d{1,10}$/.test(seedInput) ||
              !Number.isInteger(value) ||
              value < 0 ||
              value > 0xffffffff
            ) {
              setSeedError('Use a seed from 0 to 4294967295.');
              return;
            }
            setSeedError('');
            setSeed(value);
            choose(0);
          }}
        >
          <label>
            Practice seed
            <input
              inputMode="numeric"
              maxLength={10}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
          </label>
          <button className="secondary-button" type="submit">
            Load seed
          </button>
        </form>
      </div>
      {seedError && <p role="alert">{seedError}</p>}
      <p className="helper-text">
        First attempts: {progress.correct}/{progress.attempts} correct · streak {progress.streak} ·
        best {progress.best}. Rechecking the same question does not add points.
      </p>
      {weak.length > 0 && (
        <p className="helper-text">
          Topics to revisit: {weak.map(([topic]) => topic.replaceAll('-', ' ')).join(', ')}.
        </p>
      )}
      <nav className="practice-question-map" aria-label="Practice questions">
        {questions.map((q, i) => (
          <button
            className="action"
            key={q.id}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => choose(i)}
          >
            Question {i + 1}
          </button>
        ))}
      </nav>
      <h3>{question.prompt}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <label>
          Your answer
          <input
            inputMode="numeric"
            maxLength={620}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setChecked(false);
            }}
          />
        </label>
        <button className="primary-button" type="submit">
          Check answer
        </button>
      </form>
      {checked && (
        <p role="status">
          {!valid
            ? 'Enter a non-negative integer.'
            : correct
              ? 'Correct. Open the worked solution to inspect every calculation.'
              : 'Not yet. Try a hint or follow the worked solution.'}
        </p>
      )}
      <div className="feature-actions">
        <button className="secondary-button" onClick={() => setHint(!hint)}>
          {hint ? 'Hide hint' : 'Show hint'}
        </button>
        <button className="secondary-button" onClick={() => setSolution(!solution)}>
          {solution ? 'Hide worked solution' : 'Animate worked solution'}
        </button>
        <button className="secondary-button" onClick={() => choose((index + 1) % questions.length)}>
          Next question
        </button>
      </div>
      {hint && <p>{question.hint}</p>}
      {solution && (
        <>
          <p className="lesson-answer">Answer: {String(question.answer)}</p>
          <LessonTrace
            title="Practice solution machine"
            frames={question.frames}
            resetKey={question.id}
          />
        </>
      )}
      <button
        className="secondary-button"
        onClick={() => {
          const next = (seed + 1) >>> 0;
          setSeed(next);
          setSeedInput(String(next));
          choose(0);
        }}
      >
        Start a new set
      </button>
    </section>
  );
}
