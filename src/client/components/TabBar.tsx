interface Props {
  activeTab: "2d" | "3d";
  onChange: (tab: "2d" | "3d") => void;
  count: number;
  lastUpdate: number;
  error: string | null;
}

export function TabBar({ activeTab, onChange, count, lastUpdate, error }: Props) {
  const ago = lastUpdate ? Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000)) : null;
  return (
    <div className="tabbar">
      <span className="brand">
        <span className="brand-icon">✈</span>
        <span className="brand-full">ETIHAD LIVE</span>
        <span className="brand-short">ETD</span>
      </span>
      <button
        className={activeTab === "2d" ? "active" : ""}
        onClick={() => onChange("2d")}
      >
        <span className="tab-full">2D MAP</span>
        <span className="tab-short">2D</span>
      </button>
      <button
        className={activeTab === "3d" ? "active" : ""}
        onClick={() => onChange("3d")}
      >
        <span className="tab-full">3D GLOBE</span>
        <span className="tab-short">3D</span>
      </button>
      <span className="status">
        {error ? (
          <span style={{ color: "#fca5a5" }}>⚠ {error}</span>
        ) : (
          <>
            <span className="dot" />
            <span className="status-full">
              {count} AIRBORNE {ago !== null && `· UPDATED ${ago}s AGO`}
            </span>
            <span className="status-short">
              {count} · {ago !== null ? `${ago}s` : "—"}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
