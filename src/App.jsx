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

  // Subir nueva foto (Agrega al arreglo existente)
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

  // Eliminar una foto específica por su índice
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
        Cargando bingo del clan...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center relative">
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
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 transition-colors shadow"
          >
            🔒 Soy Capitán (Ingresar PIN)
          </button>
        )}
      </div>

      <header className="w-full max-w-5xl mb-6">
        <h1 className="text-3xl font-bold text-center text-amber-400 mb-6 tracking-wide">
          OSRS Clan Bingo
        </h1>

        {/* Pestañas de Selección */}
        <div className="flex justify-center gap-4 mb-4">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                setActiveTeamId(team.id);
                setSelectedTileId(null);
              }}
              className={`px-6 py-2 rounded-t-lg font-semibold transition-colors ${
                activeTeamId === team.id
                  ? "bg-amber-500 text-slate-950 shadow-lg"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {team.name || "Sin nombre"}
            </button>
          ))}
        </div>

        {/* Nombre de Equipo y Desplegable de Integrantes */}
        <div className="bg-slate-800 p-4 rounded-b-lg border border-slate-700 flex flex-col items-center gap-3">
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
                className="bg-slate-950 text-amber-300 font-bold px-3 py-1 rounded border border-amber-500 outline-none"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-amber-300">
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
            className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 transition-colors"
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
                    <span className="text-amber-400/70 font-mono text-[10px]">
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

      {/* Grid 5x5 + Panel Lateral */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grilla 5x5 */}
        <div className="lg:col-span-3 grid grid-cols-5 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-2xl">
          {currentTeam.tiles.map((tile) => {
            const isCompleted = tile.images.length >= (tile.requiredCount || 1);
            const mainImage = tile.images[0];

            return (
              <button
                key={tile.id}
                onClick={() => setSelectedTileId(tile.id)}
                className={`aspect-square p-2 rounded-lg border text-xs sm:text-sm font-semibold flex flex-col justify-between items-center text-center transition-all relative overflow-hidden ${
                  selectedTileId === tile.id
                    ? "border-amber-400 ring-2 ring-amber-400/50 bg-slate-800"
                    : isCompleted
                      ? "border-emerald-500/50 bg-slate-900/90"
                      : tile.images.length > 0
                        ? "border-amber-500/40 bg-slate-900/60"
                        : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/60"
                }`}
              >
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={tile.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                  />
                ) : null}

                <span
                  className={`z-10 bg-slate-950/80 px-1 py-0.5 rounded text-[11px] leading-tight ${
                    isCompleted
                      ? "text-amber-300 font-bold border border-amber-500/30"
                      : "text-slate-300"
                  }`}
                >
                  {tile.title}
                </span>

                {/* Contador / Badge */}
                <div className="z-10 flex items-center gap-1">
                  {tile.requiredCount > 1 && (
                    <span className="text-[10px] bg-slate-900/90 border border-slate-700 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                      {tile.images.length}/{tile.requiredCount}
                    </span>
                  )}

                  {/* Ticket Verde de Completado */}
                  {isCompleted && (
                    <div className="bg-emerald-500 text-slate-950 rounded-full p-1 shadow-lg border border-emerald-300 flex items-center justify-center">
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
              </button>
            );
          })}
        </div>

        {/* Panel CRUD Lateral */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-fit">
          <h3 className="text-lg font-bold text-amber-400 mb-4 pb-2 border-b border-slate-700">
            Detalle de Casilla
          </h3>

          {selectedTile ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                  Ítem Requerido:
                </span>
                <p className="text-sm font-bold text-slate-100 bg-slate-900 p-2.5 rounded border border-slate-700 flex justify-between items-center">
                  <span>{selectedTile.title}</span>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Req: {selectedTile.requiredCount || 1}
                  </span>
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                  Regla / Descripción:
                </span>
                <p className="text-xs text-amber-200/90 bg-slate-900/90 p-2.5 rounded border border-amber-500/20 leading-relaxed italic">
                  {selectedTile.description || "Sin descripción"}
                </p>
              </div>

              {/* Galería de Capturas Subidas */}
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
                          className="w-full h-28 object-cover"
                        />
                        <span className="absolute top-1 left-1 bg-slate-950/80 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 font-bold">
                          Foto #{idx + 1}
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
                    className={`w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-4 rounded text-center block cursor-pointer transition-colors text-sm shadow ${uploading ? "opacity-50 pointer-events-none" : ""}`}
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
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold underline"
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

      {/* MODAL DE PIN DE CAPITÁN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-amber-400 mb-2 text-center">
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
                className="w-full bg-slate-900 border border-slate-700 text-white text-center text-lg tracking-widest font-bold py-2 px-3 rounded outline-none focus:border-amber-500"
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
                  className="w-1/2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded text-sm transition-colors"
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
