import { AccountLayout } from './AccountLayout';
import { Link } from 'react-router-dom';

const supportEmail = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL?.trim();
const deletionRequest =
  supportEmail && /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(supportEmail)
    ? `mailto:${supportEmail}?subject=RSA%20Learning%20Lab%20account%20deletion`
    : null;

export function PrivacyPage() {
  return (
    <AccountLayout>
      <Link to="/account">← Back to Account</Link>

      <h1 className="account-title">Privacy and Data</h1>

      <p>
        RSA Learning Lab is an educational application. You can use its RSA lessons and
        cryptographic tools without creating an account.
      </p>

      <h2>Data in this browser</h2>
      <p>
        RSA calculations run locally. Contacts and practice progress are saved separately for guests
        and for each signed-in account in this browser. Signing out returns you to the guest
        profile. Browser storage is accessible to people with access to this browser profile.
      </p>
      <h2>Private keys and exports</h2>
      <p>
        Private keys stay in memory by default. Reloading or closing the tab discards them. For
        signed-in profiles, signing out or switching accounts also discards private keys held only
        in memory. Opting to remember them saves them unencrypted in browser storage. Public-key
        exports are suitable for sharing. A private-key export contains secret key material and
        stays wherever you save or send it, even after clearing lab data.
      </p>
      <h2>Account and cloud data</h2>
      <p>
        Supabase processes your email and manages your session. This browser stores the session to
        keep you signed in. While you are signed in, your account’s public keys, contacts,
        verification choices and practice progress sync to cloud storage, together with any
        public-key sharing links you create. Private keys are never uploaded. Signing in never
        uploads guest data automatically: importing guest public data is a separate choice on the
        Account page, and the guest profile stays on this device.
      </p>
      <p>
        Contact names, public keys and QR codes do not establish identity. Verify fingerprints
        through a separate trusted channel.
      </p>
      <h2>Deletion</h2>
      <p>
        Use Clear Local Data on the Account page to remove this profile’s local keys, contacts and
        practice progress. To clear guest data, sign out first. Downloaded files must be removed
        separately.
      </p>
      <p>
        Delete My Cloud Data removes your stored public keys, contacts, practice progress and
        sharing links and disables cloud writes. Removing the authentication account and email is a
        separate administrative operation. Self-service account deletion is currently unavailable.
      </p>

      {deletionRequest ? (
        <p>
          <a href={deletionRequest}>Request account and email deletion</a> from the address you use
          to sign in. The project administrator will verify your request.
        </p>
      ) : (
        <p>The project has yet to configure an account-deletion contact.</p>
      )}

      <h2>Security limitations</h2>
      <p>
        RSA Learning Lab contains educational cryptographic implementations that have not undergone
        a production security audit. Do not use the application to protect sensitive information.
      </p>

      <p>
        <Link to="/account">Return to your account</Link>
      </p>
    </AccountLayout>
  );
}
