import type { PrivateKey } from '../../engine/math';
import { KeyWizard } from '../keys/KeyWizard';
import { MyKeys } from '../keys/MyKeys';
import { FilePanel } from '../files/FilePanel';

export function KeysLesson({ onUse }: { onUse: (key: PrivateKey) => Promise<void> }) {
  return (
    <>
      <KeyWizard />
      <MyKeys onUse={onUse} />
    </>
  );
}

export function FilesLesson() {
  return (
    <section className="panel feature-body">
      <h2>A file’s protected journey</h2>
      <p>
        AES-GCM protects the file. RSA-OAEP wraps the small AES key. Follow the actual envelope
        fields after running the operation.
      </p>
      <FilePanel />
    </section>
  );
}
