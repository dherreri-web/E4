import type Phaser from "phaser";

const FADE_MS = 450;
const FADE_RGB = [4, 2, 12] as const;

/** A scene that hands off to another scene, at most once per fade. */
export interface FadingScene extends Phaser.Scene {
  leaving: boolean;
}

/**
 * Fades the camera to the same near-black every scene uses, then starts the
 * next scene. A second request during the fade is ignored.
 */
export function fadeTo(
  scene: FadingScene,
  key: string,
  data?: object,
): void {
  if (scene.leaving) return;
  scene.leaving = true;
  scene.cameras.main.fadeOut(FADE_MS, ...FADE_RGB);
  scene.cameras.main.once("camerafadeoutcomplete", () => {
    scene.scene.start(key, data);
  });
}
