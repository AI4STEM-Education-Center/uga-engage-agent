/**
 * Layout dispatch — picks archetype-specific layout function.
 */

import type { Archetype, SceneDescriptionV2 } from "../schema";
import { layoutCollision } from "./collision";
import { layoutFreeBody } from "./free-body";
import { layoutGenericScene } from "./generic-scene";
import type { LayoutV2 } from "./helpers";

export type { LayoutV2, PlacedLabel, PlacedSymbol } from "./helpers";

const DISPATCH: Record<Archetype, (s: SceneDescriptionV2) => LayoutV2> = {
  collision: layoutCollision,
  "free-body": layoutFreeBody,
  "generic-scene": layoutGenericScene,
};

export const computeLayoutV2 = (scene: SceneDescriptionV2): LayoutV2 => {
  const fn = DISPATCH[scene.scene.archetype];
  if (!fn) {
    throw new Error(`No layout for archetype: ${scene.scene.archetype}`);
  }
  return fn(scene);
};
