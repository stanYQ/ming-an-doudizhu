export interface DealResult {
  hands: number[][];
  bottom: number[];
  faceUpCard: number;
}

// mulberry32: deterministic PRNG for seeded shuffle
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export class Deck {
  static shuffle(seed?: number): number[] {
    const deck = Array.from({ length: 108 }, (_, i) => i);
    const rand = seed !== undefined ? mulberry32(seed) : () => Math.random();
    for (let i = 107; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  static deal(deck: number[]): DealResult {
    const hands: number[][] = [[], [], [], [], []];
    for (let i = 0; i < 105; i++) hands[i % 5].push(deck[i]);
    hands.forEach(h => h.sort((a, b) => a - b));

    const bottom = deck.slice(105);
    const faceUpIdx = Math.floor(Math.random() * 105);
    const faceUpCard = deck[faceUpIdx];

    return { hands, bottom, faceUpCard };
  }

  static findLandlordSeat(hands: number[][], faceUpCard: number): number {
    const idx = hands.findIndex(h => h.includes(faceUpCard));
    return idx === -1 ? 0 : idx;
  }
}
