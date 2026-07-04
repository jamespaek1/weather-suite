interface Props {
  isNight: boolean;
}

/**
 * The fixed, full-viewport sky. The gradient comes from CSS vars
 * (--sky-top / --sky-bottom) set on the app root by the active theme.
 * Here we add two soft glow layers — a warm "sun" glow by day, a cool
 * moon glow by night — that drift slowly to give the page a living feel.
 */
export default function BackgroundSky({ isNight }: Props) {
  return (
    <div className="sky" aria-hidden="true" data-night={isNight}>
      <div className="sky__gradient" />
      <div className="sky__glow sky__glow--primary" />
      <div className="sky__glow sky__glow--secondary" />
      <div className="sky__grain" />
    </div>
  );
}
