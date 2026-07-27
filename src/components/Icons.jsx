// Hand-rolled inline SVGs: no icon library was chosen for this project, so the
// handful of glyphs the UI needs live here.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

function Icon({ children, className = 'h-4 w-4', ...rest }) {
  return (
    <svg className={className} aria-hidden="true" {...base} {...rest}>
      {children}
    </svg>
  );
}

export const InboxIcon = (props) => (
  <Icon {...props}>
    <path d="M4 13h4l2 3h4l2-3h4" />
    <path d="M4 13 6.5 5h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z" />
  </Icon>
);

export const SentIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12 20 4l-8 16-2-6-6-2Z" />
  </Icon>
);

export const DraftIcon = (props) => (
  <Icon {...props}>
    <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-4-4Z" />
    <path d="M14 4v4h5" />
  </Icon>
);

export const PencilIcon = (props) => (
  <Icon {...props}>
    <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
  </Icon>
);

export const RefreshIcon = (props) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 1 0-2.5 5.8" />
    <path d="M20 4v7h-7" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);

export const ReplyIcon = (props) => (
  <Icon {...props}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h9a6 6 0 0 1 6 6v1" />
  </Icon>
);

export const ForwardIcon = (props) => (
  <Icon {...props}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12h-9a6 6 0 0 0-6 6v1" />
  </Icon>
);

export const AttachmentIcon = (props) => (
  <Icon {...props}>
    <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.19 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Icon>
);

export const LogoutIcon = (props) => (
  <Icon {...props}>
    <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
    <path d="M10 12h10m0 0-3-3m3 3-3 3" />
  </Icon>
);

export const BackIcon = (props) => (
  <Icon {...props}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const MenuIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const MailOpenIcon = (props) => (
  <Icon {...props}>
    <path d="M4 10 12 4l8 6v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" />
    <path d="m4 10 8 6 8-6" />
  </Icon>
);

// --- editor toolbar glyphs ---

export const BulletListIcon = (props) => (
  <Icon {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const OrderedListIcon = (props) => (
  <Icon {...props}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5.5 5.2 5v3.2M3.8 11.2h1.8L3.8 13.4h1.9M3.8 16.4h1.7v1.2H4.1v1.1h1.4" strokeWidth="1.3" />
  </Icon>
);

export const QuoteIcon = (props) => (
  <Icon {...props}>
    <path d="M9 7c-2.2 0-3.5 1.5-3.5 3.4 0 1.5 1 2.6 2.4 2.6 1.2 0 2-.8 2-1.9 0-1-.7-1.7-1.6-1.7-.2 0-.4 0-.5.1.2-.7.8-1.2 1.7-1.3V7Z" />
    <path d="M17 7c-2.2 0-3.5 1.5-3.5 3.4 0 1.5 1 2.6 2.4 2.6 1.2 0 2-.8 2-1.9 0-1-.7-1.7-1.6-1.7-.2 0-.4 0-.5.1.2-.7.8-1.2 1.7-1.3V7Z" />
    <path d="M5 17h14" />
  </Icon>
);

export const LinkIcon = (props) => (
  <Icon {...props}>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </Icon>
);

export const RuleIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12h16" />
    <path d="M7 7h10M7 17h10" strokeDasharray="2 3" opacity="0.45" />
  </Icon>
);

export const ClearFormatIcon = (props) => (
  <Icon {...props}>
    <path d="M7 6h11M11 6l-2.5 9" />
    <path d="M14 14l5 5m0-5-5 5" />
  </Icon>
);

export const CodeIcon = (props) => (
  <Icon {...props}>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </Icon>
);
