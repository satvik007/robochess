import type { BoundingBox, ElementHandle, Page } from 'puppeteer';
import * as _ from 'lodash';
import type { MoveType, InitArgs, PieceInfo, BoardInfo } from './types.js';

class Game {
  turn: 'white' | 'black';
  gameOver: boolean;
  history: MoveType[];
  playerColor: 'white' | 'black';
  page: Page;
  baseTime: number; // seconds
  increment: number; // seconds
  gameMove: MoveType | null;
  lastBoard: BoardInfo;

  constructor(page: Page, baseTime: number, increment: number) {
    this.turn = 'white';
    this.playerColor = 'white';
    this.gameOver = false;
    this.history = [];
    this.page = page;
    this.baseTime = baseTime;
    this.increment = increment;
    this.gameMove = null;
    this.lastBoard = INIT_BOARD_CONFIG as BoardInfo;
  }

  async initArgs(): Promise<InitArgs> {
    await this.page.waitForSelector('cg-container');
    let boardInfo;
    while (!boardInfo) {
      try {
        boardInfo = await this.page.evaluate(this.getBoardInfo);
      } catch (error) {

      }
    }
    this.playerColor = boardInfo.playerColor;

    return {
      baseTime: this.baseTime,
      increment: this.increment,
      playerColor: this.playerColor,
    };
  }

  async getBoardInfo(): Promise<BoardInfo> {
    const result: BoardInfo = {
      pieces: [],
      times: { wtimeSec: 0, btimeSec: 0 },
      playerColor: 'white',
    };

    function getTime(selector: string) {
      const clock = document.querySelectorAll(selector);
      let totalTime = 0;
      if (clock?.length) {
        const clockValue = (clock[0] as HTMLElement).innerText.replace(
          /\s/g,
          ''
        );
        const timeArr = /((\d+):)?(\d+):(\d+)/.exec(clockValue);
        if (timeArr?.length === 5) {
          totalTime +=
            Number.parseInt(timeArr[2] ? timeArr[2] : '0', 10) * 60 * 60;
          totalTime += Number.parseInt(timeArr[3], 10) * 60;
          totalTime += Number.parseInt(timeArr[4], 10);
        }
      } else {
        return Infinity;
      }
      return totalTime;
    }

    const opponentTime = getTime('div.rclock.rclock-top');
    const ourTime = getTime('div.rclock.rclock-bottom');

    const container = document.querySelectorAll(
      'cg-container'
    )[0] as HTMLElement;
    const { width, height } = container.style;
    const widthF = Number.parseFloat(width);
    const heightF = Number.parseFloat(height);
    const board = container.children[0];
    const boardPieces: Array<{ value: string; xF: number; yF: number }> = [];

    for (const element of board.children) {
      const cssText = (element as HTMLElement).style.cssText;
      const [, x, y] = /\(([\d.]+)px, ([\d.]+)px\)/.exec(
        cssText
      ) as RegExpExecArray;
      let xF = Number.parseFloat(x);
      let yF = Number.parseFloat(y);
      xF = Math.round((xF / widthF) * 8);
      yF = 8 - Math.round((yF / heightF) * 8);

      if (element.nodeName === 'PIECE') {
        if (element.className.includes('anim')) {
          throw new Error("animation found.");
        }
        boardPieces.push({
          value: element.className.split(' ').slice(0, 2).join(' '),
          xF,
          yF,
        });
      }
    }

    const whitePiece = boardPieces.find((piece) =>
      piece.value.includes('white')
    ) as { value: string; xF: number; yF: number };

    if (whitePiece.yF <= 2) {
      result.times = {
        wtimeSec: ourTime,
        btimeSec: opponentTime,
      };
      result.playerColor = 'white';
    } else {
      result.times = {
        wtimeSec: opponentTime,
        btimeSec: ourTime,
      };
      result.playerColor = 'black';
      for (const piece of boardPieces) {
        piece.yF = 9 - piece.yF;
        piece.xF = 7 - piece.xF;
      }
    }

    for (const piece of boardPieces) {
      const { value, xF, yF } = piece;
      const position =
        String.fromCharCode('a'.charCodeAt(0) + xF) + yF.toString();
      result.pieces.push({
        value,
        position,
      });
    }

    console.log(result);
    return result;
  }

