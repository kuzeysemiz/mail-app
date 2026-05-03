"use client";
import { useRef, useState, useCallback, useMemo, type ComponentProps } from "react";
import ReactQuill from "react-quill-new";

const PRESETS = ["25%", "50%", "75%", "100%"];
const MAX_BYTES = 800 * 1024; // 800 KB hedef (binary)
const MAX_DIM   = 1200;       // editörde kalite için 1200px, gönderimde bakeImageSizes devralır

type QuillProps = ComponentProps<typeof ReactQuill>;

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Çok büyük görselleri boyutsal olarak küçült
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else                 { width = Math.round(width * MAX_DIM / height);  height = MAX_DIM; }
      }

      const canvas = document.createElement("canvas");
      const draw = (w: number, h: number) => {
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      };

      draw(width, height);

      // Base64 uzunluğu ≈ binary_size / 0.75
      const tooBig = (dataUrl: string) => dataUrl.length * 0.75 > MAX_BYTES;

      let quality = 0.85;
      let result  = canvas.toDataURL("image/jpeg", quality);

      // 1. Kaliteyi düşür
      while (tooBig(result) && quality > 0.15) {
        quality = Math.max(0.15, quality - 0.1);
        result  = canvas.toDataURL("image/jpeg", quality);
      }

      // 2. Boyutları küçült
      while (tooBig(result) && width > 200) {
        width  = Math.round(width  * 0.75);
        height = Math.round(height * 0.75);
        draw(width, height);
        result = canvas.toDataURL("image/jpeg", quality);
      }

      resolve(result);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function QuillEditor(props: QuillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef     = useRef<ReactQuill>(null);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [pos, setPos]                 = useState({ top: 0, left: 0 });
  const [customPx, setCustomPx]       = useState("");

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = "image/*";
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImage(file);
        const quill = (quillRef.current as any)?.getEditor?.();
        if (!quill) return;
        const range = quill.getSelection(true);
        quill.insertEmbed(range?.index ?? 0, "image", compressed);
        quill.setSelection((range?.index ?? 0) + 1, 0);
      } catch {}
    };
  }, []);

  // Toolbar'a custom image handler enjekte et
  const enhancedModules = useMemo(() => {
    const m = props.modules;
    if (!m?.toolbar) return m;
    const toolbar  = m.toolbar;
    const handlers = {
      ...(typeof toolbar === "object" && !Array.isArray(toolbar) ? (toolbar as any).handlers : {}),
      image: imageHandler,
    };
    const newToolbar = Array.isArray(toolbar)
      ? { container: toolbar, handlers }
      : { ...(toolbar as any), handlers };
    return { ...m, toolbar: newToolbar };
  }, [props.modules, imageHandler]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img   = target as HTMLImageElement;
      const cRect = containerRef.current!.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      setSelectedImg(img);
      setCustomPx(img.style.width
        ? img.style.width.replace("px", "").replace("%", "")
        : String(img.naturalWidth));
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
      <ReactQuill ref={quillRef} {...props} modules={enhancedModules} />

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
