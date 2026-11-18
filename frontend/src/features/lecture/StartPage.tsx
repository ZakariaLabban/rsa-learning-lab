import { Link } from 'react-router-dom';
import { BigPicture } from './diagrams';
import { Collapse, Idea, Words, LessonHeader } from './parts';

export function StartPage() {
  return (
    <article>
      <LessonHeader title="The big picture" />
      <Idea>
        RSA lets two people who have <b>never met</b> send each other secrets. Each person has a
        pair of keys: a <b>public</b> key that anybody may have, and a <b>private</b> key that only
        its owner keeps. Press “Next step” to watch it happen.
      </Idea>
      <BigPicture />
      <Collapse title="What does the maths have to do with it?" open>
        <p>
          The “box” and the “keys” are really numbers. Locking is a calculation with the public key,
          and unlocking is a calculation with the private key. The lessons that follow teach you
          each piece of that calculation, in this order:
        </p>
        <ol className="lines">
          <li>
            <b>GCD and inverse:</b> how to make a pair of keys that fit together.
          </li>
          <li>
            <b>Powers mod n:</b> how to compute the huge powers that locking needs.
          </li>
          <li>
            <b>RSA by hand:</b> make keys, lock and unlock a message with small numbers.
          </li>
          <li>
            <b>Why it works, and signatures:</b> the proof, and proving who sent a message.
          </li>
          <li>
            <b>Going further, attacks, real use, practice.</b>
          </li>
        </ol>
      </Collapse>
      <Words terms={['publicKey', 'privateKey', 'plaintext', 'ciphertext', 'attacker']} />
      <div className="start-cta">
        <Link to="/lecture/gcd" className="button primary big">
          Start the maths: 1.1 GCD →
        </Link>
      </div>
    </article>
  );
}
