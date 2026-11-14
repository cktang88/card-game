import type { Faction } from './cards';
import type { Action, GameEvent, GameState, PlayerId } from './engine';

export type ClientMsg =
  | { t: 'create'; faction: Faction }
  | { t: 'join'; code: string; faction: Faction }
  | { t: 'action'; action: Action };

export type ServerMsg =
  | { t: 'room'; code: string; seat: PlayerId }
  | { t: 'start'; seat: PlayerId }
  | { t: 'state'; state: GameState; events: GameEvent[] }
  | { t: 'error'; msg: string }
  | { t: 'opponentLeft' };

/** Largest client message the server accepts (bytes). Real messages are well under 1 KB. */
export const MAX_CLIENT_BYTES = 4096;
