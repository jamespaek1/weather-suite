import type { AppError } from "../types";

export function Loader() {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader__spinner" />
      <p>Reading the sky…</p>
    </div>
  );
}

function errorCopy(error: AppError): { title: string; body: string } {
  switch (error.kind) {
    case "not-found":
      return {
        title: "No place by that name",
        body: `We couldn't find “${error.query}”. Try a city or town, a landmark, or coordinates like 33.75, -84.39.`,
      };
    case "network":
      return { title: "Can't reach the weather service", body: error.message };
    case "geolocation":
      return { title: "Location is off", body: error.message };
    case "bad-input":
      return { title: "Check that input", body: error.message };
    default:
      return { title: "Something went wrong", body: "Please try again." };
  }
}

export function ErrorNotice({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  const { title, body } = errorCopy(error);
  return (
    <div className="notice notice--error" role="alert">
      <h2 className="notice__title">{title}</h2>
      <p className="notice__body">{body}</p>
      {onRetry && error.kind === "network" ? (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function WelcomeNotice({ onExample }: { onExample: (q: string) => void }) {
  const examples = ["Tokyo", "Reykjavík", "10001", "33.75, -84.39"];
  return (
    <div className="notice notice--welcome">
      <h2 className="notice__title">Search any place on Earth</h2>
      <p className="notice__body">
        A city, a town, a ZIP or postal code, a landmark, or coordinates. Or use your current location.
      </p>
      <div className="chips">
        {examples.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => onExample(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
