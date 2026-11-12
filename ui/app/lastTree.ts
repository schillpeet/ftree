// The slug of the tree last open in this browser, which `/start` opens again while it is still visible; the landing
// page's families board sets it too, so "Go to the tree" opens the family chosen there.
export const LAST_TREE_KEY = 'ftree.lastTree';

export function lastTree(): string | null {
  try {
    return localStorage.getItem(LAST_TREE_KEY);
  } catch {
    return null;
  }
}

export function rememberTree(slug: string) {
  try {
    localStorage.setItem(LAST_TREE_KEY, slug);
  } catch {
    // Without storage `/start` opens the default tree.
  }
}
