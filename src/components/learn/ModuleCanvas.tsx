import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TurndownService from "turndown";
import Showdown from "showdown";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Table as TableIcon,
  Minus, Highlighter, Sparkles, Undo, Redo,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AIGeneratePopover from "./AIGeneratePopover";
import { supabase } from "@/integrations/supabase/client";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
turndown.addRule("table", {
  filter: ["table"],
  replacement: function (_content, node) {
    const el = node as HTMLTableElement;
    const rows = Array.from(el.rows);
    if (rows.length === 0) return "";
    const lines: string[] = [];
    rows.forEach((row, ri) => {
      const cells = Array.from(row.cells).map(c => c.textContent?.trim() || "");
      lines.push("| " + cells.join(" | ") + " |");
      if (ri === 0) {
        lines.push("| " + cells.map(() => "---").join(" | ") + " |");
      }
    });
    return "\n\n" + lines.join("\n") + "\n\n";
  },
});
// Preserve images in markdown
turndown.addRule("image", {
  filter: "img",
  replacement: function (_content, node) {
    const el = node as HTMLImageElement;
    const alt = el.getAttribute("alt") || "";
    const src = el.getAttribute("src") || "";
    return `![${alt}](${src})`;
  },
});
// Preserve iframes (videos) as raw HTML
turndown.addRule("iframe", {
  filter: "iframe",
  replacement: function (_content, node) {
    const el = node as HTMLIFrameElement;
    return `\n\n${el.outerHTML}\n\n`;
  },
});
// Preserve video tags as raw HTML
turndown.addRule("video", {
  filter: "video",
  replacement: function (_content, node) {
    const el = node as HTMLVideoElement;
    return `\n\n${el.outerHTML}\n\n`;
  },
});

const showdown = new Showdown.Converter({
  tables: true,
  strikethrough: true,
  tasklists: true,
  simpleLineBreaks: false,
});

async function uploadImageFile(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("module-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Upload failed:", error);
    return null;
  }
  const { data } = supabase.storage.from("module-media").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadBase64Image(dataUrl: string): Promise<string | null> {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.split("/")[1] || "png";
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], `pasted.${ext}`, { type: mime });
  return uploadImageFile(file);
}

interface ModuleCanvasProps {
  content: string;
  onChange: (markdown: string, html?: string) => void;
  disabled?: boolean;
  moduleTitle?: string;
  moduleId?: string;
  renderToolbarExtra?: React.ReactNode;
}

