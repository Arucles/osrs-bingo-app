import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { initialTiles } from "./data/bingoItems";

const CAPTAIN_PIN = import.meta.env.VITE_CAPTAIN_PIN || "1234";

const TEAM_MEMBERS = {
  team1: [
    "Suertudont",
    "Queen Pulga",
    "Sebaspb",
    "Fotopata",
    "Regladiont",
    "Saeko Jaeger",
    "ThightsLover",
    "Narizon",
    "Neldo",
    "Karlos",
    "Sofia Sykes",
    "Conejo",
    "Tio Zombie",
  ],
  team2: [
    "Rhaegnar",
    "Pajau",
    "Deiwanito",
    "Iron Coronao",
    "Son Horas",
    "SirPoo",
    "Thezita",
    "Arucles",
    "Kasuwu",
    "Shiron",
    "Zorrinha",
    "SanSebastian",
    "Sickz",
  ],
};

// Paleta de cada equipo. Son triples RGB porque se inyectan en las variables
// --accent-* que lee tailwind.config.js, y asi los modificadores de opacidad
// (bg-accent-500/10) siguen funcionando.
const TEAM_THEMES = {
  team1: {
    name: "Oro",
    vars: {
      "--accent-200": "253 230 138",
      "--accent-300": "252 211 77",
      "--accent-400": "251 191 36",
      "--accent-500": "245 158 11",
      "--accent-600": "217 119 6",
      "--accent-950": "69 26 3",
    },
  },
  team2: {
    name: "Violeta",
    vars: {
      "--accent-200": "221 214 254",
      "--accent-300": "196 181 253",
      "--accent-400": "167 139 250",
      "--accent-500": "139 92 246",
      "--accent-600": "124 58 237",
      "--accent-950": "46 16 101",
    },
  },
};

const isTileDone = (tile) => tile.images.length >= (tile.requiredCount || 1);

// Gana el equipo que complete mas casillas.
const getTeamProgress = (team) => ({
  tilesDone: team.tiles.filter(isTileDone).length,
  totalTiles: team.tiles.length,
  photos: team.tiles.reduce((sum, t) => sum + t.images.length, 0),
});

