import { Component } from '@angular/core';
import { SnakeGame } from './snake-game/snake-game';

@Component({
  selector: 'app-root',
  imports: [SnakeGame],
  template: '<app-snake-game></app-snake-game>',
  styles: [],
})
export class App {}
