export default function Loading() {
  return (
    <div className="route-loading-screen" role="status" aria-label="Loading InMotion">
      <div className="route-loading-brand">
        <img className="route-loading-brand-logo" src="/inmotion-logo-floating.webp" alt="InMotion" />
        <span>Loading workspace</span>
      </div>

      <div className="route-loading-pulse">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