function Scoreboard({ teams, activeTeamId, onSelectTeam }) {
  const stats = teams.map((team) => ({
    team,
    theme: TEAM_THEMES[team.id],
    progress: getTeamProgress(team),
  }));

  // Gana el equipo que complete mas casillas.
  const ranked = [...stats].sort(
    (a, b) => b.progress.tilesDone - a.progress.tilesDone,
  );

  const [first, second] = ranked;
  const diffTiles = second
    ? first.progress.tilesDone - second.progress.tilesDone
    : 0;
  const isTied = !second || diffTiles === 0;

  const leadLabel = isTied
    ? "Empate"
    : `${first.team.name} +${diffTiles} casilla${diffTiles === 1 ? "" : "s"}`;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          ⚔️ Marcador
        </h2>
        <span className="text-xs font-semibold text-slate-400">
          {leadLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stats.map(({ team, theme, progress }) => {
          const pct = Math.round(
            (progress.tilesDone / progress.totalTiles) * 100,
          );
          const isLeading =
            !isTied && first.team.id === team.id && progress.tilesDone > 0;
          const isActive = activeTeamId === team.id;

          return (
            <button
              key={team.id}
              style={theme.vars}
              onClick={() => onSelectTeam(team.id)}
              className={`accent-transition text-left rounded-lg border p-3 ${
                isActive
                  ? "border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/40"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-accent-400" />
                  <span className="font-bold text-sm text-accent-300 truncate">
                    {team.name || "Sin nombre"}
                  </span>
                </div>
                {isLeading && (
                  <span className="shrink-0 text-[10px] font-bold uppercase bg-accent-500 text-slate-950 px-2 py-0.5 rounded-full">
                    👑 Liderando
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-2.5">
                <span className="text-3xl font-bold text-accent-300 leading-none">
                  {progress.tilesDone}
                </span>
                <span className="text-[11px] text-slate-400">
                  /{progress.totalTiles} casillas
                </span>
              </div>

              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
                <span>{pct}% del cartón</span>
                <span>
                  {progress.photos} foto{progress.photos === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [teams, setTeams] = useState([
    {
      id: "team1",
      name: "Team Suertudont",
      tiles: initialTiles.map((t) => ({ ...t, images: [] })),
    },
    {
      id: "team2",
      name: "Team Rhaegnar",
      tiles: initialTiles.map((t) => ({ ...t, images: [] })),
    },
  ]);

  const [activeTeamId, setActiveTeamId] = useState("team1");
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Estado para la imagen ampliada
  const [zoomImage, setZoomImage] = useState(null);

  // Estados de Capitán
  const [isCaptain, setIsCaptain] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    fetchInitialData();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_tiles" },
        (payload) => {
          const { team_id, tile_id, image_urls, image_url } =
            payload.new || payload.old;
          const urls =
            image_urls && image_urls.length > 0
              ? image_urls
              : image_url
                ? [image_url]
                : [];

          setTeams((prev) =>
            prev.map((t) => {
              if (t.id !== team_id) return t;
              return {
                ...t,
                tiles: t.tiles.map((tile) =>
                  tile.id === tile_id ? { ...tile, images: urls } : tile,
                ),
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setZoomImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: dbTeams } = await supabase.from("teams").select("*");
      const { data: dbTiles } = await supabase.from("team_tiles").select("*");

      setTeams((prevTeams) =>
        prevTeams.map((team) => {
          const foundTeam = dbTeams?.find((t) => t.id === team.id);
          const teamName = foundTeam ? foundTeam.name : team.name;

          const updatedTiles = team.tiles.map((tile) => {
            const foundTile = dbTiles?.find(
              (t) => t.team_id === team.id && t.tile_id === tile.id,
            );
            let urls = [];
            if (foundTile) {
              urls =
                foundTile.image_urls && foundTile.image_urls.length > 0
                  ? foundTile.image_urls
                  : foundTile.image_url
                    ? [foundTile.image_url]
                    : [];
            }
            return {
              ...tile,
              images: urls,
            };
          });

          return {
            ...team,
            name: teamName,
            tiles: updatedTiles,
          };
        }),
      );
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (inputPin === CAPTAIN_PIN) {
      setIsCaptain(true);
      setShowPinModal(false);
      setInputPin("");
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleTeamNameChange = async (e) => {
    const newName = e.target.value;
    setTeams((prev) =>
      prev.map((t) => (t.id === activeTeamId ? { ...t, name: newName } : t)),
    );
    await supabase.from("teams").upsert({ id: activeTeamId, name: newName });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTileId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${activeTeamId}_tile_${selectedTileId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("bingo-screenshots")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("bingo-screenshots")
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;
      const selectedTile = currentTeam.tiles.find(
        (t) => t.id === selectedTileId,
      );
      const updatedImages = [...(selectedTile.images || []), imageUrl];

      const { error: dbError } = await supabase.from("team_tiles").upsert(
        {
          team_id: activeTeamId,
          tile_id: selectedTileId,
          title: selectedTile.title,
          image_urls: updatedImages,
          image_url: updatedImages[0] || null,
        },
        { onConflict: "team_id,tile_id" },
      );

      if (dbError) throw dbError;

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== activeTeamId) return t;
          return {
            ...t,
            tiles: t.tiles.map((tile) =>
              tile.id === selectedTileId
                ? { ...tile, images: updatedImages }
                : tile,
            ),
          };
        }),
      );
    } catch (error) {
      alert("Error al subir imagen: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImageIndex = async (indexToRemove) => {
    if (!selectedTileId) return;

    try {
      setUploading(true);
      const selectedTile = currentTeam.tiles.find(
        (t) => t.id === selectedTileId,
      );
      const updatedImages = selectedTile.images.filter(
        (_, idx) => idx !== indexToRemove,
      );

      const { error } = await supabase.from("team_tiles").upsert(
        {
          team_id: activeTeamId,
          tile_id: selectedTileId,
          title: selectedTile.title,
          image_urls: updatedImages,
          image_url: updatedImages[0] || null,
        },
        { onConflict: "team_id,tile_id" },
      );

      if (error) throw error;

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== activeTeamId) return t;
          return {
            ...t,
            tiles: t.tiles.map((tile) =>
              tile.id === selectedTileId
                ? { ...tile, images: updatedImages }
                : tile,
            ),
          };
        }),
      );
    } catch (error) {
      alert("Error al eliminar imagen: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const currentTeam = teams.find((t) => t.id === activeTeamId);
  const selectedTile = currentTeam?.tiles.find((t) => t.id === selectedTileId);
  const currentMembers = TEAM_MEMBERS[activeTeamId] || [];
  const activeTheme = TEAM_THEMES[activeTeamId] || TEAM_THEMES.team1;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-accent-400 flex items-center justify-center font-bold">
        Cargando bingo del clan...
      </div>
    );
  }

  return (
    <div
      style={activeTheme.vars}
      className="accent-transition min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center relative"
    >
      {/* Botón superior de Estado de Capitán */}
      <div className="absolute top-4 right-6">
        {isCaptain ? (
          <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/50 px-3 py-1 rounded-full text-xs text-emerald-300 font-semibold">
            <span>🛡️ Modo Capitán Activo</span>
            <button
              onClick={() => setIsCaptain(false)}
              className="text-slate-400 hover:text-white underline ml-2"
            >
              Salir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPinModal(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent-400 transition-colors shadow"
          >
            🔒 Soy Capitán (Ingresar PIN)
          </button>
        )}
      </div>

      <header className="w-full max-w-6xl mb-6">
        <h1
          id="title-osrs"
          className="text-xl sm:text-2xl text-center text-accent-400 mb-6 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] tracking-wide"
        >
          Bingo RCH 14-16 Agosto 2026
        </h1>

        {/* Marcador: tambien funciona como selector de equipo */}
        <Scoreboard
          teams={teams}
          activeTeamId={activeTeamId}
          onSelectTeam={(id) => {
            setActiveTeamId(id);
            setSelectedTileId(null);
          }}
        />

        {/* Nombre de Equipo e Integrantes */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col items-center gap-3">
          <div className="flex justify-center items-center gap-2">
            <span className="text-slate-400 text-sm font-medium">Equipo:</span>
            {isEditingTitle && isCaptain ? (
              <input
                type="text"
                value={currentTeam.name}
                onChange={handleTeamNameChange}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
                autoFocus
                className="bg-slate-950 text-accent-300 font-bold px-3 py-1 rounded border border-accent-500 outline-none"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-accent-300">
                  {currentTeam.name || "Sin nombre"}
                </h2>
                {isCaptain && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Editar
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-2 text-xs font-semibold text-accent-400 hover:text-accent-300 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 transition-colors"
          >
            <span>👥 Integrantes ({currentMembers.length})</span>
            <span className="text-[10px]">{showMembers ? "▲" : "▼"}</span>
          </button>

          {showMembers && (
            <div className="w-full max-w-xl bg-slate-950/90 p-4 rounded-lg border border-slate-700 mt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {currentMembers.map((member, index) => (
                  <div
                    key={index}
                    className="bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded text-xs text-slate-300 flex items-center gap-2"
                  >
                    <span className="text-accent-400/70 font-mono text-[10px]">
                      {index + 1}.
                    </span>
                    <span className="font-medium truncate">{member}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Grid 5x5 Ampliado + Panel Lateral */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grilla 5x5 con mayor tamaño (h-36 / min-h-[130px]) */}
        <div className="lg:col-span-3 grid grid-cols-5 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-2xl">
          {currentTeam.tiles.map((tile) => {
            const required = tile.requiredCount || 1;
            const uploaded = tile.images.length;
            const isCompleted = uploaded >= required;

            return (
              <button
                key={tile.id}
                onClick={() => setSelectedTileId(tile.id)}
                className={`group h-32 sm:h-36 rounded-lg border transition-all relative overflow-hidden flex flex-col bg-slate-950 ${
                  selectedTileId === tile.id
                    ? "border-accent-400 ring-2 ring-accent-400/50 scale-[1.02] z-20"
                    : isCompleted
                      ? "border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      : uploaded > 0
                        ? "border-accent-500/50"
                        : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Banda de arte del item. Las capturas NO se muestran aca:
                    viven en el panel lateral para no ensuciar la grilla. */}
                <div className="relative flex-1 min-h-0 w-full">
                  <img
                    src={tile.placeholder}
                    alt={tile.title}
                    className={`w-full h-full object-contain pointer-events-none transition-all ${
                      isCompleted
                        ? ""
                        : "opacity-75 saturate-[0.6] group-hover:opacity-100 group-hover:saturate-100"
                    }`}
                  />

                  {isCompleted && (
                    <div className="absolute inset-0 bg-emerald-400/10 pointer-events-none" />
                  )}

                  {/* Progreso de casillas que piden varias pruebas */}
                  {required > 1 && (
                    <span
                      className={`absolute top-1.5 left-1.5 z-30 text-[10px] px-1.5 py-0.5 rounded font-bold shadow pointer-events-none border ${
                        isCompleted
                          ? "bg-emerald-500 text-slate-950 border-emerald-300"
                          : "bg-slate-950/90 text-accent-300 border-accent-500/50"
                      }`}
                    >
                      {uploaded}/{required}
                    </span>
                  )}

                  {/* Indica que hay pruebas cargadas sin tener que mostrarlas */}
                  {uploaded > 0 && (
                    <span className="absolute top-1.5 right-1.5 z-30 text-[10px] bg-slate-950/90 border border-slate-600 text-slate-200 px-1.5 py-0.5 rounded font-bold shadow pointer-events-none">
                      📷 {uploaded}
                    </span>
                  )}

                  {isCompleted && (
                    <div className="absolute bottom-1 right-1.5 z-30 bg-emerald-500 text-slate-950 rounded-full p-1 shadow-lg border border-emerald-300 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 stroke-[3.5]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Titulo como pie fijo: la imagen ya no trae texto quemado */}
                <span
                  className={`z-20 h-9 shrink-0 flex items-center justify-center px-1.5 text-[10px] sm:text-[11px] leading-tight text-center w-full border-t pointer-events-none ${
                    isCompleted
                      ? "bg-emerald-950/80 text-emerald-200 font-bold border-emerald-500/40"
                      : "bg-slate-900 text-slate-200 font-medium border-slate-800"
                  }`}
                >
                  <span className="line-clamp-2">{tile.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel CRUD Lateral */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-fit">
          <h3 className="text-lg font-bold text-accent-400 mb-4 pb-2 border-b border-slate-700">
            Detalle de Casilla
          </h3>

          {selectedTile ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                  Ítem Requerido:
                </span>
                <p className="text-sm font-bold text-slate-100 bg-slate-900 p-2.5 rounded border border-slate-700 flex justify-between items-center gap-2">
                  <span>{selectedTile.title}</span>
                  <span className="text-xs text-accent-400 bg-accent-500/10 px-2 py-0.5 rounded border border-accent-500/20 shrink-0">
                    Req: {selectedTile.requiredCount || 1}
                  </span>
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                  Regla / Descripción:
                </span>
                <p className="text-xs text-accent-200/90 bg-slate-900/90 p-2.5 rounded border border-accent-500/20 leading-relaxed italic">
                  {selectedTile.description || "Sin descripción"}
                </p>
              </div>

              {/* Galería de Capturas */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                    Pruebas ({selectedTile.images.length}/
                    {selectedTile.requiredCount}):
                  </span>
                  {selectedTile.images.length >= selectedTile.requiredCount && (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">
                      ✓ Meta alcanzada
                    </span>
                  )}
                </div>

                {selectedTile.images.length > 0 ? (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {selectedTile.images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative rounded overflow-hidden border border-slate-700 group"
                      >
                        <img
                          src={imgUrl}
                          alt={`Prueba ${idx + 1}`}
                          onClick={() => setZoomImage(imgUrl)}
                          className="w-full h-28 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                          title="Haz clic para agrandar imagen"
                        />
                        <span className="absolute top-1 left-1 bg-slate-950/80 text-accent-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 font-bold pointer-events-none">
                          Foto #{idx + 1} (Clic para agrandar)
                        </span>

                        {isCaptain && (
                          <button
                            onClick={() => handleRemoveImageIndex(idx)}
                            disabled={uploading}
                            className="absolute top-1 right-1 bg-rose-600/90 hover:bg-rose-600 text-white p-1 rounded transition-colors text-xs"
                            title="Eliminar esta foto"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-28 bg-slate-900 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                    Sin fotos asignadas aún
                  </div>
                )}
              </div>

              {/* Acciones de Capitán */}
              <div className="space-y-2 pt-2">
                {isCaptain ? (
                  <label
                    className={`w-full bg-accent-500 hover:bg-accent-600 text-slate-950 font-bold py-2 px-4 rounded text-center block cursor-pointer transition-colors text-sm shadow ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {uploading
                      ? "Procesando..."
                      : selectedTile.images.length > 0
                        ? "Añadir Otra Foto"
                        : "Subir Screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="bg-slate-900/80 p-3 rounded border border-slate-700 text-center">
                    <p className="text-xs text-slate-400 mb-2">
                      Solo capitanes pueden modificar las capturas.
                    </p>
                    <button
                      onClick={() => setShowPinModal(true)}
                      className="text-xs text-accent-400 hover:text-accent-300 font-bold underline"
                    >
                      Ingresar PIN de Capitán
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs text-center py-8">
              Haz click en cualquiera de los 25 cuadros de la grilla para ver
              las fotos subidas.
            </p>
          )}
        </div>
      </div>

      {/* MODAL ZOOM DE IMAGEN AMPLIADA */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <div className="flex gap-3 mb-2">
              <a
                href={zoomImage}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="bg-accent-500 hover:bg-accent-600 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-full shadow transition-colors"
              >
                🔗 Abrir en pestaña nueva
              </a>
              <button
                onClick={() => setZoomImage(null)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
              >
                ✕ Cerrar (ESC)
              </button>
            </div>

            <img
              src={zoomImage}
              alt="Screenshot ampliada"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[80vh] object-contain rounded-lg border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* MODAL DE PIN DE CAPITÁN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-accent-400 mb-2 text-center">
              Acceso de Capitán
            </h3>
            <p className="text-xs text-slate-300 mb-4 text-center">
              Ingresa el PIN para habilitar la subida y modificación de
              capturas.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="PIN secreto"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                autoFocus
                className="w-xl bg-slate-900 border border-slate-700 text-white text-center text-lg tracking-widest font-bold py-2 px-3 rounded outline-none focus:border-accent-500"
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-semibold text-center">
                  PIN incorrecto. Intenta de nuevo.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinError(false);
                  }}
                  className="w-1/2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 rounded text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-accent-500 hover:bg-accent-600 text-slate-950 font-bold py-2 rounded text-sm transition-colors"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
