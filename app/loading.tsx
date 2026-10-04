export default function Loading() {
  const letters = "InMotion".split("");

  return (
    <div className="route-loading-screen" role="status" aria-label="Loading InMotion">
      <div className="inmotion-loader-wrapper" aria-hidden="true">
        <div className="inmotion-loader-ring" />
        <div className="inmotion-loader-word">
          {letters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="inmotion-loader-letter"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <span className="route-loading-caption">Loading workspace</span>
    </div>
  );
}
