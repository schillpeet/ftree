export type PostTier = 'high' | 'medium';

// localStorage key of the post-effects switch in the view lab.
export const POST_KEY = 'ftree.post';

// Touch devices start without ambient occlusion and multisampling; the rest start with everything.
export const startTier = (coarsePointer: boolean): PostTier => (coarsePointer ? 'medium' : 'high');
