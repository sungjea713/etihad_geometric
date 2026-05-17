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
      <span className="brand">✈ ETIHAD LIVE</span>
      <button
        className={activeTab === "2d" ? "active" : ""}
        onClick={() => onChange("2d")}
      >
        2D MAP
      </button>
      <button
        className={activeTab === "3d" ? "active" : ""}
        onClick={() => onChange("3d")}
      >
        3D GLOBE
      </button>
      <span className="status">
        {error ? (
          <span style={{ color: "#fca5a5" }}>⚠ {error}</span>
        ) : (
          <>
            <span className="dot" />
            {count} AIRBORNE {ago !== null && `· UPDATED ${ago}s AGO`}
          </>
        )}
      </span>
    </div>
  );
}
