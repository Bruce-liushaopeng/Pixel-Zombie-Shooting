import { getMapDefinition, MAPS } from './MapDefinitions.js';

export class MapManager {
  constructor(mapId = 'city') {
    this.setMap(mapId);
  }

  setMap(mapId) {
    this.current = getMapDefinition(mapId);
    return this.current;
  }

  list() {
    return MAPS;
  }
}