  // TODO: Promotion.
  async move(engineMove: MoveType): Promise<void> {
    const { from, to, promotion } = engineMove;
    this.gameMove = null;

    if (this.turn === 'white') {
      this.turn = 'black';
    } else {
      this.turn = 'white';
    }

    let x1, y1, x2, y2;
    if (this.playerColor === 'white') {
      x1 = from.charCodeAt(0) - 'a'.charCodeAt(0);
      y1 = 7 - (from.charCodeAt(1) - '1'.charCodeAt(0));
      x2 = to.charCodeAt(0) - 'a'.charCodeAt(0);
      y2 = 7 - (to.charCodeAt(1) - '1'.charCodeAt(0));
    } else {
      x1 = 7 - (from.charCodeAt(0) - 'a'.charCodeAt(0));
      y1 = from.charCodeAt(1) - '1'.charCodeAt(0);
      x2 = 7 - (to.charCodeAt(0) - 'a'.charCodeAt(0));
      y2 = to.charCodeAt(1) - '1'.charCodeAt(0);
    }

    const containerHandle = (await this.page.$(
      'cg-container'
    )) as ElementHandle;
    const { x, y, width, height } =
      (await containerHandle.boundingBox()) as BoundingBox;
    const sqWidth = width / 8;
    const sqHeight = height / 8;

    await this.page.mouse.click(
      x + sqWidth * x1 + sqWidth / 2,
      y + sqHeight * y1 + sqHeight / 2
    );
    await this.page.mouse.click(
      x + sqWidth * x2 + sqWidth / 2,
      y + sqHeight * y2 + sqHeight / 2
    );

    const movedPiece = this.lastBoard.pieces.find(piece => piece.position === from);
    this.lastBoard.pieces = this.lastBoard.pieces.filter(piece => piece.position !== to);
    (movedPiece as PieceInfo).position = to;

  }

  async getGameMove(): Promise<void> {
    const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
    let boardInfo: BoardInfo | null = null;
    while (!boardInfo) {
      try {
        boardInfo = await this.page.evaluate(this.getBoardInfo);
      } catch (error) {

      }
    }

    const movedPiece = boardInfo.pieces.find(
      (piece) =>
        !this.lastBoard.pieces.some((lastPiece) => _.isEqual(piece, lastPiece)) &&
        piece.value.split(' ')[0] === opponentColor
    );
    if (!movedPiece) {
      return;
    }

    const lastPiece = this.lastBoard.pieces.find(
      (lastPiece) =>
        !(boardInfo as BoardInfo).pieces.some((piece) => _.isEqual(piece, lastPiece)) &&
        movedPiece.value.split(' ')[0] === lastPiece.value.split(' ')[0]
    ) as PieceInfo;

    let promotion;
    if (movedPiece.value.split(' ')[1] !== lastPiece.value.split(' ')[1]) {
      promotion = 'q';
    } else {
      promotion = '';
    }
    const currentMove = {
      from: lastPiece.position,
      to: movedPiece.position,
      promotion: promotion,
    };
    if (
      this.history.length > 0 &&
      _.isEqual(this.history[this.history.length - 1], currentMove)
    ) {
      return;
    }

    this.gameMove = currentMove;
    this.lastBoard = boardInfo;
  }
}

const INIT_BOARD_CONFIG = {
  pieces: [
    {
      value: 'black rook',
      position: 'a8',
    },
    {
      value: 'black knight',
      position: 'b8',
    },
    {
      value: 'black bishop',
      position: 'c8',
    },
    {
      value: 'black queen',
      position: 'd8',
    },
    {
      value: 'black king',
      position: 'e8',
    },
    {
      value: 'black bishop',
      position: 'f8',
    },
    {
      value: 'black knight',
      position: 'g8',
    },
    {
      value: 'black rook',
      position: 'h8',
    },
    {
      value: 'black pawn',
      position: 'a7',
    },
    {
      value: 'black pawn',
      position: 'b7',
    },
    {
      value: 'black pawn',
      position: 'c7',
    },
    {
      value: 'black pawn',
      position: 'd7',
    },
    {
      value: 'black pawn',
      position: 'e7',
    },
    {
      value: 'black pawn',
      position: 'f7',
    },
    {
      value: 'black pawn',
      position: 'g7',
    },
    {
      value: 'black pawn',
      position: 'h7',
    },
    {
      value: 'white pawn',
      position: 'a2',
    },
    {
      value: 'white pawn',
      position: 'b2',
    },
    {
      value: 'white pawn',
      position: 'c2',
    },
    {
      value: 'white pawn',
      position: 'd2',
    },
    {
      value: 'white pawn',
      position: 'e2',
    },
    {
      value: 'white pawn',
      position: 'f2',
    },
    {
      value: 'white pawn',
      position: 'g2',
    },
    {
      value: 'white pawn',
      position: 'h2',
    },
    {
      value: 'white rook',
      position: 'a1',
    },
    {
      value: 'white knight',
      position: 'b1',
    },
    {
      value: 'white bishop',
      position: 'c1',
    },
    {
      value: 'white queen',
      position: 'd1',
    },
    {
      value: 'white king',
      position: 'e1',
    },
    {
      value: 'white bishop',
      position: 'f1',
    },
    {
      value: 'white knight',
      position: 'g1',
    },
    {
      value: 'white rook',
      position: 'h1',
    },
  ],
  times: {
    wtimeSec: 0,
    btimeSec: 0,
  },
  playerColor: 'white',
};

export { Game };
