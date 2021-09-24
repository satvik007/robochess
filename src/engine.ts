/**
 * Some of the code in this file is taken from the project https://github.com/nmrugg/stockfish.js/
 */

import * as path from 'path';
import { Game } from './game.js';

const Stockfish = require('../node_modules/stockfish/src/stockfish.js')(
  console,
  path.join(__dirname, '../node_modules/stockfish/src/stockfish.wasm')
);

class Engine {
  engine: any;
  evaler: any;
  time: {
    wtime: number;
    btime: number;
    winc: number;
    binc: number;
    depth: string;
    level: number;
    startTime?: number;
    clockColor: 'white' | 'black';
    nodes?: [];
  };
  playerColor: 'white' | 'black';
  engineStatus: {
    engineLoaded: boolean;
    engineReady: boolean;
    search: string | null;
    score: string;
  };
  announcedGameOver: boolean;
  game: Game;
  isEngineRunning: boolean;

  constructor(game: Game) {
    this.time = {
      wtime: 300000,
      btime: 300000,
      winc: 2000,
      binc: 2000,
      depth: '0',
      level: 0,
      clockColor: 'white',
    };
    this.playerColor = 'white';
    this.engineStatus = {
      engineLoaded: false,
      engineReady: false,
      search: '',
      score: '',
    };
    this.announcedGameOver = false;
    this.game = game;
    this.isEngineRunning = false;
  }

  async initEngine(): Promise<void> {
    this.engine = await Stockfish();
    this.evaler = await Stockfish();
    this.reset();
    this.engine.onmessage = this.engineOnMessage;
    const { baseTime, increment, playerColor } = await this.game.initArgs();
    this.setTime(baseTime, increment);
    this.setPlayerColor(playerColor);
    this.start();
  }

  reset(): void {
    // game.reset();
    this.uciCmd('setoption name Contempt value 0');
    // uciCmd('setoption name Skill Level value 20');
    this.setSkillLevel(0);
    this.uciCmd('setoption name King Safety value 0'); // Agressive 100 (it's now symmetric)
  }

  setSkillLevel(skill: number): void {
    if (skill < 0) {
      skill = 0;
    }
    if (skill > 20) {
      skill = 20;
    }

    if (!this.time) {
      throw new Error('this.time is null');
    }

    this.time.level = skill;

    // Change thinking depth allowance.
    if (skill < 5) {
      this.time.depth = '1';
    } else if (skill < 10) {
      this.time.depth = '2';
    } else if (skill < 15) {
      this.time.depth = '3';
    } else {
      // Let the engine decide.
      this.time.depth = '';
    }

    this.uciCmd('setoption name Skill Level value ' + skill);

    // NOTE: Stockfish level 20 does not make errors (intentially),
    // so these numbers have no effect on level 20.
    // Level 0 starts at 1
    const errProb = Math.round(skill * 6.35 + 1);
    // Level 0 starts at 10
    const maxErr = Math.round(skill * -0.5 + 10);

    this.uciCmd('setoption name Skill Level Maximum Error value ' + maxErr);
    this.uciCmd('setoption name Skill Level Probability value ' + errProb);
  }

  uciCmd(cmd: string, which?: any): void {
    console.log('UCI: ' + cmd);

    (which || this.engine).postMessage(cmd);
  }

  setTime(baseTime: number, increment: number): void {
    this.time.wtime = baseTime * 1000;
    this.time.btime = baseTime * 1000;
    this.time.winc = increment * 1000;
    this.time.binc = increment * 1000;
  }

  setPlayerColor(color: 'white' | 'black'): void {
    this.playerColor = color;
  }

  start(): void {
    this.uciCmd('ucinewgame');
    this.uciCmd('isready');
    this.engineStatus.engineReady = false;
    this.engineStatus.search = null;
    this.prepareMove();
    this.announcedGameOver = false;
  }

  prepareMove(): void {
    const turn = this.game.turn;
    if (!this.game.gameOver) {
      if (turn !== this.playerColor) {
        this.uciCmd('position startpos moves' + this.getMoves());
        this.uciCmd('position startpos moves' + this.getMoves(), this.evaler);
        this.uciCmd('eval', this.evaler);

        if (this.time && this.time.wtime) {
          this.uciCmd(
            'go ' +
              (this.time.depth ? 'depth ' + this.time.depth : '') +
              ' wtime ' +
              this.time.wtime +
              ' winc ' +
              this.time.winc +
              ' btime ' +
              this.time.btime +
              ' binc ' +
              this.time.binc
          );
        } else {
          this.uciCmd(
            'go ' + (this.time.depth ? 'depth ' + this.time.depth : '')
          );
        }
        this.isEngineRunning = true;
      }
    }
  }

  getMoves(): string {
    let moves = '';
    const history = this.game.history;

    for (let i = 0; i < history.length; ++i) {
      const move = history[i];
      moves +=
        ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
  }

  engineOnMessage(event: { data: string } | string): void {
    let line;
    if (event && typeof event === 'object') {
      line = event.data;
    } else {
      line = event;
    }
    console.log('Reply: ' + line);
  }
}

export { Engine };
