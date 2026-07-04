import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { parseCoordinates, parsePostalCode, searchPlaces } from "../lib/openMeteo";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  onSelectPlace: (p: Place) => void;
  onLocate: () => void;
  locating: boolean;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onSelectPlace,
  onLocate,
  locating,
}: Props) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch. Skip when the input looks like coordinates.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let coords = null;
    try {
      coords = parseCoordinates(q);
    } catch {
      coords = null;
    }
    if (coords) {
      setSuggestions([]);
      return;
    }
    if (parsePostalCode(q)) {
      // ZIP/postal codes resolve on submit, not via the name autocomplete.
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const results = await searchPlaces(q);
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [value]);

  // Close suggestions on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(p: Place) {
    onChange(`${p.name}${p.region ? ", " + p.region : ""}`);
    setOpen(false);
    setSuggestions([]);
    onSelectPlace(p);
  }

  function submit() {
    const q = value.trim();
    if (!q) return;
    setOpen(false);
    onSubmit(q);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") submit();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) choose(suggestions[activeIndex]);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search" ref={boxRef}>
      <div className="search__row">
        <div className="search__field">
          <SearchIcon />
          <input
            type="text"
            className="search__input"
            placeholder="City, ZIP, landmark, or 33.75, -84.39"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search for a place"
            aria-expanded={open}
            role="combobox"
            aria-controls="search-suggestions"
          />
          <button type="button" className="search__go" onClick={submit} aria-label="Search">
            Search
          </button>
        </div>
        <button
          type="button"
          className="search__locate"
          onClick={onLocate}
          disabled={locating}
          aria-label="Use my current location"
          title="Use my current location"
        >
          <PinIcon />
          <span>{locating ? "Locating…" : "My location"}</span>
        </button>
      </div>

      {open && suggestions.length > 0 ? (
        <ul className="search__suggestions" id="search-suggestions" role="listbox">
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === activeIndex}
              className={"search__suggestion" + (i === activeIndex ? " is-active" : "")}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
            >
              <span className="search__suggestion-name">{p.name}</span>
              <span className="search__suggestion-region">{p.region}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}
