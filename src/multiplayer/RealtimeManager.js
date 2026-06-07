export class RealtimeManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.channels = [];
  }

  subscribe({ roomId, onRoom, onPlayers, onEvent, onError }) {
    this.unsubscribe();
    if (!this.supabase || !roomId) return;

    const roomChannel = this.supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => onRoom?.(payload.new))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') onError?.('Realtime room connection problem.');
      });

    const playersChannel = this.supabase
      .channel(`room-players:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => onPlayers?.())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') onError?.('Realtime players connection problem.');
      });

    const eventsChannel = this.supabase
      .channel(`room-events:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_events', filter: `room_id=eq.${roomId}` }, (payload) => onEvent?.(payload.new))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') onError?.('Realtime events connection problem.');
      });

    this.channels = [roomChannel, playersChannel, eventsChannel];
  }

  unsubscribe() {
    for (const channel of this.channels) {
      this.supabase?.removeChannel(channel);
    }
    this.channels = [];
  }
}

