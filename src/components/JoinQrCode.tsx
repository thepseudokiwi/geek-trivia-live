import { useMemo, type ReactElement } from 'react';
import { qrcodegen } from '../vendor/qrcodegen';

export function JoinQrCode({ value, size = 180 }: { value: string; size?: number }) {
  const qr = useMemo(() => qrcodegen.QrCode.encodeText(value, qrcodegen.QrCode.Ecc.MEDIUM), [value]);
  const margin = 4;
  const cells: ReactElement[] = [];
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) cells.push(<rect key={`${x}-${y}`} x={x + margin} y={y + margin} width="1" height="1" />);
  return <svg className="join-qr" role="img" aria-label="Contestant join QR code" width={size} height={size} viewBox={`0 0 ${qr.size + margin * 2} ${qr.size + margin * 2}`} shapeRendering="crispEdges">
    <rect width="100%" height="100%" fill="#fff" />
    <g fill="#111827">{cells}</g>
  </svg>;
}
