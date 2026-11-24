import { Link } from 'react-router-dom';
import { CircleUserRound, UserRoundCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import './account-link.css';

// Show the active AuthProvider session, including its explicit guest override.
export function AccountLink() {
  const { session, guestOverride } = useAuth();
  const email = session?.user.email;
  const label = session ? 'Signed in' : guestOverride ? 'Guest mode' : 'Sign in';
  const identity = email ?? 'your account';
  const description = session
    ? `Account: signed in ${identity}`
    : guestOverride
      ? 'Account: guest mode is active'
      : 'Account: sign in';
  return (
    <Link
      to="/account"
      className="alt account-link"
      data-signed-in={Boolean(session)}
      aria-label={description}
      title={description}
    >
      {session ? (
        <UserRoundCheck size={18} aria-hidden="true" />
      ) : (
        <CircleUserRound size={18} aria-hidden="true" />
      )}
      <span className="account-link-copy">
        <span>
          {label}
          {session && ' '}
        </span>
        {session && <small className="account-link-email">{identity}</small>}
      </span>
    </Link>
  );
}
