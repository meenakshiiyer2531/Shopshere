/** Lightweight toast notification (no dependencies). */
export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast">
      <span className="toast-check">✓</span> {message}
    </div>
  );
}
