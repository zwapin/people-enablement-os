import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Lightbulb, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ModulePreviewProps {
  title: string;
  summary: string;
  track: string;
  contentBody: string;
  contentHtml?: string | null;
  keyPoints: string[];
  questions: { question: string; options: string[]; correct_index: number }[];
}

export default function ModulePreview({ title, summary, track, contentBody, contentHtml, keyPoints, questions }: ModulePreviewProps) {
  const readingTime = contentBody ? Math.max(1, Math.ceil(contentBody.length / 1000)) : 1;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 px-4 sm:px-0">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">{track}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {readingTime} min lettura
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {title || "Titolo del modulo"}
        </h1>
        {summary && <p className="text-muted-foreground">{summary}</p>}
      </header>

      {/* Content */}
      {contentHtml ? (
        <article
          className="module-content module-html-content prose prose-invert prose-base max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      ) : contentBody ? (
        <article className="module-content prose prose-invert prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-li:text-foreground/80 prose-headings:mt-8 prose-headings:mb-4 prose-p:mb-4 prose-p:leading-relaxed prose-ul:my-6 prose-ol:my-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="text-xl font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
                  <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                  {children}
                </h3>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-6 border-l-4 border-primary/50 bg-secondary/30 rounded-r-lg px-5 py-4 text-foreground/80 not-italic">{children}</blockquote>
              ),
              ul: ({ children }) => <ul className="my-5 space-y-2 pl-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-5 space-y-2 pl-1 list-decimal list-inside">{children}</ol>,
              li: ({ children }) => (
                <li className="flex items-start gap-2.5 text-foreground/80 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="text-foreground font-semibold bg-primary/10 px-1 rounded">{children}</strong>
              ),
              p: ({ children }) => <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>,
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
              th: ({ children }) => (
                <th className="px-4 py-3 text-left font-semibold text-foreground border-b border-border">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-foreground/80 border-b border-border/50">{children}</td>
              ),
              tr: ({ children, ...props }) => <tr className="even:bg-muted/20" {...props}>{children}</tr>,
              hr: () => <hr className="my-8 border-border/50" />,
            }}
          >
            {contentBody}
          </ReactMarkdown>
        </article>
      ) : null}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <Card className="p-6 bg-secondary/50 border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lightbulb className="h-4 w-4 text-primary" />
            Punti Chiave
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="text-primary mt-0.5">•</span>
                {String(point)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Assessment preview */}
      {questions.length > 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground">Assessment ({questions.length} domande)</h2>
          {questions.map((q, i) => (
            <Card key={i} className="p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium text-foreground">
                <span className="font-mono text-xs text-muted-foreground mr-2">D{i + 1}</span>
                {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-md text-foreground/60"
                  >
                    <span className="font-mono text-xs opacity-60">{String.fromCharCode(65 + oi)}</span>
                    {opt}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
