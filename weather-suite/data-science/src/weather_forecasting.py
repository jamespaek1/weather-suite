"""
weather_forecasting.py
======================
Analysis + forecasting pipeline for the Kaggle "Global Weather Repository"
dataset (nelgiriyewithana/global-weather-repository).

Pipeline:
  1. Load + clean (parse timestamps, coerce types, dedupe, handle missing).
  2. Exploratory data analysis (distributions, correlations, leaders).
  3. Forecasting — a temperature time series built from `last_updated`,
     modeled with scikit-learn (lag/rolling features; Linear, Random Forest,
     Gradient Boosting, and an averaging ensemble), evaluated on a held-out
     tail, then projected forward with a recursive multi-step forecast.
  4. Advanced analyses: anomaly detection, air-quality correlations,
     and spatial / climate-by-latitude patterns.
  5. A Markdown report (outputs/REPORT.md) plus PNG charts.

Run on the REAL data:
    # download Global Weather Repository.csv from Kaggle, then:
    python src/weather_forecasting.py --input "GlobalWeatherRepository.csv"

Run a self-contained DEMO on synthetic data (no download needed):
    python src/weather_forecasting.py --demo

Built for the Product Manager Accelerator (PMA) technical assessment.
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
sns.set_style("whitegrid")
plt.rcParams.update({"figure.dpi": 110, "savefig.bbox": "tight", "font.size": 10})

FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_7",
    "roll_mean_3", "roll_mean_7", "roll_std_7",
    "sin_doy", "cos_doy", "dow", "trend",
]

PMA_MISSION = (
    "The Product Manager Accelerator (PMA) is a professional-development program "
    "that helps aspiring and experienced product managers break into and grow in "
    "(AI) product management. Through hands-on cohorts, students work alongside "
    "engineers, designers, and data scientists to build and launch real AI products "
    "from 0 to 1 — backed by mentorship, an active alumni network, and a strong "
    "track record of placing graduates at top tech companies and startups."
)


# --------------------------------------------------------------------------- #
# Load + clean
# --------------------------------------------------------------------------- #
def load_data(args):
    """Return (df, is_synthetic)."""
    path = args.input
    if args.demo or not path or not os.path.exists(path):
        if path and not os.path.exists(path):
            print(f"[!] Input '{path}' not found — falling back to synthetic demo data.")
        from make_sample_data import synth
        print("[i] Generating synthetic dataset (illustrative only — NOT real data).")
        return synth(days=args.demo_days), True
    print(f"[i] Loading {path}")
    return pd.read_csv(path), False


NUMERIC_COLS = [
    "latitude", "longitude", "temperature_celsius", "temperature_fahrenheit",
    "wind_kph", "wind_mph", "wind_degree", "pressure_mb", "precip_mm", "humidity",
    "cloud", "feels_like_celsius", "visibility_km", "uv_index", "gust_kph",
    "air_quality_PM2.5", "air_quality_PM10", "air_quality_Ozone",
    "air_quality_Nitrogen_dioxide", "air_quality_us-epa-index", "moon_illumination",
]


def clean_data(df: pd.DataFrame):
    """Clean + standardize. Returns (df, log[list[str]])."""
    log = []
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    n0 = len(df)

    # Parse the timestamp that drives the time series.
    if "last_updated" not in df.columns:
        raise SystemExit("Dataset is missing the required 'last_updated' column.")
    df["last_updated"] = pd.to_datetime(df["last_updated"], errors="coerce")
    df = df.dropna(subset=["last_updated"])
    df["date"] = df["last_updated"].dt.floor("D")
    log.append(f"Parsed `last_updated`; dropped {n0 - len(df)} rows with an unparseable timestamp.")

    # Coerce numerics that exist.
    present_numeric = [c for c in NUMERIC_COLS if c in df.columns]
    for c in present_numeric:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Drop exact duplicates.
    before = len(df)
    df = df.drop_duplicates()
    log.append(f"Removed {before - len(df)} exact-duplicate row(s).")

    # Must have a target temperature.
    if "temperature_celsius" not in df.columns:
        raise SystemExit("Dataset is missing 'temperature_celsius'.")
    before = len(df)
    df = df.dropna(subset=["temperature_celsius"])
    log.append(f"Dropped {before - len(df)} row(s) with no temperature reading.")

    # Report + median-fill remaining numeric gaps (used by the multivariate models).
    missing = {c: int(df[c].isna().sum()) for c in present_numeric if df[c].isna().sum() > 0}
    if missing:
        for c in missing:
            df[c] = df[c].fillna(df[c].median())
        log.append(f"Median-filled missing values in: {', '.join(missing)}.")
    else:
        log.append("No missing values remained in the numeric columns.")

    # Plausibility clip on temperature (records outside Earth's observed range are errors).
    bad = ((df["temperature_celsius"] < -90) | (df["temperature_celsius"] > 60)).sum()
    if bad:
        df = df[(df["temperature_celsius"] >= -90) & (df["temperature_celsius"] <= 60)]
        log.append(f"Removed {int(bad)} implausible temperature reading(s) (outside -90..60 °C).")

    log.append(f"Final clean dataset: {len(df):,} rows, {df.shape[1]} columns, "
               f"{df['location_name'].nunique() if 'location_name' in df else '?'} locations, "
               f"{df['date'].dt.date.nunique()} distinct days.")
    return df, log


# --------------------------------------------------------------------------- #
# EDA
# --------------------------------------------------------------------------- #
def run_eda(df: pd.DataFrame, outdir: str):
    findings = {}

    # Temperature distribution.
    plt.figure(figsize=(7, 4))
    sns.histplot(df["temperature_celsius"], bins=40, kde=True, color="#3e6ea8")
    plt.title("Distribution of temperature (°C)")
    plt.xlabel("Temperature (°C)")
    plt.savefig(os.path.join(outdir, "eda_temp_distribution.png"))
    plt.close()
    findings["temp_mean"] = float(df["temperature_celsius"].mean())
    findings["temp_std"] = float(df["temperature_celsius"].std())

    # Correlation heatmap across weather variables.
    corr_cols = [c for c in ["temperature_celsius", "humidity", "wind_kph", "pressure_mb",
                             "precip_mm", "cloud", "uv_index", "visibility_km",
                             "air_quality_PM2.5"] if c in df.columns]
    if len(corr_cols) >= 3:
        plt.figure(figsize=(8, 6))
        sns.heatmap(df[corr_cols].corr(), annot=True, fmt=".2f", cmap="RdBu_r",
                    center=0, square=True, cbar_kws={"shrink": 0.8})
        plt.title("Correlation between weather variables")
        plt.savefig(os.path.join(outdir, "eda_correlation.png"))
        plt.close()

    # Leaders: hottest cities + most-sampled countries.
    if "location_name" in df.columns:
        hottest = df.groupby("location_name")["temperature_celsius"].mean().sort_values(ascending=False).head(15)
        plt.figure(figsize=(7, 5))
        sns.barplot(x=hottest.values, y=hottest.index, color="#e0894f")
        plt.title("Warmest locations (mean °C)")
        plt.xlabel("Mean temperature (°C)")
        plt.savefig(os.path.join(outdir, "eda_hottest_locations.png"))
        plt.close()
        findings["hottest"] = [(k, round(v, 1)) for k, v in hottest.head(5).items()]

    return findings


def precipitation_eda(df: pd.DataFrame, outdir: str):
    """Precipitation-focused visualizations. The brief asks explicitly for
    temperature AND precipitation charts. Returns a small findings dict."""
    findings = {}
    if "precip_mm" not in df.columns:
        return findings

    # Wettest locations by mean daily precipitation.
    if "location_name" in df.columns:
        wettest = df.groupby("location_name")["precip_mm"].mean().sort_values(ascending=False).head(12)
        plt.figure(figsize=(7, 5))
        sns.barplot(x=wettest.values, y=wettest.index, color="#4f89a8")
        plt.title("Wettest locations (mean daily precipitation)")
        plt.xlabel("Precipitation (mm)")
        plt.savefig(os.path.join(outdir, "eda_precip_by_location.png"))
        plt.close()
        findings["wettest"] = [(k, round(v, 2)) for k, v in wettest.head(5).items()]

    # Precipitation trend over time (daily mean across all stations).
    daily_precip = df.groupby("date")["precip_mm"].mean().sort_index()
    plt.figure(figsize=(11, 4))
    plt.fill_between(daily_precip.index, daily_precip.values, color="#4f89a8", alpha=0.3)
    plt.plot(daily_precip.index, daily_precip.values, color="#2f6f8f", lw=1.3)
    plt.title("Mean daily precipitation over time (all locations)")
    plt.ylabel("Precipitation (mm)")
    plt.savefig(os.path.join(outdir, "eda_precip_over_time.png"))
    plt.close()
    findings["mean_precip"] = float(df["precip_mm"].mean())
    return findings


# --------------------------------------------------------------------------- #
# Forecasting
# --------------------------------------------------------------------------- #
def build_daily_series(df: pd.DataFrame, location: str | None):
    """Daily mean-temperature series. Defaults to the most data-rich location
    (a single station gives a clean, autocorrelated, seasonal signal); pass a
    location name to override, or 'global' for the all-stations mean."""
    has_names = "location_name" in df.columns
    if location and location.lower() == "global":
        sub, scope = df, "global mean"
    elif location and has_names:
        sub = df[df["location_name"].str.lower() == location.lower()]
        if sub.empty:
            print(f"[!] Location '{location}' not found; using the busiest location instead.")
            busiest = df["location_name"].value_counts().idxmax()
            sub, scope = df[df["location_name"] == busiest], busiest
        else:
            scope = location
    elif has_names:
        busiest = df["location_name"].value_counts().idxmax()
        sub, scope = df[df["location_name"] == busiest], busiest
    else:
        sub, scope = df, "global mean"
    print(f"   - forecast scope: {scope}")

    s = sub.groupby("date")["temperature_celsius"].mean().sort_index()
    full = pd.date_range(s.index.min(), s.index.max(), freq="D")
    gaps = len(full) - len(s)
    s = s.reindex(full).interpolate(method="linear").ffill().bfill()
    return s, scope, gaps


def build_features(series: pd.Series) -> pd.DataFrame:
    df = pd.DataFrame({"y": series})
    df["lag_1"] = series.shift(1)
    df["lag_2"] = series.shift(2)
    df["lag_3"] = series.shift(3)
    df["lag_7"] = series.shift(7)
    prior = series.shift(1)
    df["roll_mean_3"] = prior.rolling(3).mean()
    df["roll_mean_7"] = prior.rolling(7).mean()
    df["roll_std_7"] = prior.rolling(7).std()
    doy = series.index.dayofyear.to_numpy()
    df["sin_doy"] = np.sin(2 * np.pi * doy / 365.25)
    df["cos_doy"] = np.cos(2 * np.pi * doy / 365.25)
    df["dow"] = series.index.dayofweek
    df["trend"] = np.arange(len(series))
    return df.dropna()


def _make_models():
    return {
        "Linear": LinearRegression(),
        "RandomForest": RandomForestRegressor(n_estimators=300, random_state=0, n_jobs=-1),
        "GradientBoosting": GradientBoostingRegressor(random_state=0),
    }


def rmse(y, yhat):
    return float(np.sqrt(mean_squared_error(y, yhat)))


def train_eval(series: pd.Series, outdir: str):
    feat = build_features(series)
    X, y = feat[FEATURES], feat["y"]
    n = len(feat)
    split = int(n * 0.8)
    Xtr, Xte, ytr, yte = X.iloc[:split], X.iloc[split:], y.iloc[:split], y.iloc[split:]

    models = _make_models()
    preds, metrics = {}, {}
    for name, m in models.items():
        m.fit(Xtr, ytr)
        p = m.predict(Xte)
        preds[name] = p
        metrics[name] = {"MAE": mean_absolute_error(yte, p), "RMSE": rmse(yte, p), "R2": r2_score(yte, p)}

    # Averaging ensemble.
    ens = np.mean([preds[k] for k in models], axis=0)
    preds["Ensemble"] = ens
    metrics["Ensemble"] = {"MAE": mean_absolute_error(yte, ens), "RMSE": rmse(yte, ens), "R2": r2_score(yte, ens)}

    best = min(metrics, key=lambda k: metrics[k]["RMSE"])

    # Feature importance from the Random Forest.
    rf = models["RandomForest"]
    importance = sorted(zip(FEATURES, rf.feature_importances_), key=lambda t: t[1], reverse=True)
    plt.figure(figsize=(7, 4))
    names, vals = zip(*importance)
    sns.barplot(x=list(vals), y=list(names), color="#5a8f6f")
    plt.title("Feature importance (Random Forest)")
    plt.xlabel("Importance")
    plt.savefig(os.path.join(outdir, "forecast_feature_importance.png"))
    plt.close()

    test_frame = pd.DataFrame({"date": feat.index[split:], "y_true": yte.values, "y_pred_ensemble": ens})
    return metrics, best, test_frame, importance


def recursive_forecast(series: pd.Series, horizon: int):
    """Refit on ALL data, then roll the forecast forward one day at a time."""
    feat = build_features(series)
    X, y = feat[FEATURES], feat["y"]
    models = _make_models()
    for m in models.values():
        m.fit(X, y)

    hist = series.copy()
    future_dates = pd.date_range(series.index.max() + pd.Timedelta(days=1), periods=horizon, freq="D")
    out = []
    trend_idx = len(series)
    for d in future_dates:
        vals = hist.values
        row = {
            "lag_1": vals[-1], "lag_2": vals[-2], "lag_3": vals[-3], "lag_7": vals[-7],
            "roll_mean_3": vals[-3:].mean(), "roll_mean_7": vals[-7:].mean(),
            "roll_std_7": vals[-7:].std(ddof=1),
            "sin_doy": np.sin(2 * np.pi * d.dayofyear / 365.25),
            "cos_doy": np.cos(2 * np.pi * d.dayofyear / 365.25),
            "dow": d.dayofweek, "trend": trend_idx,
        }
        xrow = pd.DataFrame([row])[FEATURES]
        yhat = float(np.mean([m.predict(xrow)[0] for m in models.values()]))
        out.append({"date": d, "y_forecast": yhat})
        hist.loc[d] = yhat
        trend_idx += 1
    return pd.DataFrame(out)


def plot_forecast(series, test_frame, forecast_df, scope, outdir):
    plt.figure(figsize=(11, 5))
    plt.plot(series.index, series.values, color="#8aa0b8", lw=1.3, label="Actual (history)")
    plt.plot(test_frame["date"], test_frame["y_pred_ensemble"], color="#e0894f", lw=1.8,
             label="Backtest (ensemble)")
    plt.plot(forecast_df["date"], forecast_df["y_forecast"], color="#3e6ea8", lw=2.2,
             marker="o", ms=3, label="Forecast")
    plt.axvline(series.index.max(), color="#bbb", ls="--", lw=1)
    plt.title(f"Temperature forecast — {scope}")
    plt.ylabel("Temperature (°C)")
    plt.legend()
    plt.savefig(os.path.join(outdir, "forecast_temperature.png"))
    plt.close()


# --------------------------------------------------------------------------- #
# Advanced analyses
# --------------------------------------------------------------------------- #
def anomaly_detection(df: pd.DataFrame, series: pd.Series, outdir: str):
    findings = {}

    # (a) Statistical anomalies on the daily series (z-score).
    z = (series - series.mean()) / series.std()
    anomalies = series[abs(z) > 2.5]
    findings["zscore_count"] = int(len(anomalies))

    plt.figure(figsize=(11, 4.5))
    plt.plot(series.index, series.values, color="#6e8295", lw=1.3, label="Daily mean °C")
    if len(anomalies):
        plt.scatter(anomalies.index, anomalies.values, color="#d2453f", zorder=5, s=40, label="Anomaly (|z|>2.5)")
    plt.title("Daily-mean temperature with statistical anomalies")
    plt.ylabel("Temperature (°C)")
    plt.legend()
    plt.savefig(os.path.join(outdir, "anomaly_timeseries.png"))
    plt.close()

    # (b) Multivariate anomalies on city-level rows (Isolation Forest).
    feat_cols = [c for c in ["temperature_celsius", "humidity", "wind_kph", "pressure_mb", "precip_mm"]
                 if c in df.columns]
    if len(feat_cols) >= 3:
        Xa = StandardScaler().fit_transform(df[feat_cols].to_numpy())
        iso = IsolationForest(contamination=0.01, random_state=0)
        labels = iso.fit_predict(Xa)
        n_out = int((labels == -1).sum())
        findings["iso_count"] = n_out
        findings["iso_features"] = feat_cols
        if "location_name" in df.columns:
            examples = df.loc[labels == -1, ["location_name", "date", "temperature_celsius"]].head(5)
            findings["iso_examples"] = [
                (r.location_name, str(pd.Timestamp(r.date).date()), round(r.temperature_celsius, 1))
                for r in examples.itertuples()
            ]
    return findings


def air_quality_analysis(df: pd.DataFrame, outdir: str):
    if "air_quality_PM2.5" not in df.columns:
        return None
    findings = {}
    pairs = [("temperature_celsius", "temp"), ("humidity", "humidity"), ("wind_kph", "wind")]
    corrs = {}
    for col, key in pairs:
        if col in df.columns:
            corrs[key] = round(float(df["air_quality_PM2.5"].corr(df[col])), 3)
    findings["correlations"] = corrs

    # PM2.5 vs temperature scatter.
    plt.figure(figsize=(7, 4.5))
    sns.scatterplot(data=df.sample(min(len(df), 3000), random_state=0),
                    x="temperature_celsius", y="air_quality_PM2.5", alpha=0.3, color="#7a5ea8", s=14)
    plt.title("PM2.5 vs temperature")
    plt.savefig(os.path.join(outdir, "airquality_pm25_vs_temp.png"))
    plt.close()

    # Most-polluted locations.
    if "location_name" in df.columns:
        worst = df.groupby("location_name")["air_quality_PM2.5"].mean().sort_values(ascending=False).head(12)
        plt.figure(figsize=(7, 5))
        sns.barplot(x=worst.values, y=worst.index, color="#9c6b6b")
        plt.title("Highest mean PM2.5 by location")
        plt.xlabel("PM2.5 (µg/m³)")
        plt.savefig(os.path.join(outdir, "airquality_worst_locations.png"))
        plt.close()
        findings["worst"] = [(k, round(v, 1)) for k, v in worst.head(5).items()]
    return findings


def spatial_climate(df: pd.DataFrame, outdir: str):
    findings = {}
    if "latitude" not in df.columns:
        return findings

    # Latitude vs temperature with a fitted line.
    sample = df.sample(min(len(df), 4000), random_state=0)
    plt.figure(figsize=(7, 4.5))
    sns.scatterplot(data=sample, x="latitude", y="temperature_celsius", alpha=0.25, s=14, color="#3e6ea8")
    coef = np.polyfit(df["latitude"], df["temperature_celsius"], 1)
    xs = np.linspace(df["latitude"].min(), df["latitude"].max(), 50)
    plt.plot(xs, np.polyval(coef, xs), color="#d2453f", lw=2)
    plt.title("Temperature vs latitude")
    plt.savefig(os.path.join(outdir, "spatial_temp_vs_latitude.png"))
    plt.close()
    findings["abs_lat_corr"] = round(float(df["temperature_celsius"].corr(df["latitude"].abs())), 3)

    # Mean temperature by absolute-latitude band.
    bands = pd.cut(df["latitude"].abs(), bins=[0, 15, 30, 45, 60, 90],
                   labels=["0-15° (tropics)", "15-30°", "30-45°", "45-60°", "60-90° (polar)"])
    by_band = df.groupby(bands)["temperature_celsius"].mean()
    plt.figure(figsize=(7, 4))
    sns.barplot(x=by_band.index.astype(str), y=by_band.values, color="#5a8f6f")
    plt.title("Mean temperature by latitude band")
    plt.ylabel("Mean temperature (°C)")
    plt.xticks(rotation=20)
    plt.savefig(os.path.join(outdir, "spatial_temp_by_band.png"))
    plt.close()

    # Station map colored by temperature.
    if "longitude" in df.columns:
        latest = df.sort_values("last_updated").groupby("location_name").tail(1) if "location_name" in df.columns else df
        plt.figure(figsize=(10, 5))
        sc = plt.scatter(latest["longitude"], latest["latitude"], c=latest["temperature_celsius"],
                         cmap="RdYlBu_r", s=30, edgecolor="white", linewidth=0.3)
        plt.colorbar(sc, label="Temperature (°C)", shrink=0.8)
        plt.title("Locations by temperature")
        plt.xlabel("Longitude")
        plt.ylabel("Latitude")
        plt.savefig(os.path.join(outdir, "spatial_station_map.png"))
        plt.close()
    return findings


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #
def write_report(outdir, is_synth, clean_log, eda, precip, scope, gaps, metrics, best,
                 horizon, forecast_df, anomalies, air, spatial):
    md = []
    md.append("# Global Weather Repository — Analysis & Forecast\n")
    md.append("> **Product Manager Accelerator (PMA)**\n>\n> " + PMA_MISSION + "\n")
    if is_synth:
        md.append(
            "> ⚠️ **This report was generated from SYNTHETIC demo data**, because the "
            "real dataset was not present at runtime. The structure, methodology, and "
            "charts are exactly what you get on the real data — but the numbers below "
            "are illustrative only. Re-run with `--input \"GlobalWeatherRepository.csv\"` "
            "for real results.\n"
        )

    md.append("## 1. Data cleaning\n")
    for line in clean_log:
        md.append(f"- {line}")
    md.append("")

    md.append("## 2. Exploratory data analysis\n")
    md.append(f"- Mean temperature across all records: **{eda['temp_mean']:.1f} °C** "
              f"(σ = {eda['temp_std']:.1f}).")
    if eda.get("hottest"):
        tops = ", ".join(f"{c} ({t}°C)" for c, t in eda["hottest"])
        md.append(f"- Warmest locations by mean temperature: {tops}.")
    md.append("\n![Temperature distribution](eda_temp_distribution.png)\n")
    md.append("![Correlation heatmap](eda_correlation.png)\n")
    md.append("![Warmest locations](eda_hottest_locations.png)\n")
    if precip.get("mean_precip") is not None:
        md.append(f"- Mean daily precipitation across all records: **{precip['mean_precip']:.2f} mm**.")
        if precip.get("wettest"):
            wet = ", ".join(f"{c} ({v} mm)" for c, v in precip["wettest"])
            md.append(f"- Wettest locations by mean precipitation: {wet}.")
            md.append("\n![Precipitation by location](eda_precip_by_location.png)\n")
        md.append("![Precipitation over time](eda_precip_over_time.png)\n")

    md.append("## 3. Temperature forecast\n")
    md.append(f"A daily mean-temperature series (**scope: {scope}**) was built from "
              f"`last_updated`. {gaps} day(s) of gaps were linearly interpolated. Models use "
              "lagged values (1/2/3/7-day), rolling mean/std, and seasonal (day-of-year) "
              "features. Evaluation is on the held-out final 20% of the series.\n")
    md.append("| Model | MAE | RMSE | R² |")
    md.append("| --- | ---: | ---: | ---: |")
    for name, m in metrics.items():
        star = " ⭐" if name == best else ""
        md.append(f"| {name}{star} | {m['MAE']:.2f} | {m['RMSE']:.2f} | {m['R2']:.3f} |")
    md.append(f"\nBest model by RMSE: **{best}**. "
              f"The {horizon}-day forecast ranges "
              f"{forecast_df['y_forecast'].min():.1f}–{forecast_df['y_forecast'].max():.1f} °C "
              f"(mean {forecast_df['y_forecast'].mean():.1f} °C).\n")
    md.append("![Forecast](forecast_temperature.png)\n")
    md.append("![Feature importance](forecast_feature_importance.png)\n")

    md.append("## 4. Anomaly detection\n")
    md.append(f"- **{anomalies.get('zscore_count', 0)}** day(s) flagged as statistical "
              "outliers on the daily series (|z| > 2.5).")
    if "iso_count" in anomalies:
        md.append(f"- **{anomalies['iso_count']}** city-level records flagged by an "
                  f"Isolation Forest over {', '.join(anomalies['iso_features'])} (1% contamination).")
        for name, date, temp in anomalies.get("iso_examples", []):
            md.append(f"    - {name} on {date}: {temp} °C")
    md.append("\n![Anomalies](anomaly_timeseries.png)\n")

    if air:
        md.append("## 5. Air quality\n")
        c = air.get("correlations", {})
        md.append("- PM2.5 correlation with: " +
                  ", ".join(f"{k} = {v}" for k, v in c.items()) + ".")
        if air.get("worst"):
            tops = ", ".join(f"{city} ({v} µg/m³)" for city, v in air["worst"])
            md.append(f"- Highest mean PM2.5: {tops}.")
        md.append("\n![PM2.5 vs temperature](airquality_pm25_vs_temp.png)\n")
        md.append("![Worst PM2.5 locations](airquality_worst_locations.png)\n")

    if spatial:
        md.append("## 6. Spatial & climate patterns\n")
        if "abs_lat_corr" in spatial:
            md.append(f"- Temperature vs **absolute latitude** correlation: "
                      f"**{spatial['abs_lat_corr']}** (negative = cooler toward the poles, as expected).")
        md.append("\n![Temperature vs latitude](spatial_temp_vs_latitude.png)\n")
        md.append("![Temperature by band](spatial_temp_by_band.png)\n")
        md.append("![Station map](spatial_station_map.png)\n")

    md.append("## 7. How this maps to the assessment\n")
    md.append("- **Data cleaning & preprocessing** — section 1.\n"
              "- **Forecasting using `last_updated`** — section 3 (time-series features + "
              "backtest + multi-step forecast).\n"
              "- **Advanced analyses** — anomaly detection (4), air-quality correlation (5), "
              "ensemble modeling (3), and spatial/climate patterns (6).\n")

    with open(os.path.join(outdir, "REPORT.md"), "w") as f:
        f.write("\n".join(md) + "\n")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Global Weather Repository analysis + forecast.")
    ap.add_argument("--input", default="GlobalWeatherRepository.csv", help="Path to the dataset CSV.")
    ap.add_argument("--outdir", default="outputs", help="Where to write charts + REPORT.md.")
    ap.add_argument("--location", default=None, help="Forecast one location (default: global mean).")
    ap.add_argument("--horizon", type=int, default=14, help="Forecast horizon in days.")
    ap.add_argument("--demo", action="store_true", help="Use synthetic demo data (no download needed).")
    ap.add_argument("--demo-days", type=int, default=150, help="Days of synthetic history in demo mode.")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    df, is_synth = load_data(args)
    df, clean_log = clean_data(df)
    for line in clean_log:
        print("   -", line)

    if df["date"].dt.date.nunique() < 20:
        print("[!] Fewer than 20 distinct days — forecasting will be unreliable, but proceeding.")

    print("[i] Running EDA…")
    eda = run_eda(df, args.outdir)
    precip = precipitation_eda(df, args.outdir)

    print("[i] Building daily series + training models…")
    series, scope, gaps = build_daily_series(df, args.location)
    metrics, best, test_frame, importance = train_eval(series, args.outdir)
    forecast_df = recursive_forecast(series, args.horizon)
    plot_forecast(series, test_frame, forecast_df, scope, args.outdir)
    print(f"   - best model: {best} | RMSE={metrics[best]['RMSE']:.2f} °C, R²={metrics[best]['R2']:.3f}")

    print("[i] Anomaly detection…")
    anomalies = anomaly_detection(df, series, args.outdir)
    print("[i] Air-quality analysis…")
    air = air_quality_analysis(df, args.outdir)
    print("[i] Spatial / climate analysis…")
    spatial = spatial_climate(df, args.outdir)

    print("[i] Writing report…")
    write_report(args.outdir, is_synth, clean_log, eda, precip, scope, gaps, metrics, best,
                 args.horizon, forecast_df, anomalies, air, spatial)

    print(f"\nDone. See {os.path.join(args.outdir, 'REPORT.md')} and the PNG charts in {args.outdir}/.")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
