import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bold, Italic, Strikethrough,
  List, ListOrdered, Link as LinkIcon,
  Image as ImageIcon, Heading1, Heading2,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette, Minus,
} from 'lucide-react';

const COLORS = [
  '#000000', '#374151', '#6B7280', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899',
  '#163D8A', '#FFFFFF',
];

interface Props {
  content: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
}

function ToolbarBtn({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ content, onChange, onBlur, placeholder = 'Escreva aqui...' }: Props) {
  const [showColors, setShowColors] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: ({ editor }) => onBlur?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[160px] px-4 py-3 text-sm text-foreground',
      },
    },
  });

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = ev => {
      editor.chain().focus().setImage({ src: ev.target?.result as string }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  const applyLink = () => {
    if (!editor) return;
    if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run();
    else editor.chain().focus().unsetLink().run();
    setShowLink(false);
    setLinkUrl('');
  };

  if (!editor) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">

        {/* Text style */}
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <ToolbarBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda">
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar">
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar à direita">
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar">
          <AlignJustify className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com tópicos">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha divisória">
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Color */}
        <div className="relative" ref={colorRef}>
          <ToolbarBtn onClick={() => setShowColors(v => !v)} title="Cor do texto" active={showColors}>
            <Palette className="w-3.5 h-3.5" />
          </ToolbarBtn>
          {showColors && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1" style={{ minWidth: 148 }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => { editor.chain().focus().setColor(c).run(); setShowColors(false); }}
                  className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                  style={{ background: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
                className="col-span-6 text-[10px] text-muted-foreground hover:text-foreground mt-0.5"
              >
                Remover cor
              </button>
            </div>
          )}
        </div>

        {/* Link */}
        <div className="relative">
          <ToolbarBtn active={editor.isActive('link')} onClick={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setShowLink(v => !v); }} title="Inserir link">
            <LinkIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>
          {showLink && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-lg p-2 flex gap-1.5" style={{ minWidth: 260 }}>
              <input
                autoFocus
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLink(false); }}
                placeholder="https://..."
                className="flex-1 h-7 px-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={applyLink} className="px-2.5 h-7 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">OK</button>
            </div>
          )}
        </div>

        {/* Image upload */}
        <ToolbarBtn onClick={() => fileRef.current?.click()} title="Inserir imagem">
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addImage} />

      </div>

      {/* Editor area */}
      <EditorContent editor={editor} className="bg-white" />

    </div>
  );
}
