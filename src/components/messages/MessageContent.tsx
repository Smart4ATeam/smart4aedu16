import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface MessageContentProps {
  text: string;
  className?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

/** 判斷是否為「本站 + 勞報單路徑」，是的話回傳要導向的相對路徑 */
function getInternalPaymentPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) return null;
    // /tasks/:id/payment
    if (/^\/tasks\/[^/]+\/payment\/?$/.test(u.pathname)) {
      return u.pathname + u.search + u.hash;
    }
    return null;
  } catch {
    return null;
  }
}

export const MessageContent = ({ text, className }: MessageContentProps) => {
  const parts = text.split(URL_REGEX);
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;

          const internalPath = getInternalPaymentPath(part);
          if (internalPath) {
            return (
              <Link
                key={i}
                to={internalPath}
                className="text-primary underline underline-offset-2 break-all hover:opacity-80"
              >
                {part}
              </Link>
            );
          }

          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-all hover:opacity-80"
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};
