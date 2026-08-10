import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { initialTiles } from "./data/bingoItems";

export default function App() {
  const [teams, setTeams] = useState([
    {
      id: "team1",
      name: "Team 1",
      tiles: initialTiles.map((t) => ({ ...t, image: null })),
    },
    {
      id: "team2",
      name: "Team 2",
      tiles: initialTiles.map((t) => ({ ...t, image: null })),
    },
  ]);

  const [activeTeamId, setActiveTeamId] = useState("team1");
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 1. Cargar datos iniciales desde Supabase y escuchar cambios en tiempo real
  useEffect(() => {
    fetchInitialData();

    // Suscribirse a cambios en la tabla team_tiles para actualización en tiempo real
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_tiles" },
        (payload) => {
          const { team_id, tile_id, image_url } = payload.new || payload.old;
          setTeams((prev) =>
            prev.map((t) => {
              if (t.id !== team_id) return t;
              return {
                ...t,
                tiles: t.tiles.map((tile) =>
                  tile.id === tile_id
                    ? { ...tile, image: image_url || null }
                    : tile,
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

      // Cargar Nombres de Equipos
      const { data: dbTeams } = await supabase.from("teams").select("*");

      // Cargar Casillas con Imágenes
      const { data: dbTiles } = await supabase.from("team_tiles").select("*");

      setTeams((prevTeams) =>
        prevTeams.map((team) => {
          const foundTeam = dbTeams?.find((t) => t.id === team.id);
          const teamName = foundTeam ? foundTeam.name : team.name;

          const updatedTiles = team.tiles.map((tile) => {
            const foundTile = dbTiles?.find(
              (t) => t.team_id === team.id && t.tile_id === tile.id,
            );
            return {
              ...tile,
              image: foundTile ? foundTile.image_url : null,
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

  // 2. Cambiar Nombre del Equipo en Supabase
  const handleTeamNameChange = async (e) => {
    const newName = e.target.value;

    setTeams((prev) =>
      prev.map((t) => (t.id === activeTeamId ? { ...t, name: newName } : t)),
    );

    await supabase.from("teams").upsert({ id: activeTeamId, name: newName });
  };

  // 3. Subir Imagen a Storage y Guardar URL en la BD
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTileId) return;

    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${activeTeamId}_tile_${selectedTileId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // A) Subir a Storage Bucket
      const { error: uploadError } = await supabase.storage
        .from("bingo-screenshots")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // B) Obtener URL pública de la imagen
      const { data: publicUrlData } = supabase.storage
        .from("bingo-screenshots")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      // C) Guardar o actualizar registro en la BD
      const selectedTile = currentTeam.tiles.find(
        (t) => t.id === selectedTileId,
      );
      const { error: dbError } = await supabase.from("team_tiles").upsert(
        {
          team_id: activeTeamId,
          tile_id: selectedTileId,
          title: selectedTile.title,
          image_url: imageUrl,
        },
        { onConflict: "team_id,tile_id" },
      );

      if (dbError) throw dbError;

      // Actualizar estado local
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== activeTeamId) return t;
          return {
            ...t,
            tiles: t.tiles.map((tile) =>
              tile.id === selectedTileId ? { ...tile, image: imageUrl } : tile,
            ),
          };
        }),
      );
    } catch (error) {
      alert("Error al subir la imagen: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 4. Eliminar Imagen de la BD
  const handleRemoveImage = async () => {
    if (!selectedTileId) return;

    try {
      setUploading(true);

      const { error } = await supabase
        .from("team_tiles")
        .update({ image_url: null })
        .eq("team_id", activeTeamId)
        .eq("tile_id", selectedTileId);

      if (error) throw error;

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== activeTeamId) return t;
          return {
            ...t,
            tiles: t.tiles.map((tile) =>
              tile.id === selectedTileId ? { ...tile, image: null } : tile,
            ),
          };
        }),
      );
    } catch (error) {
      alert("Error al eliminar la imagen: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const currentTeam = teams.find((t) => t.id === activeTeamId);
  const selectedTile = currentTeam?.tiles.find((t) => t.id === selectedTileId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
        Cargando bingo del clan...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
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

        {/* Editar Nombre de Equipo */}
        <div className="flex justify-center items-center gap-2 bg-slate-800 p-4 rounded-b-lg border border-slate-700">
          <span className="text-slate-400 text-sm font-medium">
            Nombre del Equipo:
          </span>
          {isEditingTitle ? (
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
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Grid 5x5 + Panel Lateral */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grilla 5x5 */}
        <div className="lg:col-span-3 grid grid-cols-5 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-2xl">
          {currentTeam.tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => setSelectedTileId(tile.id)}
              className={`aspect-square p-2 rounded-lg border text-xs sm:text-sm font-semibold flex flex-col justify-between items-center text-center transition-all relative overflow-hidden ${
                selectedTileId === tile.id
                  ? "border-amber-400 ring-2 ring-amber-400/50 bg-slate-800"
                  : tile.image
                    ? "border-emerald-500/50 bg-slate-900/90"
                    : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/60"
              }`}
            >
              {tile.image ? (
                <img
                  src={tile.image}
                  alt={tile.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                />
              ) : null}

              <span
                className={`z-10 bg-slate-950/80 px-1 py-0.5 rounded text-[11px] leading-tight ${
                  tile.image
                    ? "text-amber-300 font-bold border border-amber-500/30"
                    : "text-slate-300"
                }`}
              >
                {tile.title}
              </span>

              {tile.image && (
                <span className="z-10 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  ¡Logrado!
                </span>
              )}
            </button>
          ))}
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
                <p className="text-sm font-bold text-slate-100 bg-slate-900 p-2.5 rounded border border-slate-700">
                  {selectedTile.title}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                  Prueba (Screenshot):
                </span>
                {selectedTile.image ? (
                  <div className="relative rounded overflow-hidden border border-emerald-500/50">
                    <img
                      src={selectedTile.image}
                      alt="Prueba subida"
                      className="w-full h-36 object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-36 bg-slate-900 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                    Sin foto asignada aún
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <label
                  className={`w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-4 rounded text-center block cursor-pointer transition-colors text-sm shadow ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {uploading
                    ? "Procesando..."
                    : selectedTile.image
                      ? "Cambiar Foto"
                      : "Subir Screenshot"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>

                {selectedTile.image && (
                  <button
                    onClick={handleRemoveImage}
                    disabled={uploading}
                    className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold py-2 px-4 rounded transition-colors text-sm disabled:opacity-50"
                  >
                    Eliminar Foto
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs text-center py-8">
              Haz click en cualquiera de los 25 cuadros de la grilla para subir,
              ver o eliminar la foto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
