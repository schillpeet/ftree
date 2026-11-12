import { useEffect, type RefObject } from 'react';

// A press outside a burger menu (or an Escape) closes it; the tree's (`Dashboard.tsx`) and the landing page's
// (`home/HomeMenu.tsx`) share this.
export function useMenuDismiss(menuRef: RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuRef, isOpen, onClose]);
}
