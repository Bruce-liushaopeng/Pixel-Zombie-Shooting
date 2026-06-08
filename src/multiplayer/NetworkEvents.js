export const NETWORK_EVENTS = {
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STARTED: 'game_started',
  PLAYER_MOVE: 'player_move',
  PLAYER_SHOOT: 'player_shoot',
  PLAYER_HIT: 'player_hit',
  PLAYER_DIED: 'player_died',
  PLAYER_DOWNED: 'player_downed',
  PLAYER_REVIVED: 'player_revived',
  ZOMBIE_HIT: 'zombie_hit',
  ZOMBIE_KILLED: 'zombie_killed',
  PICKUP_COLLECTED: 'pickup_collected',
  TOWER_PLACED: 'tower_placed',
  SPECIAL_USED: 'special_used',
  BOSS_SPAWNED: 'boss_spawned',
  BOSS_STATE: 'boss_state',
  WAVE_STARTED: 'wave_started',
  WAVE_COMPLETED: 'wave_completed',
  GAME_OVER: 'game_over',
  SYNC_STATE: 'sync_state',
};

export function nowPayload(extra = {}) {
  return {
    ...extra,
    timestamp: Date.now(),
  };
}
