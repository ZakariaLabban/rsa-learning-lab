import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CrtCards } from './CrtPage';
import { EeaTable } from './EuclidPages';
import { practiceSet, type Level, type PracticeQuestion, type Solution } from './practice';
import { Collapse, fmt, HandMethod, Idea, SlideRef, LessonHeader } from './parts';

function SolutionView({ solution }: { solution: Solution }) {
  switch (solution.type) {
    case 'gcd':
      return (
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Table, scrolls sideways on narrow screens"
        >
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Division: dividend = quotient × divisor + remainder</th>
              </tr>
            </thead>
            <tbody>
              {solution.rows.map((row, index) => (
                <tr key={index}>
                  <td className="eq">
                    {fmt(row.dividend)} = {fmt(row.quotient)} × {fmt(row.divisor)} +{' '}
                    {fmt(row.remainder)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'eea':
      return <EeaTable run={solution.run} shown={solution.run.rows.length} />;
    case 'power':
      return <HandMethod run={solution.run} />;
    case 'crt':
      return (
        <CrtCards
          crt={solution.run}
          shown={solution.run.rows.length + 3}
          from="The residues are given in the question."
        />
      );
    case 'text':
      return (
        <ul className="lines plain">
          {solution.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      );
  }
}

function Question({
  question,
  index,
  onResult,
  focus,
}: {
  question: PracticeQuestion;
  index: number;
  onResult: (id: string, correct: boolean) => void;
  focus: boolean;
}) {
  const box = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focus) box.current?.scrollIntoView({ block: 'start' });
  }, [focus]);
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<'none' | 'right' | 'wrong' | 'invalid'>('none');
  function check() {
    if (!/^\d+$/.test(value.trim())) {
      setVerdict('invalid');
      return;
    }
    const right = BigInt(value.trim()) === question.answer;
    setVerdict(right ? 'right' : 'wrong');
    onResult(question.id, right);
  }
  return (
    <li className={focus ? 'question focus' : 'question'} ref={box}>
      <h3>
        {index + 1}. {question.title}
      </h3>
      <p className="prompt">{question.prompt}</p>
      <form
        className="answer-row"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <label htmlFor={`answer-${question.id}`}>Your answer</label>
        <input
          id={`answer-${question.id}`}
          value={value}
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => {
            setValue(event.target.value);
            setVerdict('none');
          }}
        />
        <button type="submit" className="primary">
          Check
        </button>
      </form>
      <p className={`verdict ${verdict}`} role="status">
        {verdict === 'right' && `✓ Correct: ${fmt(question.answer)}.`}
        {verdict === 'wrong' && '✗ Not quite. Open the hint, or show the steps.'}
        {verdict === 'invalid' && 'Type a whole number.'}
      </p>
      <Collapse title="Hint">
        <p>{question.hint}</p>
      </Collapse>
      <Collapse title="Show the steps and the answer">
        <SolutionView solution={question.solution} />
        <p className="result">
          Answer: <strong>{fmt(question.answer)}</strong>
        </p>
      </Collapse>
    </li>
  );
}

export function PracticePage() {
  const [params] = useSearchParams();
  const focusKind = params.get('q');
  const [level, setLevel] = useState<Level>('lecture');
  const [seed, setSeed] = useState(1);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const questions = useMemo(() => practiceSet(seed, level), [seed, level]);
  const correct = questions.filter((q) => results[q.id]).length;
  return (
    <article>
      <LessonHeader title="Practice with the lecture’s numbers" />
      <Idea>
        Try each question on paper first, then type your answer. If you are stuck, open the hint, or
        show the steps to see the same table you would draw in the exam.
      </Idea>
      <SlideRef>Every question matches a page of this course.</SlideRef>
      <div className="inputs">
        <div className="fields">
          <div className="field">
            <label htmlFor="level">Numbers</label>
            <select
              id="level"
              value={level}
              onChange={(event) => setLevel(event.target.value as Level)}
            >
              <option value="lecture">The lecture’s examples (17, 11, 7 …)</option>
              <option value="random">New random numbers</option>
            </select>
          </div>
        </div>
        <div className="controls">
          <button
            type="button"
            onClick={() =>
              setSeed((value) => (value + 1 + Math.floor(Math.random() * 1000)) % 4294967295)
            }
            disabled={level === 'lecture'}
          >
            New quiz
          </button>
          <span className="counter">
            {correct} of {questions.length} correct
          </span>
        </div>
      </div>
      <ol className="questions">
        {questions.map((question, index) => (
          <Question
            key={question.id}
            question={question}
            index={index}
            focus={question.kind === focusKind}
            onResult={(id, right) => setResults((old) => ({ ...old, [id]: right }))}
          />
        ))}
      </ol>
    </article>
  );
}
