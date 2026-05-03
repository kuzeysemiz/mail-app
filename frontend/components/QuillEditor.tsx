"use client";
import { useRef, useState, useCallback, type ComponentProps } from "react";
import ReactQuill from "react-quill-new";

const PRESETS = ["25%", "50%", "75%", "100%"];

type QuillProps = ComponentProps<typeof ReactQuill>;

export default function QuillEditor(props: QuillProps) {
  const containerRef               = useRef<HTMLDivElement>(null);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [pos, setPos]              = useState({ top: 0, left: 0 });
  const [customPx, setCustomPx]    = useState("");

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      const cRect = containerRef.current!.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      setSelectedImg(img);
      setCustomPx(img.style.width ? img.style.width.replace("px", "").replace("%", "") : String(img.naturalWidth));
      setPos({
        top:  Math.max(4, iRect.top  - cRect.top  - 44),
        left: Math.max(0, iRect.left - cRect.left),
      });
    } else {
      setSelectedImg(null);
    }
  }, []);

  const applyWidth = useCallback((width: string) => {
    if (!selectedImg) return;
    selectedImg.style.width    = width;
    selectedImg.style.height   = "auto";
    selectedImg.style.maxWidth = "100%";
    setSelectedImg(null);
  }, [selectedImg]);

  return (
    <div ref={containerRef} className="relative" onClick={handleClick}>
      <ReactQuill {...props} />

      {selectedImg && (
        <div
          style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 50 }}
          className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5 shadow-xl text-xs"
          onMouseDown={e => e.preventDefault()}
        >
          {PRESETS.map(p => (
            <button key={p} type="button" onClick={() => applyWidth(p)}
              className="px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              {p}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-0.5" />
          <input
            type="number" min={10} max={2000}
            value={customPx}
            onChange={e => setCustomPx(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && customPx) applyWidth(customPx + "px"); }}
            onMouseDown={e => e.stopPropagation()}
            placeholder="px"
            className="w-16 px-1.5 py-0.5 bg-input border border-border rounded text-foreground outline-none"
          />
          <button type="button"
            onClick={() => customPx && applyWidth(customPx + "px")}
            className="px-2 py-0.5 bg-primary text-primary-foreground rounded hover:opacity-90">
            ✓
          </button>
          <button type="button" onClick={() => setSelectedImg(null)}
            className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
