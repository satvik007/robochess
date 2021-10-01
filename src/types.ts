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
  times: {
    wtimeSec: number;
    btimeSec: number;
  };
  playerColor: 'white' | 'black';
}

export { MoveType, InitArgs, PieceInfo, BoardInfo };
