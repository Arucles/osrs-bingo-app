import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { initialTiles } from "./data/bingoItems";

// PINs independientes por equipo
const CAPTAIN_PINS = {
  team1: import.meta.env.VITE_CAPTAIN_PIN_TEAM1 || "9503",
  team2: import.meta.env.VITE_CAPTAIN_PIN_TEAM2 || "8240",
};

// Integrantes de cada equipo
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

// Fechas del evento
const START_DATE = new Date("2026-08-14T19:00:00-04:00").getTime();
const END_DATE = START_DATE + 48 * 60 * 60 * 1000;

// Normalizar lista de fotos
const normalizePhotos = (tile) => {
  if (Array.isArray(tile.photos) && tile.photos.length > 0) {
    return tile.photos;
  }
  if (Array.isArray(tile.images) && tile.images.length > 0) {
    return tile.images.map((url) => ({
      url,
      by: "Sin asignar",
      at: null,
    }));
  }
  return [];
};

const isTileDone = (tile) => {
  if (tile.isExtraTile) return false;
  const photos = normalizePhotos(tile);

  // Excepción para "x1 Enh or x3 Armour" (id: 18)
  if (tile.id === 18 || tile.title?.toLowerCase().includes("enh")) {
    const hasEnh = photos.some((p) => p.isEnh);
    if (hasEnh) return true;
  }

  // Excepción para "x1 Virtus Piece or x2 Vestige or x1 axe piece" (id: 6)
  if (tile.id === 6 || tile.title?.toLowerCase().includes("virtus")) {
    const hasInstantDt2 = photos.some((p) => p.isVirtus || p.isAxe);
    if (hasInstantDt2) return true;
  }

  return photos.length >= (tile.requiredCount || 1);
};

const getTeamProgress = (team) => {
  const gridTiles = team.tiles.filter((t) => !t.isExtraTile);
  const tilesDone = gridTiles.filter(isTileDone).length;

  const totalPhotos = team.tiles.reduce(
    (sum, t) => sum + normalizePhotos(t).length,
    0,
  );

  let extraPoints = 0;
  team.tiles.forEach((tile) => {
    const photos = normalizePhotos(tile);
    if (tile.id === 26 || tile.id === 27) {
      extraPoints += photos.length * 0.5;
    }
  });

  const totalPoints = tilesDone + extraPoints;

  return {
    tilesDone,
    totalTiles: gridTiles.length,
    extraPoints,
    totalPoints,
    photos: totalPhotos,
  };
};

const getTeamMVP = (team) => {
  const counts = {};

  team.tiles.forEach((tile) => {
    const photos = normalizePhotos(tile);
    photos.forEach((photo) => {
      const player = photo.by;
      if (player && player !== "Sin asignar") {
        counts[player] = (counts[player] || 0) + 1;
      }
    });
  });

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  const maxDrops = Math.max(...entries.map(([, qty]) => qty));
  const topPlayers = entries
    .filter(([, qty]) => qty === maxDrops)
    .map(([name]) => name);

  return {
    players: topPlayers,
    drops: maxDrops,
  };
};

