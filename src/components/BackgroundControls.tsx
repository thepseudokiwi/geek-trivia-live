import { useState } from 'react';
import type { ThemeConfig } from '../../shared/themeDesigner';

type ImageBackground = Extract<ThemeConfig['background'], { type: 'image' }>;
type Asset = { id: string; active: boolean | number; mime_type?: string; mimeType?: string; display_name?: string; displayName?: string };
export function BackgroundControls({ draft, update, assets, refreshAssets }: {
  draft: ThemeConfig; update: (fn: (next: ThemeConfig) => void) => void;
  assets: Asset[]; refreshAssets: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const background = draft.background.type === 'image' ? draft.background : null;
  const images = assets.filter(asset => asset.active && ['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime_type ?? asset.mimeType ?? ''));
  const select = (assetId: string) => update(next => {
    next.background = assetId ? { type: 'image', fit: 'cover', position: 'center', repeat: 'no-repeat', opacity: 1, blur: 0, overlayColor: '#000000', overlayOpacity: .3, ...background, assetId } : { type: 'solid', color: next.colors.background, opacity: 1 };
  });
  const change = (values: Partial<ImageBackground>) => update(next => { if (next.background.type === 'image') Object.assign(next.background, values); });
  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG, or WebP image.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Choose an image smaller than 10 MB.'); return; }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(file);
      });
      const response = await fetch('/api/presentation/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: file.name, fileName: file.name, mimeType: file.type, assetType: 'image', base64, licensingNote: 'Operator supplied background; verify broadcast rights.' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Image upload failed.');
      await refreshAssets(); select(result.id);
    } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  };
  return <fieldset disabled={busy}><legend>Custom background image</legend>
    <p>Appears behind the full-screen board and question scenes, including contestant boards. Transparent OBS overlays stay transparent.</p>
    <label>Upload background<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label>
    {busy && <p role="status">Uploading image…</p>}{error && <p role="alert" className="error">{error}</p>}
    <label>Background image<select value={background?.assetId ?? ''} onChange={event => select(event.target.value)}><option value="">Original theme background</option>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.display_name ?? asset.displayName}</option>)}</select></label>
    {background && <>
      <label>Image fit<select value={background.fit} onChange={event => change({ fit: event.target.value as ImageBackground['fit'] })}><option value="cover">Fill screen (crop edges)</option><option value="contain">Fit whole image</option><option value="fill">Stretch to screen</option></select></label>
      <label>Image position<select value={background.position} onChange={event => change({ position: event.target.value as ImageBackground['position'] })}>{['center', 'top', 'bottom', 'left', 'right'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Dimming: {Math.round(background.overlayOpacity * 100)}%<input type="range" min="0" max="100" value={Math.round(background.overlayOpacity * 100)} onChange={event => change({ overlayOpacity: Number(event.target.value) / 100, overlayColor: '#000000' })}/></label>
      <button type="button" onClick={() => select('')}>Remove background image</button>
    </>}
    <p>PNG, JPEG, or WebP, up to 10 MB. Publish to apply your changes live. Glass panels let the image show through.</p>
  </fieldset>;
}
