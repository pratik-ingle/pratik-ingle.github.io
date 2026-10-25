// Preset arrangements for the grasp-free manipulation demo (src/scripts/surface-scene.ts).
// Kept apart from the scene so the page can list them at build time.
export const PRESETS = ['line up', 'spread out', 'gather', 'swap'] as const;
export type Preset = (typeof PRESETS)[number];
