import { z } from 'zod';

export const glassSchema = z.object({
  style: z.enum(['off', 'frosted', 'clear', 'smoked']).default('off'),
  blur: z.number().min(0).max(40).default(16),
  opacity: z.number().min(20).max(95).default(65),
});
export type GlassOptions = z.infer<typeof glassSchema>;
export const glassPresets: Record<GlassOptions['style'], GlassOptions> = {
  off: { style: 'off', blur: 16, opacity: 65 },
  frosted: { style: 'frosted', blur: 20, opacity: 65 },
  clear: { style: 'clear', blur: 8, opacity: 35 },
  smoked: { style: 'smoked', blur: 24, opacity: 85 },
};
export function glassVariables(options?: GlassOptions): Record<string, string> {
  const glass = options ?? glassPresets.off;
  if (glass.style === 'off') return {};
  return {
    '--glass-blur': `${glass.blur}px`,
    '--glass-opacity': `${glass.opacity}%`,
    '--glass-tint': glass.style === 'smoked' ? '#080d18' : 'var(--surface)',
  };
}
