// Filter vocabularies, in the order the chips appear on the page.
export const PROJECT_TYPES = ['Research', 'Build', 'Product'] as const;
export const PROJECT_TRACKS = ['Robotics', 'ML', 'LLMs', 'Quant', 'Tools'] as const;
export const POST_TOPICS = ['Robotics', 'Machine learning', 'AI and tools', 'Tutorials'] as const;

// Research reads as solid ink, the product as solid accent, side builds as an accent outline.
export const TYPE_TAG: Record<(typeof PROJECT_TYPES)[number], string> = {
  Research: 'tag--ink',
  Build: 'tag--outline-accent',
  Product: 'tag--accent',
};
