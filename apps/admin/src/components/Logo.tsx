/* eslint-disable @next/next/no-img-element -- static brand asset, exact file */
/** Official Arena Fit logo, unchanged (1080×639, contain). */
export function Logo({ height = 32 }: { height?: number }) {
  return <img src="/brand/arena-fit-logo.png" alt="Arena Fit" height={height} width={Math.round((height * 1080) / 639)} style={{ objectFit: 'contain' }} />;
}
