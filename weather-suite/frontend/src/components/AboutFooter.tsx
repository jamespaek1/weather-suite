import { AUTHOR_NAME, PM_ACCELERATOR } from "../config";

export default function AboutFooter() {
  return (
    <footer className="about card">
      <div className="about__col">
        <h2 className="about__title">About this app</h2>
        <p className="about__text">
          Built by <strong>{AUTHOR_NAME}</strong> as a weather app for the {PM_ACCELERATOR.name}{" "}
          technical assessment. Search any place — or use your location — for current conditions,
          the next 24 hours, and a 5-day forecast.
        </p>
        <p className="about__meta">
          Weather data:{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{" "}
          (free, no API key). The background reflects the live conditions of the place you're viewing.
        </p>
      </div>

      <div className="about__col">
        <h2 className="about__title">{PM_ACCELERATOR.name}</h2>
        <p className="about__text">{PM_ACCELERATOR.blurb}</p>
        <p className="about__meta">
          <a href={PM_ACCELERATOR.url} target="_blank" rel="noreferrer">
            pmaccelerator.io
          </a>{" "}
          ·{" "}
          <a href={PM_ACCELERATOR.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </p>
      </div>
    </footer>
  );
}
