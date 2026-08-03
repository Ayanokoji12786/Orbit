export const duration = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const spring = {
  snappy: { damping: 20, stiffness: 300, mass: 0.6 },
  gentle: { damping: 18, stiffness: 180, mass: 0.8 },
  bouncy: { damping: 12, stiffness: 220, mass: 0.7 },
} as const;
