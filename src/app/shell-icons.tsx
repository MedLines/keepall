type IconProps = { className?: string };

function iconClass(defaultSize: string, className?: string): string {
  return className ? `${defaultSize} shrink-0 ${className}` : `${defaultSize} shrink-0`;
}

export function LogoIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M6 14V8M10 14V5M14 14V10" />
    </svg>
  );
}

export function LibraryIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CollectionIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5h5.172a1.5 1.5 0 0 1 1.06.439l1.318 1.318A1.5 1.5 0 0 0 14.05 7.5H14.5A1.5 1.5 0 0 1 16 9v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M8.5 11.5 11.5 8.5M9.5 7.5l1-1a2.121 2.121 0 1 1 3 3l-1 1M10.5 12.5l-1 1a2.121 2.121 0 1 1-3-3l1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 4.5h8A1.5 1.5 0 0 1 15.5 6v9.5L12 14H6A1.5 1.5 0 0 1 4.5 12.5v-8A1.5 1.5 0 0 1 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="1" fill="currentColor" />
      <path d="m7 13 2.5-2.5L12 13l2-2 2 3H6l1-1Z" fill="currentColor" />
    </svg>
  );
}

export function BackupIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 4v8m0 0 2.5-2.5M10 12 7.5 9.5M5.5 14.5v1A1.5 1.5 0 0 0 7 17h6a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SidebarChevronIcon({
  className,
  expanded,
}: IconProps & { expanded: boolean }) {
  return (
    <svg
      className={iconClass("size-5", className)}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      {expanded ? (
        <>
          <path
            d="M8 5v10M5.5 7.5 8 5l2.5 2.5M5.5 12.5 8 15l2.5-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <path
          d="M7 5v10M9.5 7.5 7 5 4.5 7.5M9.5 12.5 7 15l2.5-2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function PanelIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="4" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="4" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 6h10M5 10h10M5 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 8.5 10 12.5 14 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SortDescIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 6h10M7 10h6M9.5 14h1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SortAscIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M9.5 6h1M7 10h6M5 14h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3.5 11.5 5.2 5.8A1.5 1.5 0 0 1 6.64 4.5h6.72a1.5 1.5 0 0 1 1.44 1.3l1.7 5.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 11.5h3.2l.8 2h4.8l.8-2h3.2v3A1.5 1.5 0 0 1 15.3 16H4.7A1.5 1.5 0 0 1 3.2 14.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HashIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7.5 4.5 6 15.5M14 4.5 12.5 15.5M4.5 8h12M3.5 12h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg className={iconClass("size-4", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="5" r="1.25" fill="currentColor" />
      <circle cx="10" cy="10" r="1.25" fill="currentColor" />
      <circle cx="10" cy="15" r="1.25" fill="currentColor" />
    </svg>
  );
}
