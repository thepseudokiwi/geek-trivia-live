import type { ThemeConfig } from '../../shared/themeDesigner';
import { glassPresets, type GlassOptions } from '../../shared/themeGlass';

export function GlassControls({ draft, update }: { draft: ThemeConfig; update: (fn: (next: ThemeConfig) => void) => void }) {
  const glass = draft.glass ?? glassPresets.off;
  const change = (values: Partial<GlassOptions>) => update(next => { next.glass = { ...glass, ...values }; });
  return <fieldset><legend>Glass appearance</legend>
    <p>Translucent panels for the board, questions, scores, and D20 tray. Saved separately for each theme.</p>
    <label>Glass style<select aria-label="Glass style" value={glass.style} onChange={event => change(glassPresets[event.target.value as GlassOptions['style']])}>
      <option value="off">Off — original theme</option><option value="frosted">Frosted glass</option><option value="clear">Clear glass</option><option value="smoked">Smoked glass</option>
    </select></label>
    <label>Background blur: {glass.blur}px<input aria-label="Glass background blur" type="range" min="0" max="40" value={glass.blur} disabled={glass.style === 'off'} onChange={event => change({ blur: Number(event.target.value) })}/></label>
    <label>Panel opacity: {glass.opacity}%<input aria-label="Glass panel opacity" type="range" min="20" max="95" value={glass.opacity} disabled={glass.style === 'off'} onChange={event => change({ opacity: Number(event.target.value) })}/></label>
    <p>Higher opacity improves readability. Publish to apply this look to the live display and contestant boards.</p>
  </fieldset>;
}
