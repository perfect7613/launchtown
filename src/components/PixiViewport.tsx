// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent, useApp } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';
import { mapFitScale, scaleAfterResize } from './viewportCamera';

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
};

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children, viewportRef, ...viewportProps } = props;
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    });
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    const fitScale = mapFitScale(props.screenWidth, props.worldWidth);
    // Activate plugins and frame the full map width. Textures use nearest-neighbor
    // sampling, so the slight overscan avoids edge seams without softening pixels.
    viewport
      .drag()
      .pinch({})
      .wheel()
      .decelerate()
      .clamp({ direction: 'all', underflow: 'center' })
      .clampZoom({
        minScale: fitScale,
        maxScale: 3.0,
      })
      .setZoom(fitScale)
      .moveCenter(props.worldWidth / 2, props.worldHeight / 2);
    return viewport;
  },
  applyProps(viewport, oldProps: any, newProps: any) {
    const dimensionsChanged =
      oldProps.screenWidth !== newProps.screenWidth ||
      oldProps.screenHeight !== newProps.screenHeight ||
      oldProps.worldWidth !== newProps.worldWidth ||
      oldProps.worldHeight !== newProps.worldHeight;

    if (dimensionsChanged) {
      const previousCenter = viewport.center;
      const previousFitScale = mapFitScale(oldProps.screenWidth, oldProps.worldWidth);
      const nextFitScale = mapFitScale(newProps.screenWidth, newProps.worldWidth);
      const nextScale = scaleAfterResize(viewport.scale.x, previousFitScale, nextFitScale);
      const cameraWasAutoFit = Math.abs(viewport.scale.x - previousFitScale) <= 0.01;

      viewport.resize(
        newProps.screenWidth,
        newProps.screenHeight,
        newProps.worldWidth,
        newProps.worldHeight,
      );
      viewport.clampZoom({ minScale: nextFitScale, maxScale: 3.0 });
      viewport.setZoom(nextScale);
      viewport.moveCenter(
        cameraWasAutoFit
          ? { x: newProps.worldWidth / 2, y: newProps.worldHeight / 2 }
          : previousCenter,
      );
    }

    Object.keys(newProps).forEach((p) => {
      if (
        p !== 'app' &&
        p !== 'viewportRef' &&
        p !== 'children' &&
        p !== 'screenWidth' &&
        p !== 'screenHeight' &&
        p !== 'worldWidth' &&
        p !== 'worldHeight' &&
        oldProps[p] !== newProps[p]
      ) {
        // @ts-expect-error Ignoring TypeScript here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        viewport[p] = newProps[p];
      }
    });
  },
});
