import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  Braces,
  MousePointerClick,
} from "lucide-react";
import { InlineImageUpload } from "@/components/admin/ImageUploadButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VariableNode } from "@/components/admin/editor/VariableNode";
import { CtaButtonNode } from "@/components/admin/editor/CtaButtonNode";
import { CtaButtonDialog } from "@/components/admin/editor/CtaButtonDialog";
import type { EmailVariable } from "@/lib/marketing/emailVariables";
import { useEffect, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Bật menu "Chèn biến" với danh sách biến cá nhân hoá (email marketing). */
  variables?: EmailVariable[];
  /** Bật nút "Chèn nút CTA". */
  enableCta?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={[
        "p-1.5 rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung bài viết...",
  variables,
  enableCta,
}: RichTextEditorProps) {
  const [ctaOpen, setCtaOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
      ...(variables && variables.length ? [VariableNode] : []),
      ...(enableCta ? [CtaButtonNode] : []),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. when loading an existing article)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "");
    }
  // editor intentionally excluded — only sync when value prop changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setLink = () => {
    const url = window.prompt("URL liên kết:");
    if (!editor) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-2 border-b border-border bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Đậm"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Nghiêng"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Gạch chân"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Gạch ngang"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Tiêu đề H2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Tiêu đề H3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Danh sách"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Danh sách số"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Trích dẫn"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          active={false}
          title="Đường kẻ ngang"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Căn trái"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Căn giữa"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Căn phải"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Thêm liên kết">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <InlineImageUpload
          title="Chèn ảnh từ thiết bị"
          onUploaded={(url) => editor.chain().focus().setImage({ src: url }).run()}
        >
          <ImageIcon className="h-4 w-4" />
        </InlineImageUpload>

        {(variables?.length || enableCta) && (
          <>
            <div className="w-px bg-border mx-1 self-stretch" />
            {variables?.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title="Chèn biến"
                    className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Braces className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {variables.map((v) => (
                    <DropdownMenuItem
                      key={v.key}
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertVariable({ name: v.key, label: v.label })
                          .run()
                      }
                    >
                      {v.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {enableCta ? (
              <ToolbarButton onClick={() => setCtaOpen(true)} title="Chèn nút CTA">
                <MousePointerClick className="h-4 w-4" />
              </ToolbarButton>
            ) : null}
          </>
        )}

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          active={false}
          title="Hoàn tác"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          active={false}
          title="Làm lại"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="focus-within:outline-none"
      />

      {/* Character count */}
      <div className="px-4 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground text-right">
        {editor.storage.characterCount.words()} từ · {editor.storage.characterCount.characters()} ký tự
      </div>

      {enableCta && (
        <CtaButtonDialog
          open={ctaOpen}
          onOpenChange={setCtaOpen}
          onInsert={(attrs) => editor.chain().focus().insertCtaButton(attrs).run()}
        />
      )}
    </div>
  );
}
