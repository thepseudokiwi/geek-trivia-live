export const d20ThemeIds = ['neon_arcane','classic_polyhedral','holographic_scifi','ember','violet','mint','ocean','ruby','gold','ice','rose','graphite','ivory'] as const;
export type D20ThemeId = typeof d20ThemeIds[number];
export interface D20Palette { name: string; surface: string; numbers: string; glow: string }
export const d20Palettes: Record<D20ThemeId, D20Palette> = {
  neon_arcane: { name: 'Neon Arcane', surface: '#4c1d95', numbers: '#fff7c2', glow: '#d8b4fe' },
  classic_polyhedral: { name: 'Classic Polyhedral', surface: '#6b451f', numbers: '#fff4d6', glow: '#fff2b0' },
  holographic_scifi: { name: 'Holographic Sci-Fi', surface: '#063b52', numbers: '#e6feff', glow: '#b7eeff' },
  ember: { name: 'Ember orange', surface: '#d65b30', numbers: '#fff1ce', glow: '#b7eeff' },
  violet: { name: 'Cosmic violet', surface: '#7054bb', numbers: '#fff1ce', glow: '#b7eeff' },
  mint: { name: 'Ion mint', surface: '#3f947b', numbers: '#fff1ce', glow: '#b7eeff' },
  ocean: { name: 'Ocean blue', surface: '#195aaf', numbers: '#fff1ce', glow: '#b7eeff' },
  ruby: { name: 'Ruby red', surface: '#a91e42', numbers: '#fff1ce', glow: '#b7eeff' },
  gold: { name: 'Solar gold', surface: '#d7a62b', numbers: '#30200b', glow: '#c6edff' },
  ice: { name: 'Glacier', surface: '#a7dce7', numbers: '#173b50', glow: '#b0a6ff' },
  rose: { name: 'Nebula pink', surface: '#bd4e93', numbers: '#fff1ce', glow: '#b7eeff' },
  graphite: { name: 'Graphite', surface: '#242a32', numbers: '#fff1ce', glow: '#b7eeff' },
  ivory: { name: 'Ivory', surface: '#e6dcc3', numbers: '#363125', glow: '#9db8ff' },
};
export function d20Palette(theme: string): D20Palette {
  return Object.prototype.hasOwnProperty.call(d20Palettes, theme) ? d20Palettes[theme as D20ThemeId] : d20Palettes.neon_arcane;
}
