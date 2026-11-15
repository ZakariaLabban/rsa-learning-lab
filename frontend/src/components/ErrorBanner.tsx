import { CircleHelp, X } from 'lucide-react';

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="error-banner">
      <CircleHelp size={18} />
      <span>{message}</span>
      {onDismiss && (
        <button className="icon-button" onClick={onDismiss} aria-label="Dismiss error">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
