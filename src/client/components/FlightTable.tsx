import { useState } from "react";
import type { Flight } from "../../types/flight";

interface Props {
  flights: Flight[];
  visibleSet: Set<string>;
  onToggleVisible: (icao24: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

function fmtTime(epochSec: number | undefined): string {
  if (!epochSec) return "—";
  return new Date(epochSec * 1000).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function FlightTable({
  flights,
  visibleSet,
  onToggleVisible,
  onShowAll,
  onHideAll,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...flights].sort((a, b) => a.callsign.trim().localeCompare(b.callsign.trim()));
  const visibleCount = flights.filter((f) => visibleSet.has(f.icao24)).length;

  return (
    <div className={`flight-table ${expanded ? "" : "ft-collapsed"}`}>
      <div className="ft-header">
        <div className="ft-title">
          <span className="ft-title-main">FLEET</span>
          <span className="ft-title-count">
            {visibleCount} / {flights.length}
          </span>
        </div>
        {expanded && (
          <div className="ft-actions">
            <button onClick={onShowAll}>Select all</button>
            <button onClick={onHideAll}>Clear all</button>
          </div>
        )}
        <button
          className="ft-collapse"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>
      {expanded && (
        <div className="ft-body">
          <table>
            <thead>
              <tr>
                <th className="ft-col-check"></th>
                <th>Callsign</th>
                <th>From</th>
                <th>To</th>
                <th>Dep</th>
                <th>Arr</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
                const visible = visibleSet.has(f.icao24);
                return (
                  <tr
                    key={f.icao24}
                    className={visible ? "" : "ft-row-hidden"}
                    onClick={() => onToggleVisible(f.icao24)}
                  >
                    <td className="ft-col-check">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleVisible(f.icao24);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="ft-callsign">{f.callsign.trim() || f.icao24}</td>
                    <td>
                      {f.origin ? (
                        <>
                          <div className="ft-airport-icao">{f.origin.icao}</div>
                          <div className="ft-airport-name">{f.origin.name}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {f.destination ? (
                        <>
                          <div className="ft-airport-icao">{f.destination.icao}</div>
                          <div className="ft-airport-name">{f.destination.name}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{fmtTime(f.takeoff)}</td>
                    <td>{fmtTime(f.landing)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
