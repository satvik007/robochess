import type { Page } from 'puppeteer';

interface MoveType {
  from: string;
  to: string;
  promotion: string;
}

interface InitArgs {
  baseTime: number;
  increment: number;
  playerColor: 'white' | 'black';
}

interface PieceInfo {
  value: string;
  position: string;
}

interface BoardInfo {
  pieces: PieceInfo[];
  lastMoves: string[];
}

class Game {
  turn: 'white' | 'black';
  gameOver: boolean;
  history: MoveType[];
  playerColor: 'white' | 'black';
  page: Page;
  baseTime: number;
  increment: number;

  constructor(page: Page, baseTime: number, increment: number) {
    this.turn = 'white';
    this.playerColor = 'white';
    this.gameOver = false;
    this.history = [];
    this.page = page;
    this.baseTime = baseTime;
    this.increment = increment;
  }

  async initArgs(): Promise<InitArgs> {
    const boardInfo = await this.page.evaluate(this.getBoardInfo);
    const whitePiece = boardInfo.pieces.find((piece) =>
      piece.value.includes('white')
    ) as PieceInfo;
    if (
      whitePiece.position.includes('1') ||
      whitePiece.position.includes('2')
    ) {
      this.playerColor = 'white';
      this.turn = 'white';
    } else {
      this.playerColor = 'black';
      this.turn = 'black';
    }

    return {
      baseTime: this.baseTime,
      increment: this.increment,
      playerColor: this.playerColor,
    };
  }

  async getBoardInfo(): Promise<BoardInfo> {
    const result: BoardInfo = { pieces: [], lastMoves: [] };

    const container = $('cg-container')[0];
    const { width, height } = container.style;
    const widthF = Number.parseFloat(width);
    const heightF = Number.parseFloat(height);
    const board = container.children[0];

    for (const element of board.children) {
      const cssText = (element as HTMLElement).style.cssText;
      const [, x, y] = /\((\d+)px, (\d+)px\)/.exec(cssText) as RegExpExecArray;
      let xF = Number.parseFloat(x);
      let yF = Number.parseFloat(y);
      xF = Math.round((xF / widthF) * 8);
      yF = 8 - Math.round((yF / heightF) * 8);
      const position = String.fromCharCode('a'.charCodeAt(0) + xF) + yF;

      if (element.nodeName === 'PIECE') {
        result.pieces.push({
          value: element.classList.value,
          position: position,
        });
      } else {
        result.lastMoves.push(position);
      }
    }

    if (result.pieces.find((piece) => piece.position === result.lastMoves[0])) {
      result.lastMoves = [result.lastMoves[1], result.lastMoves[0]];
    }

    return result;
  }
}

export { Game };
