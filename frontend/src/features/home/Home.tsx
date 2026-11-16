import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FlaskConical } from 'lucide-react';
import { NumberView } from '../../components/NumberView';
import { RolePanels } from '../../components/RolePanels';
import { Term } from '../../components/Term';

export function Home() {
  return (
    <>
      <section className="home-hero">
        <span className="eyebrow">RSA LAB · EECE 455 / 632</span>
        <h1>
          Understand the keys.
          <br />
          Question the security.
        </h1>
        <p>
          An interactive place to learn RSA mathematics and explore what happens when it is used
          badly.
        </p>
        <div className="hero-links">
          <Link className="primary-button" to="/learn/example">
            Try a worked example <ArrowRight size={16} />
          </Link>
          <Link className="secondary-button" to="/learn/encrypt">
            Encrypt a message
          </Link>
        </div>
      </section>
      <div className="track-grid">
        <section className="panel track-card">
          <BookOpen size={26} />
          <h2>Learn the mathematics</h2>
          <p>
            Follow a small example from primes to recovered plaintext. Explore the public and
            private operations.
          </p>
          <Link className="text-button aqua-text" to="/learn/example">
            Start learning <ArrowRight size={16} />
          </Link>
        </section>
        <section className="panel track-card">
          <FlaskConical size={26} />
          <h2>Break the assumptions</h2>
          <p>
            Upcoming guided attacks cover tiny keys, guessable messages and repeated messages sent
            with a small exponent.
          </p>
          <Link className="text-button aqua-text" to="/break/factoring">
            See what is planned <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel example-preview">
        <div>
          <span className="eyebrow">SMALL NUMBERS. REAL MATHEMATICS.</span>
          <h2>One public number connects two keys.</h2>
          <p>
            For primes 17 and 11, the <Term term="modulus" /> is 187. The <Term term="publicKey" />{' '}
            can be shared; the <Term term="privateKey" /> stays secret.
          </p>
        </div>
        <NumberView label="n = 17 × 11" value={187n} />
      </section>
      <RolePanels
        roles={[
          {
            name: 'Alice',
            knowledge: 'Bob’s public key and her original message.',
            action: 'Uses the public key to encrypt.',
          },
          {
            name: 'Bob',
            knowledge: 'His public and private keys.',
            action: 'Uses the private key to recover the message.',
          },
          {
            name: 'Eve',
            knowledge: 'The public key and intercepted ciphertext.',
            action: 'The Break track explores weak choices she can exploit.',
          },
        ]}
      />
    </>
  );
}
