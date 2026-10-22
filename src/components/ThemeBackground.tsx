import type { ThemeConfig } from '../../shared/themeDesigner';
import type { PresentationLayout, PresentationScene } from '../../shared/types';
import './themeBackground.css';

export function ThemeBackground({ config, scene, layout }: { config?: ThemeConfig; scene: PresentationScene; layout: PresentationLayout }) {
  const sceneSettings = config?.scenes[scene];
  const background = sceneSettings && !sceneSettings.inherit && sceneSettings.background ? sceneSettings.background : config?.background;
  if (layout !== 'full' || background?.type !== 'image' || !background.assetId) return null;
  return <div className="custom-theme-background" aria-hidden="true">
    <img src={`/api/presentation/assets/${encodeURIComponent(background.assetId)}`} alt="" style={{ objectFit: background.fit, objectPosition: background.position, opacity: background.opacity, filter: background.blur ? `blur(${background.blur}px)` : undefined }}/>
    <div style={{ position: 'absolute', inset: 0, backgroundColor: background.overlayColor, opacity: background.overlayOpacity }}/>
  </div>;
}
