export const GAME_MODES = {
  single: { id: 'single', roomMode: 'single_player', label: 'Single Player' },
  coop: { id: 'coop', roomMode: 'coop', label: 'Co-op' },
  pvp: { id: 'pvp', roomMode: 'pvp', label: 'PvP' },
};

export function getGameMode(id = 'single') {
  return GAME_MODES[id] || GAME_MODES.single;
}

export function getModeFromRoomMode(roomMode = 'coop') {
  return Object.values(GAME_MODES).find((mode) => mode.roomMode === roomMode) || GAME_MODES.coop;
}