function CountdownTimer({ teams }) {
  const [timeLeft, setTimeLeft] = useState({
    phase: "before",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCounter = () => {
      const now = new Date().getTime();

      if (now < START_DATE) {
        const diff = START_DATE - now;
        setTimeLeft({
          phase: "before",
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      } else if (now >= START_DATE && now < END_DATE) {
        const diff = END_DATE - now;
        setTimeLeft({
          phase: "active",
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      } else {
        setTimeLeft({
          phase: "ended",
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });
      }
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);
    return () => clearInterval(interval);
  }, []);

  if (timeLeft.phase === "ended") {
    const team1Prog = getTeamProgress(teams[0]);
    const team2Prog = getTeamProgress(teams[1]);

    let winnerText = "";
    if (team1Prog.totalPoints > team2Prog.totalPoints) {
      winnerText = `🏆 ¡GANADOR OFICIAL: ${teams[0].name.toUpperCase()} (${team1Prog.totalPoints} vs ${team2Prog.totalPoints} pts)! 🏆`;
    } else if (team2Prog.totalPoints > team1Prog.totalPoints) {
      winnerText = `🏆 ¡GANADOR OFICIAL: ${teams[1].name.toUpperCase()} (${team2Prog.totalPoints} vs ${team1Prog.totalPoints} pts)! 🏆`;
    } else {
      winnerText = `🤝 ¡EMPATE TÉCNICO OFICIAL (${team1Prog.totalPoints} - ${team2Prog.totalPoints} pts)! 🤝`;
    }

    return (
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-500/20 border-2 border-amber-400 rounded-xl p-4 text-center mb-6 max-w-2xl mx-auto shadow-2xl animate-pulse">
        <span className="font-osrs text-lg sm:text-xl text-amber-200 block mb-1">
          🏁 EL BINGO HA FINALIZADO 🏁
        </span>
        <p className="font-osrs text-base sm:text-lg text-amber-400">
          {winnerText}
        </p>
      </div>
    );
  }

  const isBefore = timeLeft.phase === "before";

  return (
    <div
      className={`max-w-md mx-auto rounded-xl border p-3 mb-6 text-center shadow-lg transition-all ${
        isBefore
          ? "bg-slate-800/90 border-amber-500/40"
          : "bg-emerald-950/50 border-emerald-500/50"
      }`}
    >
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <span className="text-sm">{isBefore ? "⏳" : "🔥"}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {isBefore
            ? "El Bingo inicia en:"
            : "Tiempo restante de evento (48h):"}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-3 font-mono">
        {timeLeft.days > 0 && (
          <div className="flex flex-col items-center">
            <span className="bg-slate-950 px-2.5 py-1 rounded-md text-amber-300 font-bold text-base sm:text-lg border border-slate-800">
              {String(timeLeft.days).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-slate-400 uppercase mt-0.5">
              Días
            </span>
          </div>
        )}

        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-2.5 py-1 rounded-md text-amber-300 font-bold text-base sm:text-lg border border-slate-800">
            {String(timeLeft.hours).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-slate-400 uppercase mt-0.5">
            Horas
          </span>
        </div>

        <span className="text-amber-400 font-bold text-lg mb-3">:</span>

        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-2.5 py-1 rounded-md text-amber-300 font-bold text-base sm:text-lg border border-slate-800">
            {String(timeLeft.minutes).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-slate-400 uppercase mt-0.5">
            Min
          </span>
        </div>

        <span className="text-amber-400 font-bold text-lg mb-3">:</span>

        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-2.5 py-1 rounded-md text-amber-300 font-bold text-base sm:text-lg border border-slate-800">
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-slate-400 uppercase mt-0.5">
            Seg
          </span>
        </div>
      </div>
    </div>
  );
}

function MVPBadge({ team }) {
  const mvp = getTeamMVP(team);

  if (!mvp) return null;

  return (
    <div className="max-w-sm sm:max-w-md w-full mx-auto bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg mt-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0 animate-bounce">👑</span>
        <div className="min-w-0">
          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider block leading-tight">
            MVP del Equipo
          </span>
          <span className="font-osrs text-base sm:text-lg text-amber-200 truncate block py-0.5">
            {mvp.players.join(" & ")}
          </span>
        </div>
      </div>
      <div className="bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs sm:text-sm font-mono shadow shrink-0 ml-3">
        {mvp.drops} {mvp.drops === 1 ? "drop" : "drops"}
      </div>
    </div>
  );
}

function Scoreboard({ teams, activeTeamId, onSelectTeam }) {
  const stats = teams.map((team) => ({
    team,
    theme: TEAM_THEMES[team.id],
    progress: getTeamProgress(team),
  }));

  const ranked = [...stats].sort(
    (a, b) => b.progress.totalPoints - a.progress.totalPoints,
  );

  const [first, second] = ranked;
  const diffPoints = second
    ? first.progress.totalPoints - second.progress.totalPoints
    : 0;
  const isTied = !second || diffPoints === 0;

  const leadLabel = isTied ? "Empate" : `${first.team.name} +${diffPoints} pts`;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
      <div className="relative flex items-center justify-center mb-4 min-h-[24px]">
        <h2 className="font-osrs text-base sm:text-lg text-slate-200 uppercase tracking-wider text-center">
          ⚔️ MARCADOR
        </h2>
        <span className="absolute right-0 text-xs font-semibold text-slate-400">
          {leadLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stats.map(({ team, theme, progress }) => {
          const pct = Math.round(
            (progress.tilesDone / progress.totalTiles) * 100,
          );
          const isLeading =
            !isTied && first.team.id === team.id && progress.totalPoints > 0;
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
                  <span className="w-3 h-3 rounded-full shrink-0 bg-accent-400" />
                  <span className="font-osrs text-lg sm:text-xl text-accent-300 py-0.5">
                    {team.name || "Sin nombre"}
                  </span>
                </div>
                {isLeading && (
                  <span className="shrink-0 text-[10px] font-bold uppercase bg-accent-500 text-slate-950 px-2 py-0.5 rounded-full">
                    👑 Liderando
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-2.5">
                <span className="text-3xl font-bold text-accent-300 leading-none">
                  {progress.totalPoints}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  pts ({progress.tilesDone}/{progress.totalTiles} casillas
                  {progress.extraPoints > 0 &&
                    ` +${progress.extraPoints} extra`}
                  )
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
      tiles: initialTiles.map((t) => ({ ...t, photos: [], images: [] })),
    },
    {
      id: "team2",
      name: "Team Rhaegnar",
      tiles: initialTiles.map((t) => ({ ...t, photos: [], images: [] })),
    },
  ]);

  const [activeTeamId, setActiveTeamId] = useState("team1");
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [zoomImage, setZoomImage] = useState(null);

  const [captainTeamId, setCaptainTeamId] = useState(() => {
    return localStorage.getItem("bingo_captain_team") || null;
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);

  // Estados de ítems que completan casillas instantáneamente
  const [isEnhDrop, setIsEnhDrop] = useState(false);
  const [isVirtusDrop, setIsVirtusDrop] = useState(false);
  const [isAxeDrop, setIsAxeDrop] = useState(false);

  const isCaptainActiveForCurrentTeam = captainTeamId === activeTeamId;
  const currentTeam = teams.find((t) => t.id === activeTeamId);
  const selectedTile = currentTeam?.tiles.find((t) => t.id === selectedTileId);
  const currentMembers = TEAM_MEMBERS[activeTeamId] || [];
  const activeTheme = TEAM_THEMES[activeTeamId] || TEAM_THEMES.team1;
  const tilePhotos = selectedTile ? normalizePhotos(selectedTile) : [];

  const mainGridTiles = currentTeam?.tiles.filter((t) => !t.isExtraTile) || [];
  const extraTiles = currentTeam?.tiles.filter((t) => t.isExtraTile) || [];

  const resetSpecialItemStates = () => {
    setIsEnhDrop(false);
    setIsVirtusDrop(false);
    setIsAxeDrop(false);
  };

  useEffect(() => {
    fetchInitialData();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_tiles" },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;

          const { team_id, tile_id, photos, image_urls, image_url } = row;

          let normalized = photos || [];
          if (!normalized.length && image_urls?.length) {
            normalized = image_urls.map((url) => ({
              url,
              by: "Sin asignar",
              at: null,
            }));
          } else if (!normalized.length && image_url) {
            normalized = [{ url: image_url, by: "Sin asignar", at: null }];
          }

          const urls = normalized.map((p) =>
            typeof p === "string" ? p : p.url,
          );

          setTeams((prev) =>
            prev.map((t) => {
              if (t.id !== team_id) return t;
              return {
                ...t,
                tiles: t.tiles.map((tile) =>
                  tile.id === tile_id
                    ? { ...tile, photos: normalized, images: urls }
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setZoomImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePaste = (e) => {
      if (!isCaptainActiveForCurrentTeam || !selectedTileId || uploading)
        return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageUpload(null, file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [
    selectedTileId,
    selectedMember,
    isEnhDrop,
    isVirtusDrop,
    isAxeDrop,
    isCaptainActiveForCurrentTeam,
    uploading,
    activeTeamId,
  ]);

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
            let photoObjs = [];
            let urls = [];

            if (foundTile) {
              if (
                Array.isArray(foundTile.photos) &&
                foundTile.photos.length > 0
              ) {
                photoObjs = foundTile.photos;
                urls = photoObjs.map((p) => p.url);
              } else if (
                Array.isArray(foundTile.image_urls) &&
                foundTile.image_urls.length > 0
              ) {
                urls = foundTile.image_urls;
                photoObjs = urls.map((url) => ({
                  url,
                  by: "Sin asignar",
                  at: null,
                }));
              } else if (foundTile.image_url) {
                urls = [foundTile.image_url];
                photoObjs = [
                  { url: foundTile.image_url, by: "Sin asignar", at: null },
                ];
              }
            }

            return {
              ...tile,
              photos: photoObjs,
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
    const expectedPin = CAPTAIN_PINS[activeTeamId];

    if (inputPin === expectedPin) {
      setCaptainTeamId(activeTeamId);
      localStorage.setItem("bingo_captain_team", activeTeamId);
      setShowPinModal(false);
      setInputPin("");
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleCaptainLogout = () => {
    setCaptainTeamId(null);
    localStorage.removeItem("bingo_captain_team");
  };

  const handleTeamNameChange = async (e) => {
    const newName = e.target.value;
    setTeams((prev) =>
      prev.map((t) => (t.id === activeTeamId ? { ...t, name: newName } : t)),
    );
    await supabase.from("teams").upsert({ id: activeTeamId, name: newName });
  };

  const handleImageUpload = async (e, pastedFile = null) => {
    const file = pastedFile || e?.target?.files?.[0];
    if (!file || !selectedTileId) return;

    const selectedTile = currentTeam.tiles.find((t) => t.id === selectedTileId);
    const currentPhotos = normalizePhotos(selectedTile);
    const maxRequired = selectedTile.requiredCount || 1;

    if (!selectedTile.isUnlimited) {
      if (
        currentPhotos.length >= maxRequired ||
        currentPhotos.some((p) => p.isEnh || p.isVirtus || p.isAxe)
      ) {
        alert("Esta casilla ya se encuentra completada.");
        return;
      }
    }

    if (!selectedMember) {
      alert("Por favor selecciona qué integrante consiguió el drop.");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.type.split("/")[1] || "png";
      const fileName = `${activeTeamId}_tile_${selectedTileId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("bingo-screenshots")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("bingo-screenshots")
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      const newPhotoObj = {
        url: imageUrl,
        by: selectedMember,
        at: new Date().toISOString(),
        isEnh: isEnhDrop,
        isVirtus: isVirtusDrop,
        isAxe: isAxeDrop,
      };

      const updatedPhotos = [...currentPhotos, newPhotoObj];
      const updatedUrls = updatedPhotos.map((p) => p.url);

      const { error: dbError } = await supabase.from("team_tiles").upsert(
        {
          team_id: activeTeamId,
          tile_id: selectedTileId,
          title: selectedTile.title,
          photos: updatedPhotos,
          image_urls: updatedUrls,
          image_url: updatedUrls[0] || null,
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
                ? { ...tile, photos: updatedPhotos, images: updatedUrls }
                : tile,
            ),
          };
        }),
      );

      setSelectedMember("");
      resetSpecialItemStates();
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
      const currentPhotos = normalizePhotos(selectedTile);
      const updatedPhotos = currentPhotos.filter(
        (_, idx) => idx !== indexToRemove,
      );
      const updatedUrls = updatedPhotos.map((p) => p.url);

      const { error } = await supabase.from("team_tiles").upsert(
        {
          team_id: activeTeamId,
          tile_id: selectedTileId,
          title: selectedTile.title,
          photos: updatedPhotos,
          image_urls: updatedUrls,
          image_url: updatedUrls[0] || null,
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
                ? { ...tile, photos: updatedPhotos, images: updatedUrls }
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

  const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const day = d.getDate();
      const monthNames = [
        "ene",
        "feb",
        "mar",
        "abr",
        "may",
        "jun",
        "jul",
        "ago",
        "sep",
        "oct",
        "nov",
        "dic",
      ];
      const month = monthNames[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month}, ${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-accent-400 flex items-center justify-center font-bold">
        Cargando bingo del clan...
      </div>
    );
  }

  const isSelectedTileFull = selectedTile
    ? !selectedTile.isUnlimited && isTileDone(selectedTile)
    : false;

  return (
    <div
      style={activeTheme.vars}
      className="accent-transition min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center relative"
    >
      <div className="absolute top-4 right-6">
        {isCaptainActiveForCurrentTeam ? (
          <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/50 px-3 py-1 rounded-full text-xs text-emerald-300 font-semibold">
            <span>🛡️ Modo Capitán ({currentTeam.name})</span>
            <button
              onClick={handleCaptainLogout}
              className="text-slate-400 hover:text-white underline ml-2"
            >
              Salir
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setInputPin("");
              setPinError(false);
              setShowPinModal(true);
            }}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent-400 transition-colors shadow"
          >
            🔒 Capitán {currentTeam.name} (Ingresar PIN)
          </button>
        )}
      </div>

      <header className="w-full max-w-6xl mb-6">
        <h1
          id="title-osrs"
          className="text-2xl sm:text-4xl text-center text-accent-400 mb-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] tracking-wide"
        >
          Bingo RCH 14-16 Agosto 2026
        </h1>

        <CountdownTimer teams={teams} />

        <Scoreboard
          teams={teams}
          activeTeamId={activeTeamId}
          onSelectTeam={(id) => {
            setActiveTeamId(id);
            setSelectedTileId(null);
            setSelectedMember("");
            resetSpecialItemStates();
          }}
        />

        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col items-center gap-3">
          <div className="flex justify-center items-center gap-2">
            {isEditingTitle && isCaptainActiveForCurrentTeam ? (
              <input
                type="text"
                value={currentTeam.name}
                onChange={handleTeamNameChange}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
                autoFocus
                className="bg-slate-950 text-accent-300 font-bold px-3 py-1 rounded border border-accent-500 outline-none font-osrs text-2xl sm:text-3xl text-center"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-osrs text-2xl sm:text-3xl text-accent-300 py-1">
                  {currentTeam.name || "Sin nombre"}
                </h2>
                {isCaptainActiveForCurrentTeam && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="text-xs text-slate-400 hover:text-white underline ml-1"
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

          <MVPBadge team={currentTeam} />
        </div>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grilla 5x5 + Sección Puntos Extras Centrada */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="grid grid-cols-5 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-2xl">
            {mainGridTiles.map((tile) => {
              const required = tile.requiredCount || 1;
              const photos = normalizePhotos(tile);
              const uploaded = photos.length;
              const isCompleted = isTileDone(tile);

              return (
                <button
                  key={tile.id}
                  onClick={() => {
                    setSelectedTileId(tile.id);
                    setSelectedMember("");
                    resetSpecialItemStates();
                  }}
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

          {/* Tarjetas Centradas de Puntos Extras (Dusts & Pets) */}
          {extraTiles.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              {extraTiles.map((extraTile) => {
                const photosCount = normalizePhotos(extraTile).length;
                const isSelected = selectedTileId === extraTile.id;

                return (
                  <button
                    key={extraTile.id}
                    onClick={() => {
                      setSelectedTileId(extraTile.id);
                      setSelectedMember("");
                      resetSpecialItemStates();
                    }}
                    className={`w-full sm:w-1/2 max-w-xs h-28 rounded-xl border transition-all relative overflow-hidden flex items-center p-3 gap-3 bg-slate-950 shadow-xl ${
                      isSelected
                        ? "border-amber-400 ring-2 ring-amber-400/50 scale-[1.02] z-20"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-20 h-20 shrink-0 relative">
                      <img
                        src={extraTile.placeholder}
                        alt={extraTile.title}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      {photosCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-30 text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold shadow pointer-events-none">
                          📷 {photosCount}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col text-left justify-center min-w-0">
                      <span className="font-osrs text-base text-amber-300 truncate">
                        ✨ {extraTile.title}
                      </span>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                        {extraTile.description}
                      </p>
                      <span className="text-[10px] text-amber-400/80 font-bold mt-1">
                        +0.5 pts por cada foto
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Lateral de Detalle */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-fit">
          <h3 className="font-osrs text-sm sm:text-base text-accent-400 mb-4 pb-2 border-b border-slate-700 tracking-normal whitespace-nowrap">
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
                    {selectedTile.isUnlimited
                      ? "Ilimitado"
                      : `Req: ${selectedTile.requiredCount || 1}`}
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

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                    Pruebas ({tilePhotos.length}
                    {!selectedTile.isUnlimited &&
                      `/${selectedTile.requiredCount || 1}`}
                    ):
                  </span>
                  {isTileDone(selectedTile) && (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">
                      ✓ Meta alcanzada
                    </span>
                  )}
                </div>

                {tilePhotos.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {tilePhotos.map((photo, idx) => {
                      const imgUrl =
                        typeof photo === "string" ? photo : photo.url;
                      const author = photo.by || "Sin asignar";
                      const timestamp = formatDate(photo.at);

                      return (
                        <div
                          key={idx}
                          className="relative rounded-lg overflow-hidden border border-slate-700 group bg-slate-950 shadow-md"
                        >
                          <img
                            src={imgUrl}
                            alt={`Prueba ${idx + 1}`}
                            onClick={() => setZoomImage(imgUrl)}
                            className="w-full h-32 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                            title="Haz clic para agrandar imagen"
                          />

                          <span className="absolute top-1.5 left-1.5 bg-slate-950/90 text-accent-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 font-bold shadow pointer-events-none flex items-center gap-1">
                            <span>Foto #{idx + 1}</span>
                            {photo.isEnh && (
                              <span className="text-amber-400 font-extrabold">
                                ✨ ENH
                              </span>
                            )}
                            {photo.isVirtus && (
                              <span className="text-purple-400 font-extrabold">
                                ✨ VIRTUS
                              </span>
                            )}
                            {photo.isAxe && (
                              <span className="text-rose-400 font-extrabold">
                                🪓 AXE
                              </span>
                            )}
                          </span>

                          {isCaptainActiveForCurrentTeam && (
                            <button
                              onClick={() => handleRemoveImageIndex(idx)}
                              disabled={uploading}
                              className="absolute top-1.5 right-1.5 bg-rose-600/90 hover:bg-rose-600 text-white w-6 h-6 rounded flex items-center justify-center transition-colors text-xs font-bold shadow"
                              title="Eliminar esta foto"
                            >
                              ✕
                            </button>
                          )}

                          <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs px-2.5 py-1.5 border-t border-slate-800 flex justify-between items-center text-[11px] pointer-events-none">
                            <span className="font-bold text-accent-300 flex items-center gap-1 truncate max-w-[60%]">
                              <span>👤</span>
                              <span className="truncate">{author}</span>
                            </span>
                            {timestamp && (
                              <span className="text-slate-400 text-[10px] font-mono shrink-0">
                                {timestamp}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-28 bg-slate-900 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                    Sin fotos asignadas aún
                  </div>
                )}
              </div>

              {/* Selector de Integrante y Carga de Foto */}
              <div className="space-y-3 pt-2 border-t border-slate-700/60">
                {isCaptainActiveForCurrentTeam ? (
                  <>
                    {!isSelectedTileFull ? (
                      <>
                        <div>
                          <label className="text-xs text-slate-300 uppercase tracking-wider block font-semibold mb-1">
                            ¿Quién consiguió el drop?
                          </label>
                          <select
                            value={selectedMember}
                            onChange={(e) => setSelectedMember(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-accent-500 transition-colors cursor-pointer"
                          >
                            <option value="">
                              Selecciona un integrante...
                            </option>
                            {currentMembers.map((member, idx) => (
                              <option key={idx} value={member}>
                                {member}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Checkbox para Casilla 18: Enhanced */}
                        {(selectedTile.id === 18 ||
                          selectedTile.title
                            ?.toLowerCase()
                            .includes("enh")) && (
                          <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer text-xs text-amber-300 font-semibold my-2">
                            <input
                              type="checkbox"
                              checked={isEnhDrop}
                              onChange={(e) => setIsEnhDrop(e.target.checked)}
                              className="accent-amber-500 rounded"
                            />
                            <span>✨ ¡Fue un Enhanced Weapon Seed (Enh)!</span>
                          </label>
                        )}

                        {/* Checkboxes para Casilla 6: Virtus o Axe */}
                        {(selectedTile.id === 6 ||
                          selectedTile.title
                            ?.toLowerCase()
                            .includes("virtus")) && (
                          <div className="space-y-1.5 my-2">
                            <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer text-xs text-purple-300 font-semibold">
                              <input
                                type="checkbox"
                                checked={isVirtusDrop}
                                onChange={(e) => {
                                  setIsVirtusDrop(e.target.checked);
                                  if (e.target.checked) setIsAxeDrop(false);
                                }}
                                className="accent-purple-500 rounded"
                              />
                              <span>
                                ✨ Fue pieza de Virtus (Completa casilla)
                              </span>
                            </label>

                            <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer text-xs text-rose-300 font-semibold">
                              <input
                                type="checkbox"
                                checked={isAxeDrop}
                                onChange={(e) => {
                                  setIsAxeDrop(e.target.checked);
                                  if (e.target.checked) setIsVirtusDrop(false);
                                }}
                                className="accent-rose-500 rounded"
                              />
                              <span>
                                🪓 Fue pieza de Axe (Completa casilla)
                              </span>
                            </label>
                          </div>
                        )}

                        {/* Zona de Pegar (Ctrl+V) / Drag & Drop */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file && file.type.startsWith("image/")) {
                              handleImageUpload(null, file);
                            }
                          }}
                          className="border-2 border-dashed border-slate-700 hover:border-accent-500/80 bg-slate-900/60 p-3 rounded-lg text-center transition-colors my-2"
                        >
                          <p className="text-xs text-slate-300 font-semibold mb-1">
                            📋 ¡Pega la foto con{" "}
                            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono text-[10px]">
                              Ctrl + V
                            </kbd>
                            !
                          </p>
                          <p className="text-[10px] text-slate-400">
                            O arrástrala aquí / haz clic abajo para buscarla
                          </p>
                        </div>

                        <label
                          className={`w-full font-bold py-2.5 px-4 rounded-lg text-center block transition-colors text-sm shadow ${
                            !selectedMember || uploading
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
                              : "bg-accent-500 hover:bg-accent-600 text-slate-950 cursor-pointer"
                          }`}
                        >
                          {uploading ? "Procesando..." : "Buscar Archivo..."}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={!selectedMember || uploading}
                            className="hidden"
                          />
                        </label>
                      </>
                    ) : (
                      <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-lg text-center space-y-1">
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wide">
                          ✓ Meta alcanzada
                        </p>
                        <p className="text-[11px] text-slate-400">
                          No se permiten más capturas para esta casilla.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-slate-900/80 p-3 rounded border border-slate-700 text-center">
                    <p className="text-xs text-slate-400 mb-2">
                      Solo capitanes de {currentTeam.name} pueden modificar las
                      capturas.
                    </p>
                    <button
                      onClick={() => {
                        setInputPin("");
                        setPinError(false);
                        setShowPinModal(true);
                      }}
                      className="text-xs text-accent-400 hover:text-accent-300 font-bold underline"
                    >
                      Ingresar PIN de Capitán ({currentTeam.name})
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs text-center py-8">
              Haz click en cualquiera de las casillas o en los Puntos Extras
              para ver las fotos subidas.
            </p>
          )}
        </div>
      </div>

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

      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl">
            <h3 className="font-osrs text-xs text-accent-400 mb-2 text-center">
              Acceso Capitán - {currentTeam.name}
            </h3>
            <p className="text-xs text-slate-300 mb-4 text-center">
              Ingresa el PIN asignado a {currentTeam.name} para modificar sus
              capturas.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="PIN secreto"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 text-white text-center text-lg tracking-widest font-bold py-2 px-3 rounded outline-none focus:border-accent-500"
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-semibold text-center">
                  PIN incorrecto para {currentTeam.name}. Intenta de nuevo.
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
