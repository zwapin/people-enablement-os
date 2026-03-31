import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TurndownService from "turndown";
import Showdown from "showdown";
import {
  Bold, Italic, Heading2, List, ListOrdered, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

const showdown = new Showdown.Converter({
  tables: true,
  strikethrough: true,
  simpleLineBreaks: false,
});

interface PlanCanvasProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function PlanCanvas({ content, onChange, placeholder, disabled, className }: PlanCanvasProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder || "Scrivi qui..." }),
      Typography,
    ],
    content: showdown.makeHtml(content || ""),
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      const md = turndown.turndown(e.getHTML());
      onChange(md);
    },
  });

  useEffect(() => {
    if (editor && disabled !== undefined) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  if (!editor) return null;

  const ToolBtn = ({
    active,
    onClick,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", active && "bg-accent")}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      {!disabled && (
        <div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
          <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[80px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}
