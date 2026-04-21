import { cn } from "@/lib/utils";

interface MessageContentProps {
  text: string;
  className?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

export const MessageContent = ({ text, className }: MessageContentProps) => {
  const parts = text.split(URL_REGEX);
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // reset regex state
          URL_REGEX.lastIndex = 0;
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
