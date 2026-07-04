import type { WeatherGroup } from "../lib/weatherCodes";

interface Props {
  group: WeatherGroup;
  isDay: boolean;
  size?: number;
  title?: string;
}

const STROKE = 1.6;

/** Shared SVG wrapper. */
function Svg({ size, title, children }: { size: number; title?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const Sun = (
  <>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2.5" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="21.5" y2="12" />
    <line x1="5.2" y1="5.2" x2="6.7" y2="6.7" />
    <line x1="17.3" y1="17.3" x2="18.8" y2="18.8" />
    <line x1="5.2" y1="18.8" x2="6.7" y2="17.3" />
    <line x1="17.3" y1="6.7" x2="18.8" y2="5.2" />
  </>
);

const Moon = <path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z" />;

const Cloud = (
  <path d="M7 18h9.5a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 7.5 9.2 3.9 3.9 0 0 0 7 18Z" />
);

const cloudWith = (extra: React.ReactNode) => (
  <>
    <path d="M7 16.5h9.2a3.4 3.4 0 0 0 .3-6.8A4.8 4.8 0 0 0 7.6 8 3.8 3.8 0 0 0 7 16.5Z" />
    {extra}
  </>
);

export default function WeatherIcon({ group, isDay, size = 24, title }: Props) {
  let body: React.ReactNode;

  switch (group) {
    case "clear":
      body = isDay ? Sun : Moon;
      break;
    case "partly":
      body = isDay ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="2.6" x2="8" y2="3.8" />
          <line x1="2.6" y1="8" x2="3.8" y2="8" />
          <line x1="4.4" y1="4.4" x2="5.3" y2="5.3" />
          <line x1="11.6" y1="4.4" x2="10.7" y2="5.3" />
          <path d="M9 19h7.5a3 3 0 0 0 .2-6 4.2 4.2 0 0 0-7.9-1A3.3 3.3 0 0 0 9 19Z" />
        </>
      ) : (
        <>
          <path d="M12.5 4.2a4.6 4.6 0 0 0 4.8 6.4 4.7 4.7 0 0 1-8.3-2.9 4.7 4.7 0 0 1 3.5-3.5Z" />
          <path d="M7 19.5h8a3 3 0 0 0 .2-6 4.2 4.2 0 0 0-7.9-1A3.3 3.3 0 0 0 7 19.5Z" />
        </>
      );
      break;
    case "cloudy":
      body = Cloud;
      break;
    case "fog":
      body = cloudWith(
        <>
          <line x1="5" y1="20" x2="15" y2="20" />
          <line x1="8" y1="22.2" x2="18" y2="22.2" />
        </>
      );
      break;
    case "drizzle":
      body = cloudWith(
        <>
          <line x1="9" y1="19" x2="8.4" y2="20.6" />
          <line x1="12.5" y1="19" x2="11.9" y2="20.6" />
          <line x1="16" y1="19" x2="15.4" y2="20.6" />
        </>
      );
      break;
    case "rain":
      body = cloudWith(
        <>
          <line x1="9" y1="18.6" x2="8" y2="21.4" />
          <line x1="12.5" y1="18.6" x2="11.5" y2="21.4" />
          <line x1="16" y1="18.6" x2="15" y2="21.4" />
        </>
      );
      break;
    case "snow":
      body = cloudWith(
        <>
          <line x1="9" y1="19.4" x2="9" y2="21.4" />
          <line x1="8" y1="20.4" x2="10" y2="20.4" />
          <line x1="13" y1="19.4" x2="13" y2="21.4" />
          <line x1="12" y1="20.4" x2="14" y2="20.4" />
          <line x1="17" y1="19.4" x2="17" y2="21.4" />
          <line x1="16" y1="20.4" x2="18" y2="20.4" />
        </>
      );
      break;
    case "thunder":
      body = cloudWith(<path d="M12.5 18l-2 3h2.4l-1.4 3 3.5-4h-2.2l1.4-2Z" />);
      break;
    default:
      body = Cloud;
  }

  return (
    <Svg size={size} title={title ?? group}>
      {body}
    </Svg>
  );
}
