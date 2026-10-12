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

export const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
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
