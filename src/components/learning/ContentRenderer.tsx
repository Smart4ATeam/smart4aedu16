import { ExternalLink } from "lucide-react";

interface Section {
  id: string;
  type: string;
  content_json: Record<string, unknown>;
  sort_order: number;
}

export function ContentRenderer({ section }: { section: Section }) {
  const data = section.content_json;

  switch (section.type) {
    case "text":
      return (
        <div className="space-y-3">
          {data.title && (
            <h4 className="text-xl font-bold text-foreground">{data.title as string}</h4>
          )}
          {data.subtitle && (
            <p className="text-sm text-primary">{data.subtitle as string}</p>
          )}
          {data.body && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {data.body as string}
            </p>
          )}
        </div>
      );

    case "card_grid":
      return (
        <div className="space-y-4">
          {data.title && (
            <h4 className="text-xl font-bold text-center text-foreground">{data.title as string}</h4>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data.cards as { icon?: string; title: string; desc: string; note?: string }[])?.map(
              (card, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl bg-muted/30 border border-border text-center glass-card"
                >
                  {card.icon && <div className="text-3xl mb-3">{card.icon}</div>}
                  <h5 className="font-bold text-foreground mb-2">{card.title}</h5>
                  <p className="text-sm text-muted-foreground mb-2">{card.desc}</p>
                  {card.note && <p className="text-xs text-primary">{card.note}</p>}
                </div>
              )
            )}
          </div>
        </div>
      );

    case "highlight":
      return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border-2 border-primary/30">
          {data.title && (
            <h4 className="text-xl font-bold mb-3 text-foreground">{data.title as string}</h4>
          )}
          {data.body && (
            <p className="text-muted-foreground leading-relaxed">{data.body as string}</p>
          )}
          {data.link_url && (
            <a
              href={data.link_url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 underline transition-colors mt-3"
            >
              <ExternalLink className="w-4 h-4" />
              {(data.link_text as string) || "了解更多 →"}
            </a>
          )}
        </div>
      );

    case "link":
      return (
        <a
          href={data.url as string}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 underline transition-colors"
        >
          {data.icon && <span>{data.icon as string}</span>}
          {data.text as string}
        </a>
      );

    case "list":
      return (
        <div className="space-y-3">
          {data.title && (
            <h4 className="text-lg font-semibold text-foreground">{data.title as string}</h4>
          )}
          {data.ordered ? (
            <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
              {(data.items as string[])?.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-2 text-muted-foreground">
              {(data.items as string[])?.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <img
            src={data.url as string}
            alt={(data.alt as string) || ""}
            className="w-full rounded-xl border border-border"
            loading="lazy"
          />
          {data.caption && (
            <p className="text-xs text-muted-foreground text-center">{data.caption as string}</p>
          )}
        </div>
      );

    case "bordered_list":
      return (
        <div className="space-y-4">
          {data.title && (
            <h4 className="text-xl font-semibold text-foreground">{data.title as string}</h4>
          )}
          <div className="space-y-3">
            {(data.items as { title: string; desc: string; color?: string }[])?.map((item, i) => (
              <div key={i} className={`pl-4 border-l-2 ${item.color === 'accent' ? 'border-accent' : 'border-primary'}`}>
                <h6 className="font-semibold text-foreground">{item.title}</h6>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "flow":
      return (
        <div className="space-y-4">
          {data.title && (
            <h4 className="text-lg font-semibold text-foreground text-center">{data.title as string}</h4>
          )}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            {(data.steps as { label: string; sub?: string; color?: string }[])?.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <span className="text-muted-foreground hidden md:block">→</span>}
                <div className="px-4 py-2 rounded-lg bg-primary/20 text-center">
                  <p className="font-medium text-foreground">{step.label}</p>
                  {step.sub && <p className="text-xs text-muted-foreground">{step.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
