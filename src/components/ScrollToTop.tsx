import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setVisible(main.scrollTop > 300);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = () => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollUp}
      className={cn(
        "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full",
        "bg-primary/80 hover:bg-primary text-primary-foreground",
        "backdrop-blur-md shadow-lg shadow-primary/25",
        "flex items-center justify-center",
        "transition-all duration-300 hover:scale-110",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
      aria-label="回到頂部"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
