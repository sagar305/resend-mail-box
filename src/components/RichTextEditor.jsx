import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import {
  BulletListIcon,
  ClearFormatIcon,
  CodeIcon,
  LinkIcon,
  OrderedListIcon,
  QuoteIcon,
  RuleIcon,
} from './Icons.jsx';

const HEADING_LEVELS = [1, 2, 3];

function ToolbarButton({ active, disabled, onClick, label, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded px-2 text-sm transition-colors disabled:opacity-40 sm:h-8 sm:min-w-8 ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write your message…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: { class: 'mail-body px-4 py-3' },
    },
  });

  // Push in externally-loaded content (e.g. opening a draft, or a reply quote)
  // without clobbering what is being typed.
  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external value changes
  }, [editor, value]);

  const promptForLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', previous);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Scrolls sideways on a narrow screen rather than stacking into rows and
          eating the writing area. */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-1.5 sm:flex-wrap sm:overflow-x-visible">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>

        <Divider />

        {HEADING_LEVELS.map((level) => (
          <ToolbarButton
            key={level}
            label={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolbarButton>
        ))}

        <Divider />

        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeIcon />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Add link" active={editor.isActive('link')} onClick={promptForLink}>
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <RuleIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <ClearFormatIcon />
        </ToolbarButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
