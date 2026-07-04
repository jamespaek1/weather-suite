"""
make_sample_data.py
-------------------
Generate a SYNTHETIC dataset that matches the column schema of the Kaggle
"Global Weather Repository" (nelgiriyewithana/global-weather-repository).

This exists only so the analysis pipeline can be run and verified WITHOUT the
real download. The numbers are plausible but invented — do not treat any output
produced from this file as real climate information.

Usage:
    python src/make_sample_data.py --out data/sample_weather.csv
"""
from __future__ import annotations

import argparse
import numpy as np
import pandas as pd


CITIES = [
    # (city, country, lat, lon, tz)
    ("Reykjavik", "Iceland", 64.15, -21.94, "Atlantic/Reykjavik"),
    ("Oslo", "Norway", 59.91, 10.75, "Europe/Oslo"),
    ("London", "United Kingdom", 51.51, -0.13, "Europe/London"),
    ("Berlin", "Germany", 52.52, 13.41, "Europe/Berlin"),
    ("Madrid", "Spain", 40.42, -3.70, "Europe/Madrid"),
    ("Rome", "Italy", 41.89, 12.48, "Europe/Rome"),
    ("Cairo", "Egypt", 30.04, 31.24, "Africa/Cairo"),
    ("Lagos", "Nigeria", 6.52, 3.38, "Africa/Lagos"),
    ("Nairobi", "Kenya", -1.29, 36.82, "Africa/Nairobi"),
    ("Cape Town", "South Africa", -33.92, 18.42, "Africa/Johannesburg"),
    ("Dubai", "United Arab Emirates", 25.20, 55.27, "Asia/Dubai"),
    ("Mumbai", "India", 19.08, 72.88, "Asia/Kolkata"),
    ("Delhi", "India", 28.61, 77.21, "Asia/Kolkata"),
    ("Bangkok", "Thailand", 13.76, 100.50, "Asia/Bangkok"),
    ("Singapore", "Singapore", 1.35, 103.82, "Asia/Singapore"),
    ("Beijing", "China", 39.90, 116.41, "Asia/Shanghai"),
    ("Tokyo", "Japan", 35.68, 139.69, "Asia/Tokyo"),
    ("Seoul", "South Korea", 37.57, 126.98, "Asia/Seoul"),
    ("Sydney", "Australia", -33.87, 151.21, "Australia/Sydney"),
    ("Auckland", "New Zealand", -36.85, 174.76, "Pacific/Auckland"),
    ("Moscow", "Russia", 55.76, 37.62, "Europe/Moscow"),
    ("Istanbul", "Turkey", 41.01, 28.98, "Europe/Istanbul"),
    ("New York", "United States", 40.71, -74.01, "America/New_York"),
    ("Chicago", "United States", 41.88, -87.63, "America/Chicago"),
    ("Los Angeles", "United States", 34.05, -118.24, "America/Los_Angeles"),
    ("Mexico City", "Mexico", 19.43, -99.13, "America/Mexico_City"),
    ("Bogota", "Colombia", 4.71, -74.07, "America/Bogota"),
    ("Lima", "Peru", -12.05, -77.04, "America/Lima"),
    ("Sao Paulo", "Brazil", -23.55, -46.63, "America/Sao_Paulo"),
    ("Buenos Aires", "Argentina", -34.60, -58.38, "America/Argentina/Buenos_Aires"),
]

CONDITIONS = [
    (0, "Sunny"), (2, "Partly cloudy"), (3, "Overcast"),
    (45, "Fog"), (61, "Light rain"), (63, "Moderate rain"),
    (80, "Rain showers"), (95, "Thunderstorm"), (71, "Light snow"),
]


