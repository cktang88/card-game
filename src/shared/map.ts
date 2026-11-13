import { Pos, allHexes, key, mirror } from './hex';

export type Terrain = 'open' | 'ruins' | 'crater' | 'relay';

export interface TileDef { elev: number; terrain: Terrain }

/** "Ashfall Ridge": the prototype map. Defined for the top half; the bottom
 *  half is a point-mirror so both sides are identical. Row 3 is the centre
 *  row and must be self-symmetric. */
const HALF: Record<string, TileDef> = {
  // row 0 (6 wide) - player 1 home edge
  '2,0': { elev: 1, terrain: 'open' }, '3,0': { elev: 1, terrain: 'open' },
  // row 1 (7 wide)
  '3,1': { elev: 1, terrain: 'open' }, '0,1': { elev: 0, terrain: 'ruins' },
  // row 2 (6 wide)
  '0,2': { elev: 1, terrain: 'open' }, '5,2': { elev: 2, terrain: 'open' },
  '2,2': { elev: 0, terrain: 'ruins' }, '4,2': { elev: 0, terrain: 'open' },
  // row 3 (7 wide) - centre: relays at 1, 3, 5; craters at 2 and 4
  '1,3': { elev: 1, terrain: 'relay' }, '3,3': { elev: 0, terrain: 'relay' }, '5,3': { elev: 1, terrain: 'relay' },
  '2,3': { elev: 0, terrain: 'crater' }, '4,3': { elev: 0, terrain: 'crater' },
};

export function buildMap(): Map<string, TileDef> {
  const m = new Map<string, TileDef>();
  for (const p of allHexes()) m.set(key(p), { elev: 0, terrain: 'open' });
  for (const [k, v] of Object.entries(HALF)) {
    const [col, row] = k.split(',').map(Number);
    const p: Pos = { col, row };
    m.set(key(p), v);
    m.set(key(mirror(p)), v);
  }
  return m;
}