export default function ModuleCanvas({ content, onChange, disabled, moduleTitle, moduleId, renderToolbarExtra }: ModuleCanvasProps) {
  const [showAI, setShowAI] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: "Inizia a scrivere il contenuto del modulo... Premi / per i comandi" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight,
      Typography,
      TextStyle,
      Color,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto my-4",
        },
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: content ? showdown.makeHtml(content) : "",
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = turndown.turndown(html);
      onChange(md, html);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 dark:prose-invert",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "/" && !slashMenuOpen) {
          setTimeout(() => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const editorRect = editorRef.current?.getBoundingClientRect();
              if (editorRect) {
                setSlashMenuPos({
                  top: rect.bottom - editorRect.top + 4,
                  left: rect.left - editorRect.left,
                });
              }
            }
            setSlashMenuOpen(true);
          }, 10);
        }
        return false;
      },
      // Handle pasted images and rich content
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Check for pasted files (images)
        const files = Array.from(clipboardData.files);
        const imageFiles = files.filter(f => f.type.startsWith("image/"));
        if (imageFiles.length > 0) {
          event.preventDefault();
          imageFiles.forEach(async (file) => {
            const url = await uploadImageFile(file);
            if (url && editor) {
              editor.chain().focus().setImage({ src: url, alt: file.name }).run();
            }
          });
          return true;
        }

        // Check for HTML content (pasted from web)
        const html = clipboardData.getData("text/html");
        if (html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const images = doc.querySelectorAll("img");
          
          if (images.length > 0) {
            event.preventDefault();
            // Process images: upload external/base64 images to storage
            const processAndInsert = async () => {
              for (const img of Array.from(images)) {
                const src = img.getAttribute("src") || "";
                if (src.startsWith("data:")) {
                  const url = await uploadBase64Image(src);
                  if (url) img.setAttribute("src", url);
                } 
              }
              const processedHtml = doc.body.innerHTML;
              if (editor) {
                editor.chain().focus().insertContent(processedHtml).run();
              }
            };
            processAndInsert();
            return true;
          }
          
          // HTML without images — let TipTap handle it natively
          // so that TextStyle/Color/Underline extensions preserve inline styles
          return false;
        }

        return false;
      },
      // Handle dropped images
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        imageFiles.forEach(async (file) => {
          const url = await uploadImageFile(file);
          if (url && editor) {
            editor.chain().focus().setImage({ src: url, alt: file.name }).run();
          }
        });
        return true;
      },
    },
  });

  // Close slash menu on click outside or Escape
  useEffect(() => {
    if (!slashMenuOpen) return;
    const handleClose = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlashMenuOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleClose);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleClose);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [slashMenuOpen]);

  // Update content from outside
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentMd = turndown.turndown(editor.getHTML());
      if (currentMd !== content) {
        editor.commands.setContent(showdown.makeHtml(content));
      }
    }
  }, [content, editor]);

  const executeSlashCommand = useCallback((command: string) => {
    if (!editor) return;
    editor.commands.deleteRange({
      from: editor.state.selection.from - 1,
      to: editor.state.selection.from,
    });
    setSlashMenuOpen(false);

    switch (command) {
      case "h2":
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case "h3":
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case "bullet":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "ordered":
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "quote":
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "table":
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "divider":
        editor.chain().focus().setHorizontalRule().run();
        break;
      case "image":
        fileInputRef.current?.click();
        break;
      case "ai":
        setShowAI(true);
        break;
    }
  }, [editor]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editor) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;
      const url = await uploadImageFile(file);
      if (url) {
        if (file.type.startsWith("video/")) {
          editor.chain().focus().insertContent(`<video src="${url}" controls class="rounded-lg max-w-full my-4"></video>`).run();
        } else {
          editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        }
      }
    }
    e.target.value = "";
  }, [editor]);

  const handleAIInsert = useCallback((markdown: string) => {
    if (!editor) return;
    const html = showdown.makeHtml(markdown);
    editor.chain().focus().insertContent(html).run();
    setShowAI(false);
  }, [editor]);

  if (!editor) return null;

  const slashCommands = [
    { id: "h2", label: "Titolo H2", icon: Heading2, desc: "Titolo grande" },
    { id: "h3", label: "Titolo H3", icon: Heading3, desc: "Sottotitolo" },
    { id: "bullet", label: "Elenco puntato", icon: List, desc: "Lista non ordinata" },
    { id: "ordered", label: "Elenco numerato", icon: ListOrdered, desc: "Lista ordinata" },
    { id: "quote", label: "Citazione", icon: Quote, desc: "Blockquote" },
    { id: "table", label: "Tabella", icon: TableIcon, desc: "Tabella 3×3" },
    { id: "image", label: "Immagine / Video", icon: ImageIcon, desc: "Carica un file media" },
    { id: "divider", label: "Separatore", icon: Minus, desc: "Linea orizzontale" },
  ];

  return (
    <div className="relative" ref={editorRef}>
      {/* Hidden file input for image/video upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Top toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5 bg-background/80 backdrop-blur-sm sticky top-0 z-10 overflow-x-auto">
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={Bold} tooltip="Grassetto" />
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={Italic} tooltip="Corsivo" />
        <ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} icon={Strikethrough} tooltip="Barrato" />
        <ToolbarBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} icon={Highlighter} tooltip="Evidenzia" />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={Heading2} tooltip="H2" />
        <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} icon={Heading3} tooltip="H3" />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={List} tooltip="Elenco puntato" />
        <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={ListOrdered} tooltip="Elenco numerato" />
        <ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={Quote} tooltip="Citazione" />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={TableIcon} tooltip="Tabella" />
        <ToolbarBtn active={false} onClick={() => fileInputRef.current?.click()} icon={ImageIcon} tooltip="Inserisci immagine/video" />
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} tooltip="Separatore" />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().undo().run()} icon={Undo} tooltip="Annulla" />
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().redo().run()} icon={Redo} tooltip="Ripeti" />
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {renderToolbarExtra && (
            <>
              {renderToolbarExtra}
            </>
          )}
        </div>
      </div>

      {/* Editor content */}
      <div className="bg-background min-h-[300px]">
        <EditorContent editor={editor} />
      </div>

      {/* Slash command menu */}
      {slashMenuOpen && slashMenuPos && (
        <div
          ref={slashMenuRef}
          className="absolute z-50 w-64 rounded-lg border border-border bg-popover shadow-lg py-1"
          style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
        >
          {slashCommands.map((cmd) => (
            <button
              key={cmd.id}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
              onClick={() => executeSlashCommand(cmd.id)}
            >
              <cmd.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <div className="font-medium text-foreground">{cmd.label}</div>
                <div className="text-xs text-muted-foreground">{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* AI Generate Popover */}
      {showAI && (
        <AIGeneratePopover
          onInsert={handleAIInsert}
          onClose={() => setShowAI(false)}
          moduleTitle={moduleTitle}
          moduleId={moduleId}
        />
      )}
    </div>
  );
}

function ToolbarBtn({ active, onClick, icon: Icon, tooltip }: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={cn(
        "p-1.5 rounded hover:bg-accent transition-colors",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