def synth(days: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    end = pd.Timestamp.utcnow().normalize()
    dates = pd.date_range(end - pd.Timedelta(days=days - 1), end, freq="D")
    doy = dates.dayofyear.to_numpy()

    rows = []
    for (city, country, lat, lon, tz) in CITIES:
        # Seasonal swing is stronger away from the equator; phase flips by hemisphere.
        seasonal_amp = 2 + 0.30 * abs(lat)
        phase = 0 if lat >= 0 else 182.5
        base = 30 - 0.45 * abs(lat)  # warmer near the equator
        season = seasonal_amp * np.cos(2 * np.pi * (doy - 196 + phase) / 365.25)
        # AR(1) residual: weather is persistent day-to-day, so lag features matter.
        innov = rng.normal(0, 1.6, size=len(dates))
        resid = np.zeros(len(dates))
        resid[0] = innov[0]
        phi = 0.75
        for i in range(1, len(dates)):
            resid[i] = phi * resid[i - 1] + innov[i]
        temp_c = base + season + resid

        # Inject a few anomalies (heatwave / cold snap).
        n_anom = rng.integers(0, 3)
        for _ in range(n_anom):
            idx = rng.integers(0, len(dates))
            temp_c[idx] += rng.choice([-1, 1]) * rng.uniform(8, 14)

        humidity = np.clip(rng.normal(70, 12, len(dates)) - 0.4 * (temp_c - base), 15, 100)
        wind_kph = np.clip(rng.gamma(2.0, 6.0, len(dates)), 0, 90)
        gust_kph = wind_kph * rng.uniform(1.2, 1.8, len(dates))
        pressure_mb = rng.normal(1013, 7, len(dates))
        precip_mm = np.where(rng.random(len(dates)) < 0.3, rng.gamma(1.5, 3.0, len(dates)), 0.0)
        cloud = np.clip(rng.normal(50, 28, len(dates)), 0, 100)
        uv = np.clip((temp_c - 5) / 4 + rng.normal(0, 1, len(dates)), 0, 12)
        vis_km = np.clip(rng.normal(12, 3, len(dates)) - precip_mm * 0.2, 0.5, 20)

        # Air quality loosely tied to a per-city pollution level.
        pollution = rng.uniform(0.4, 2.2)
        pm25 = np.clip(rng.gamma(2.0, 6.0, len(dates)) * pollution, 1, 250)
        pm10 = pm25 * rng.uniform(1.3, 1.9)
        epa = np.clip((pm25 / 12).round() + 1, 1, 6).astype(int)

        cond_idx = rng.integers(0, len(CONDITIONS), len(dates))

        for i, d in enumerate(dates):
            code, text = CONDITIONS[cond_idx[i]]
            t_c = round(float(temp_c[i]), 1)
            fl = round(t_c - (wind_kph[i] / 30.0) + (humidity[i] - 60) / 40.0, 1)
            rows.append(
                {
                    "country": country,
                    "location_name": city,
                    "latitude": lat,
                    "longitude": lon,
                    "timezone": tz,
                    "last_updated_epoch": int(d.timestamp()),
                    "last_updated": d.strftime("%Y-%m-%d %H:%M"),
                    "temperature_celsius": t_c,
                    "temperature_fahrenheit": round(t_c * 9 / 5 + 32, 1),
                    "condition_text": text,
                    "wind_kph": round(float(wind_kph[i]), 1),
                    "wind_mph": round(float(wind_kph[i]) / 1.609, 1),
                    "wind_degree": int(rng.integers(0, 360)),
                    "wind_direction": rng.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
                    "pressure_mb": round(float(pressure_mb[i]), 1),
                    "pressure_in": round(float(pressure_mb[i]) / 33.864, 2),
                    "precip_mm": round(float(precip_mm[i]), 2),
                    "precip_in": round(float(precip_mm[i]) / 25.4, 3),
                    "humidity": int(humidity[i]),
                    "cloud": int(cloud[i]),
                    "feels_like_celsius": fl,
                    "feels_like_fahrenheit": round(fl * 9 / 5 + 32, 1),
                    "visibility_km": round(float(vis_km[i]), 1),
                    "visibility_miles": round(float(vis_km[i]) / 1.609, 1),
                    "uv_index": round(float(uv[i]), 1),
                    "gust_kph": round(float(gust_kph[i]), 1),
                    "gust_mph": round(float(gust_kph[i]) / 1.609, 1),
                    "air_quality_Carbon_Monoxide": round(float(rng.uniform(100, 600)), 1),
                    "air_quality_Ozone": round(float(rng.uniform(20, 120)), 1),
                    "air_quality_Nitrogen_dioxide": round(float(rng.uniform(1, 50)), 1),
                    "air_quality_Sulphur_dioxide": round(float(rng.uniform(0.5, 30)), 1),
                    "air_quality_PM2.5": round(float(pm25[i]), 1),
                    "air_quality_PM10": round(float(pm10[i]), 1),
                    "air_quality_us-epa-index": int(epa[i]),
                    "air_quality_gb-defra-index": int(np.clip(epa[i] + rng.integers(-1, 2), 1, 10)),
                    "sunrise": "06:12 AM",
                    "sunset": "08:43 PM",
                    "moon_phase": rng.choice(["New Moon", "Waxing Crescent", "First Quarter", "Full Moon"]),
                    "moon_illumination": int(rng.integers(0, 100)),
                }
            )

    df = pd.DataFrame(rows)
    # Sprinkle a few missing values + a duplicate to exercise the cleaning step.
    miss = rng.choice(df.index, size=max(1, len(df) // 200), replace=False)
    df.loc[miss, "humidity"] = np.nan
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/sample_weather.csv")
    ap.add_argument("--days", type=int, default=150)
    args = ap.parse_args()

    import os
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    df = synth(args.days)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df):,} synthetic rows x {df.shape[1]} cols -> {args.out}")


if __name__ == "__main__":
    main()
