import type { ReactNode } from 'react';

// Stroke icons for the dashboard; they inherit the text colour.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export const BurgerIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const ChevronLeftIcon = () => (
  <Icon>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);

export const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14c1.8.7 3 2.4 3 5" />
  </Icon>
);

export const UserPlusIcon = () => (
  <Icon>
    <circle cx="11" cy="8" r="3.5" />
    <path d="M4 20c0-3.6 3.1-6 7-6 1.2 0 2.3.2 3.2.7M18 15v6M15 18h6" />
  </Icon>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </Icon>
);

export const LanguageIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </Icon>
);

export const EvolutionIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="M7 16l4-5 3 3 5-7" />
  </Icon>
);

export const PaletteIcon = () => (
  <Icon>
    <path d="M12 21a9 9 0 0 1 0-18c5 0 9 3.6 9 8 0 2.2-1.9 4-4.5 4h-2.5a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21z" />
    <circle cx="7.5" cy="10.5" r="1" />
    <circle cx="12" cy="7.5" r="1" />
    <circle cx="16.5" cy="10.5" r="1" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <path d="M5 7h1a2 2 0 0 0 2-2 1 1 0 0 1 1-1h6a1 1 0 0 1 1 1 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    <circle cx="12" cy="13" r="3" />
  </Icon>
);

export const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = () => (
  <Icon>
    <path d="M3 3l18 18M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.4 3.8-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1Z" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);

export const UploadIcon = () => (
  <Icon>
    <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />
  </Icon>
);

export const PhotoIcon = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M15 8h.01M3 16l5-5c.9-.9 2.1-.9 3 0l5 5M14 14l1-1c.9-.9 2.1-.9 3 0l3 3" />
  </Icon>
);

export const PhotoOffIcon = () => (
  <Icon>
    <path d="M15 8h.01M7 3h11a3 3 0 0 1 3 3v11M20.1 20.1A3 3 0 0 1 18 21H6a3 3 0 0 1-3-3V6c0-.8.3-1.6.9-2.2" />
    <path d="M3 16l5-5c.9-.9 2.1-.9 3 0l5 5M16.3 12.3c.6-.1 1.2.2 1.7.7l3 3M3 3l18 18" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const PinIcon = () => (
  <Icon>
    <path d="M9 4h6M10 4v5l-3 4h10l-3-4V4M12 13v7" />
  </Icon>
);
