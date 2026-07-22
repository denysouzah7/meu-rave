import { Loader2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRadioPlayer } from "@/contexts/RadioPlayerContext";

export function GlobalRadioDock() {
  const radio = useRadioPlayer();

  if (!radio.currentUrl || (!radio.isPlaying && !radio.isLoading)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/10 bg-[#111b21]/90 px-2 py-1.5 text-white shadow-2xl backdrop-blur-xl max-sm:bottom-3 max-sm:right-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/[0.14] text-primary">
        {radio.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
      </span>
      <span className="hidden max-w-[150px] truncate text-xs font-semibold text-[#d1d7db] sm:block">
        {radio.title || "Web radio"}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full text-[#aebac1] hover:bg-white/[0.08] hover:text-white"
        aria-label="Parar web radio"
        onClick={radio.stop}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
