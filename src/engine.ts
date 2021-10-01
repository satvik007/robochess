/**
 * Some of the code in this file is taken from the project https://github.com/nmrugg/stockfish.js/
 */

import * as path from 'path';
import type { MoveType } from './types.js';

const Stockfish = require('stockfish')(
  console,
  path.join(__dirname, '../node_modules/stockfish/src/stockfish.wasm')
);

class Engine {
  engine: any;
  // evaler: any;
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
  gameOver: boolean;
  engineMove: MoveType | null;
  isEngineRunning: boolean;
  history: MoveType[];
  turn: 'white' | 'black';

  constructor() {
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
    this.gameOver = false;
    this.isEngineRunning = false;
    this.engineMove = null;
    this.history = [];
    this.turn = 'white';
  }

  async initEngine(
    baseTime: number,
    increment: number,
    playerColor: 'white' | 'black'
  ): Promise<void> {
    this.engine = await Stockfish();
    // this.evaler = await Stockfish();
    this.reset();
    this.addListener();
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
    // this.prepareMove();
    this.gameOver = false;
  }

  prepareMove(): void {
    this.turn = this.playerColor;
    if (!this.gameOver) {
      this.uciCmd('position startpos moves' + this.getMoves());
      // this.uciCmd('position startpos moves' + this.getMoves(), this.evaler);
      // this.uciCmd('eval', this.evaler);

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

  getMoves(): string {
    let moves = '';
    const history = this.history;

    for (let i = 0; i < history.length; ++i) {
      const move = history[i];
      moves +=
        ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
  }

  displayStatus(): void {
    let status = 'Engine: ';
    if (!this.engineStatus.engineLoaded) {
      status += 'loading...';
    } else if (!this.engineStatus.engineReady) {
      status += 'loaded...';
    } else {
      status += 'ready.';
    }

    if (this.engineStatus.search) {
      status += this.engineStatus.search;
      if (this.engineStatus.score) {
        status +=
          (this.engineStatus.score.substr(0, 4) === 'Mate' ? ' ' : ' Score: ') +
          this.engineStatus.score;
      }
    }
    console.log(status);
  }

  addListener(): void {
    const that = this;
    this.engine.addMessageListener(async function (event: MessageEvent) {
      let line;
      if (event && typeof event === 'object') {
        line = event.data;
      } else {
        line = event;
      }
      console.log('Reply: ' + line);

      if (line === 'uciok') {
        that.engineStatus.engineLoaded = true;
      } else if (line === 'readyok') {
        that.engineStatus.engineReady = true;
      } else {
        let match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        // Did the AI move?
        if (match) {
          that.isEngineRunning = false;
          console.log('game move.');
          that.engineMove = {
            from: match[1],
            to: match[2],
            promotion: match[3] || '',
          };
          // that.prepareMove();
          // that.uciCmd("eval", that.evaler)
        } else if (
          (match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+)/))
        ) {
          that.engineStatus.search = 'Depth: ' + match[1] + ' Nps: ' + match[2];
        }

        // Is it sending feedback with a score?
        if ((match = line.match(/^info .*\bscore (\w+) (-?\d+)/))) {
          const score =
            parseInt(match[2], 10) * (that.turn === 'white' ? 1 : -1);
          // Is it measuring in centipawns?
          if (match[1] === 'cp') {
            that.engineStatus.score = (score / 100.0).toFixed(2);
            // Did it find a mate?
          } else if (match[1] === 'mate') {
            that.engineStatus.score = 'Mate in ' + Math.abs(score);
          }

          // Is the score bounded?
          if ((match = line.match(/\b(upper|lower)bound\b/))) {
            that.engineStatus.score =
              ((match[1] === 'upper') === (that.turn === 'white')
                ? '<= '
                : '>= ') + that.engineStatus.score;
          }
        }
      }
      that.displayStatus();
    });
  }
}

export { Engine };
