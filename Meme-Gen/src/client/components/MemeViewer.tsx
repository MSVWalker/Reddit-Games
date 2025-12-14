import { useEffect, useMemo, useRef, useState } from 'react';
import type { MemeRecipe, SerializableCanvasElement } from '../../shared/types/meme';

type MemeViewerProps = {
  postId: string;
};

type ImageMap = Record<string, HTMLImageElement>;

const TEMPLATE_ASSETS: Record<string, string> = {
  'am-i-the-only-one': '/memes/am-i-the-only-one.jpg',
  'drake-hotline-bling': '/memes/drake-hotline-bling.jpg',
  'distracted-boyfriend': '/memes/distracted-boyfriend.jpg',
};

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

const resolveCoord = (value: number, extent: number) => (Math.abs(value) <= 1 ? value * extent : value);

const drawText = (
  ctx: CanvasRenderingContext2D,
  layer: Extract<SerializableCanvasElement, { type: 'text' }>,
  width: number,
  height: number
) => {
    const lx = resolveCoord(layer.x, width);
    const ly = resolveCoord(layer.y, height);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.textAlign = layer.align;
    ctx.textBaseline = 'middle';
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;

    const lines = (layer.content || '').split('\n');
    const lineHeight = layer.fontSize * 1.2;

    lines.forEach((line, idx) => {
        const yOffset = (idx - (lines.length - 1) / 2) * lineHeight;
        const metrics = ctx.measureText(line);
        const width = metrics.width;
        const padding = 8;
        const bgHeight = lineHeight + padding;
        const xStart =
            layer.align === 'left' ? 0 : layer.align === 'right' ? -width : -width / 2;

        if (layer.bgColor && layer.bgColor !== 'transparent') {
            ctx.fillStyle = layer.bgColor;
            ctx.fillRect(xStart - padding, yOffset - bgHeight / 2, width + padding * 2, bgHeight);
        }

        if (layer.strokeColor && layer.strokeColor !== 'transparent') {
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = Math.max(2, layer.fontSize * 0.08);
            ctx.strokeText(line, 0, yOffset);
        }

        ctx.fillStyle = layer.color;
        ctx.fillText(line, 0, yOffset);
    });

    ctx.restore();
};

const drawEmoji = (
  ctx: CanvasRenderingContext2D,
  layer: Extract<SerializableCanvasElement, { type: 'emoji' }>,
  width: number,
  height: number
) => {
    const lx = resolveCoord(layer.x, width);
    const ly = resolveCoord(layer.y, height);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.font = `${layer.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(layer.emoji, 0, 0);
    ctx.restore();
};

const drawImageLayer = (
    ctx: CanvasRenderingContext2D,
    layer: Extract<SerializableCanvasElement, { type: 'image' }>,
    imageMap: ImageMap,
    width: number,
    height: number
) => {
    const img = imageMap[layer.src];
    if (!img) return;
    const lx = resolveCoord(layer.x, width);
    const ly = resolveCoord(layer.y, height);
    const lw = Math.abs(layer.width) <= 1 ? layer.width * width : layer.width;
    const lh = Math.abs(layer.height) <= 1 ? layer.height * height : layer.height;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
};

const drawRecipe = (
  ctx: CanvasRenderingContext2D,
  recipe: MemeRecipe,
  templateImage: HTMLImageElement,
  imageMap: ImageMap
) => {
    const width = recipe.canvasWidth ?? templateImage.width;
    const height = recipe.canvasHeight ?? templateImage.height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      templateImage,
      0,
      0,
      width,
      height
    );

    recipe.elements.forEach((el) => {
        if (el.type === 'text') {
            drawText(ctx, el, width, height);
        } else if (el.type === 'emoji') {
            drawEmoji(ctx, el, width, height);
        } else if (el.type === 'image') {
            drawImageLayer(ctx, el, imageMap, width, height);
        }
    });

    recipe.drawingStrokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.save();
        ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const firstPoint = stroke.points[0];
        if (firstPoint) ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < stroke.points.length; i++) {
            const point = stroke.points[i];
            if (point) ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.restore();
    });
};

export function MemeViewer({ postId }: MemeViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [recipe, setRecipe] = useState<MemeRecipe | null>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [imageMap, setImageMap] = useState<ImageMap>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/meme/${postId}`)
            .then((res) => res.json())
            .then((data: any) => {
                if (cancelled) return;
                if (data.status === 'error') throw new Error(data.message);
                setRecipe(data.meme as MemeRecipe);
            })
            .catch((err) => {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : 'Failed to load meme';
                setError(msg);
            })
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [postId]);

    useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    const templateSrc =
      recipe.backgroundUrl ||
      TEMPLATE_ASSETS[recipe.templateId] ||
      '/memes/am-i-the-only-one.jpg';
    loadImage(templateSrc)
      .then((img) => {
        if (!cancelled) setTemplateImage(img);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load template image');
      });
    return () => {
      cancelled = true;
    };
  }, [recipe]);

    useEffect(() => {
        if (!recipe) return;
        let cancelled = false;
        const imageLayers = recipe.elements.filter((el) => el.type === 'image') as Extract<
            SerializableCanvasElement,
            { type: 'image' }
        >[];
        if (imageLayers.length === 0) {
            setImageMap({});
            return;
        }
        Promise.all(
            imageLayers.map((layer) =>
                loadImage(layer.src)
                    .then((img) => ({ src: layer.src, img }))
                    .catch(() => null)
            )
        ).then((results) => {
            if (cancelled) return;
            const next: ImageMap = {};
            results.forEach((res) => {
                if (res) next[res.src] = res.img;
            });
            setImageMap(next);
        });
        return () => {
            cancelled = true;
        };
    }, [recipe]);

    const canvasSize = useMemo(() => {
        const width = recipe?.canvasWidth ?? templateImage?.width ?? 640;
        const height = recipe?.canvasHeight ?? templateImage?.height ?? 640;
        return { width, height };
    }, [recipe, templateImage]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !recipe || !templateImage) return;
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        drawRecipe(ctx, recipe, templateImage, imageMap);
    }, [canvasSize.height, canvasSize.width, imageMap, recipe, templateImage]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-sm text-white/70">Loading meme…</p>
            </div>
        );
    }

    if (error || !recipe) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-sm text-red-400">{error || 'Meme not found'}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="max-w-full h-auto rounded-lg shadow-2xl border border-white/10 bg-zinc-900"
            />
        </div>
    );
}
