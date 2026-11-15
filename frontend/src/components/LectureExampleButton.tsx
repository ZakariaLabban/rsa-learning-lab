export function LectureExampleButton({
  onLoad,
  label = 'Load lecture example',
}: {
  onLoad: () => void;
  label?: string;
}) {
  return (
    <button className="secondary-button" onClick={onLoad}>
      {label}
    </button>
  );
}
