export default function Loading() {
  return (
    <div className="route-loading-screen" role="status" aria-label="Loading InMotion">
      <div className="route-loading-brand">
        <div className="route-loading-logo">IM</div>
        <div>
          <strong>InMotion</strong>
          <span>Loading workspace</span>
        </div>
      </div>

      <div className="route-loading-pulse">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
