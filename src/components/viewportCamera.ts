const MAP_WIDTH_OVERSCAN = 1.04;
const FIT_EPSILON = 0.01;

export function mapFitScale(screenWidth: number, worldWidth: number): number {
  if (screenWidth <= 0 || worldWidth <= 0) return 1;
  return (MAP_WIDTH_OVERSCAN * screenWidth) / worldWidth;
}

export function scaleAfterResize(
  currentScale: number,
  previousFitScale: number,
  nextFitScale: number,
): number {
  const cameraWasAutoFit = Math.abs(currentScale - previousFitScale) <= FIT_EPSILON;
  return cameraWasAutoFit ? nextFitScale : Math.max(currentScale, nextFitScale);
}
