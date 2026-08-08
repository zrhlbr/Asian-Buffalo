/**
 * Xi route loading boundary — light shell first paint, never a solid black full-screen trap.
 */
export default function XiLoading() {
  return (
    <div
      className="xi-route-loading"
      data-testid="xi-route-loading"
      aria-busy="true"
      aria-label="XI GAME"
    >
      <div className="xi-route-loading-shell">
        <div className="xi-route-loading-bar" />
      </div>
    </div>
  );
}
