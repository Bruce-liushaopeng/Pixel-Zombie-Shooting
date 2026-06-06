import './styles/base.css';
import { Game } from './game/Game.js';

const canvas = document.querySelector('#game');
const hud = document.querySelector('#hud');
const overlay = document.querySelector('#overlay');

const game = new Game({ canvas, hud, overlay });
game.boot();
