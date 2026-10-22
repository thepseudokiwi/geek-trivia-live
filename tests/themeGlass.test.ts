import { describe, expect, it } from 'vitest';
import { defaultThemeConfig, themeConfigSchema } from '../shared/themeDesigner.js';
import { glassPresets, glassSchema, glassVariables } from '../shared/themeGlass.js';

describe('theme glass options', () => {
  it('keeps existing themes unchanged when glass was not configured', () => {
    const { glass: _glass, ...legacy } = defaultThemeConfig('Legacy');
    expect(themeConfigSchema.parse(legacy).glass.style).toBe('off');
    expect(glassVariables()).toEqual({});
  });
  it.each(['frosted', 'clear', 'smoked'] as const)('preserves %s glass through theme serialization', style => {
    const config = defaultThemeConfig('Glass');
    config.glass = { ...glassPresets[style], blur: 18, opacity: 72 };
    const restored = themeConfigSchema.parse(JSON.parse(JSON.stringify(config)));
    expect(restored.glass).toEqual(config.glass);
    expect(glassVariables(restored.glass)['--glass-blur']).toBe('18px');
    expect(glassVariables(restored.glass)['--glass-opacity']).toBe('72%');
  });
  it('rejects unsafe or out-of-range styles', () => {
    expect(glassSchema.safeParse({ style: 'url(x)' }).success).toBe(false);
    expect(glassSchema.safeParse({ blur: 41 }).success).toBe(false);
    expect(glassSchema.safeParse({ opacity: 0 }).success).toBe(false);
  });
});
