import React, { useEffect, useRef, useState } from 'react';
import {
    Download,
    Type,
    Trash2,
    X,
    ChevronLeft,
    Smile,
    Pencil,
    RotateCcw,
    Image as ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface EditorProps {
    templateSrc: string;
    onBack: () => void;
}

interface TextElement {
    id: string;
    type: 'text';
    content: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    strokeColor: string;
    wrapWidth: number;
    bgColor: string;
    rotation: number;
    align: 'left' | 'center' | 'right';
}

interface EmojiElement {
    id: string;
    type: 'emoji';
    emoji: string;
    x: number;
    y: number;
    size: number;
    rotation: number;
}

interface DrawingStroke {
    points: { x: number; y: number }[];
    color: string;
    lineWidth: number;
    mode: 'draw' | 'erase';
}

interface ImageElement {
    id: string;
    type: 'image';
    src: string;
    imgObject?: HTMLImageElement; // Cache the loaded image
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

type CanvasElement = TextElement | EmojiElement | ImageElement;

type ActiveTool = 'add-text' | 'add-emoji' | 'add-image' | 'draw' | null;

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

type Point = { x: number; y: number };

type ElementBox = {
    cx: number;
    cy: number;
    width: number;
    height: number;
    rotation: number;
};

type ResizeState = {
    elementId: string;
    handle: ResizeHandle;
    fixedCorner: Point;
    startBox: { width: number; height: number };
    start: {
        x: number;
        y: number;
        fontSize?: number;
        size?: number;
        width?: number;
        height?: number;
    };
    rotation: number;
};

const POPULAR_EMOJIS = [
    '😂', '😍', '🔥', '💯', '👍', '😭', '🙏', '💀', '😎', '🤔', '😱', '🎉', '👀', '🧠', '🤡', '💩', '😅', '🥳', '🥺', '🤯',
    '😴', '🤨', '😡', '🤖', '👾', '🐸', '🍕', '☕️', '🌈', '😇', '🥰', '🤤', '😋', '🙃', '😏', '😬', '🤥', '🤢', '🤮', '🤧',
    '😷', '🤒', '🤕', '🤑', '🥵', '🥶', '😈', '👹', '👻', '👽', '🤠', '🫠', '🥸', '😳', '🤭', '🤫', '🧐', '😐', '😑', '😶',
    '😮', '😯', '😲', '🤐', '🤪', '🤬', '😵', '😵‍💫', '🤩', '😘', '😗', '😚', '😙', '💖', '❤️', '🩷', '🧡', '💛', '💚', '💙',
    '💜', '🖤', '🤍', '🤎', '✨', '⭐️', '🌟', '⚡️', '☀️', '🌙', '☁️', '💥', '💫', '💨', '🎯', '🏆', '🥇', '🥈', '🥉', '🎮',
    '🎲', '🎬', '🎵', '🎶', '📈', '📉', '🍔', '🍟', '🌮', '🍿', '🍩', '🍺', '🍻', '🍷', '🥂', '🍸', '🥃', '🧋', '🥤', '🧃',
    '🍉', '🍇', '🍓'
];

const DEFAULT_FONT_STACK = 'Impact, Arial Black, sans-serif';

const STICKERS = [
    { name: 'Speech Bubble', src: '/stickers/sticker_speech_bubble_1_1764881023554.png' },
    { name: 'Thought Cloud', src: '/stickers/sticker_speech_bubble_2_1764881039454.png' },
    { name: 'Up Arrow', src: '/stickers/sticker_arrow_up_1764881051412.png' },
    { name: 'Down Arrow', src: '/stickers/sticker_arrow_down_1764881063242.png' },
    { name: 'Sunglasses', src: '/stickers/sticker_sunglasses_1764881076117.png' },
    { name: 'Santa Hat', src: '/stickers/sticker_santa_hat_1764881088225.png' },
    { name: 'Fire', src: '/stickers/sticker_fire_1764881100984.png' },
];

const NFL_LOGOS = [
    { name: 'Arizona Cardinals', src: '/stickers/nfl/arizona-cardinals.png' },
    { name: 'Atlanta Falcons', src: '/stickers/nfl/atlanta-falcons.png' },
    { name: 'Baltimore Ravens', src: '/stickers/nfl/baltimore-ravens.png' },
    { name: 'Buffalo Bills', src: '/stickers/nfl/buffalo-bills.png' },
    { name: 'Carolina Panthers', src: '/stickers/nfl/carolina-panthers.png' },
    { name: 'Chicago Bears', src: '/stickers/nfl/chicago-bears.png' },
    { name: 'Cincinnati Bengals', src: '/stickers/nfl/cincinnati-bengals.png' },
    { name: 'Cleveland Browns', src: '/stickers/nfl/cleveland-browns.png' },
    { name: 'Dallas Cowboys', src: '/stickers/nfl/dallas-cowboys.png' },
    { name: 'Denver Broncos', src: '/stickers/nfl/denver-broncos.png' },
    { name: 'Detroit Lions', src: '/stickers/nfl/detroit-lions.png' },
    { name: 'Green Bay Packers', src: '/stickers/nfl/green-bay-packers.png' },
    { name: 'Houston Texans', src: '/stickers/nfl/houston-texans.png' },
    { name: 'Indianapolis Colts', src: '/stickers/nfl/indianapolis-colts.png' },
    { name: 'Jacksonville Jaguars', src: '/stickers/nfl/jacksonville-jaguars.png' },
    { name: 'Kansas City Chiefs', src: '/stickers/nfl/kansas-city-chiefs.png' },
    { name: 'Las Vegas Raiders', src: '/stickers/nfl/las-vegas-raiders.png' },
    { name: 'Los Angeles Chargers', src: '/stickers/nfl/los-angeles-chargers.png' },
    { name: 'Los Angeles Rams', src: '/stickers/nfl/los-angeles-rams.png' },
    { name: 'Miami Dolphins', src: '/stickers/nfl/miami-dolphins.png' },
    { name: 'Minnesota Vikings', src: '/stickers/nfl/minnesota-vikings.png' },
    { name: 'New England Patriots', src: '/stickers/nfl/new-england-patriots.png' },
    { name: 'New Orleans Saints', src: '/stickers/nfl/new-orleans-saints.png' },
    { name: 'New York Giants', src: '/stickers/nfl/new-york-giants.png' },
    { name: 'New York Jets', src: '/stickers/nfl/new-york-jets.png' },
    { name: 'Philadelphia Eagles', src: '/stickers/nfl/philadelphia-eagles.png' },
    { name: 'Pittsburgh Steelers', src: '/stickers/nfl/pittsburgh-steelers.png' },
    { name: 'San Francisco 49ers', src: '/stickers/nfl/san-francisco-49ers.png' },
    { name: 'Seattle Seahawks', src: '/stickers/nfl/seattle-seahawks.png' },
    { name: 'Tampa Bay Buccaneers', src: '/stickers/nfl/tampa-bay-buccaneers.png' },
    { name: 'Tennessee Titans', src: '/stickers/nfl/tennessee-titans.png' },
    { name: 'Washington Commanders', src: '/stickers/nfl/washington-commanders.png' },
];

const HANDLE_SIGNS: Record<ResizeHandle, { sx: -1 | 1; sy: -1 | 1 }> = {
    nw: { sx: -1, sy: -1 },
    ne: { sx: 1, sy: -1 },
    se: { sx: 1, sy: 1 },
    sw: { sx: -1, sy: 1 },
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const rotatePoint = (point: Point, angleRad: number): Point => {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
};

const dist2 = (a: Point, b: Point) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getTextLines = (content: string) => {
    const lines = content.split('\n');
    return lines.length ? lines : [''];
};

const wrapTextLines = (ctx: CanvasRenderingContext2D, content: string, maxWidth: number) => {
    const width = Math.max(1, maxWidth);
    const hardLines = getTextLines(content);
    const wrapped: string[] = [];

    for (const hardLine of hardLines) {
        const trimmed = hardLine.trim();
        if (!trimmed) {
            wrapped.push('');
            continue;
        }

        const words = trimmed.split(/\s+/).filter(Boolean);
        let line = '';

        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width <= width) {
                line = next;
                continue;
            }

            if (line) wrapped.push(line);

            if (ctx.measureText(word).width <= width) {
                line = word;
                continue;
            }

            let chunk = '';
            for (const ch of Array.from(word)) {
                const test = chunk + ch;
                if (chunk === '' || ctx.measureText(test).width <= width) {
                    chunk = test;
                    continue;
                }
                wrapped.push(chunk);
                chunk = ch;
            }
            line = chunk || word;
        }

        wrapped.push(line);
    }

    return wrapped.length ? wrapped : [''];
};

const getTextMetrics = (ctx: CanvasRenderingContext2D, el: TextElement) => {
    const fontStack = el.fontFamily || DEFAULT_FONT_STACK;
    ctx.font = `900 ${el.fontSize}px ${fontStack}`;
    const wrapWidth = Math.max(1, el.wrapWidth);
    const lines = wrapTextLines(ctx, el.content, wrapWidth);
    const lineHeight = el.fontSize * 1.12;
    const measuredMax = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    const maxWidth = Math.min(wrapWidth, Math.max(measuredMax, el.fontSize));
    const height = lineHeight * lines.length;
    return { lines, lineHeight, maxWidth, height, fontStack };
};

const getElementBox = (ctx: CanvasRenderingContext2D, el: CanvasElement): ElementBox => {
    if (el.type === 'image') {
        return { cx: el.x, cy: el.y, width: el.width, height: el.height, rotation: el.rotation };
    }
    if (el.type === 'emoji') {
        return { cx: el.x, cy: el.y, width: el.size, height: el.size, rotation: el.rotation };
    }
    const { maxWidth, height } = getTextMetrics(ctx, el);
    const padding = 14;
    return { cx: el.x, cy: el.y, width: maxWidth + padding * 2, height: height + padding * 2, rotation: el.rotation };
};

const pointInBox = (point: Point, box: ElementBox) => {
    const r = degToRad(box.rotation);
    const local = rotatePoint({ x: point.x - box.cx, y: point.y - box.cy }, -r);
    return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2;
};

const getHandlePoints = (box: ElementBox): { handle: ResizeHandle; point: Point }[] => {
    const r = degToRad(box.rotation);
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    return (Object.keys(HANDLE_SIGNS) as ResizeHandle[]).map((handle) => {
        const { sx, sy } = HANDLE_SIGNS[handle];
        const local = { x: sx * halfW, y: sy * halfH };
        const rotated = rotatePoint(local, r);
        return { handle, point: { x: box.cx + rotated.x, y: box.cy + rotated.y } };
    });
};

export function Editor({ templateSrc, onBack }: EditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const drawingLayerRef = useRef<HTMLCanvasElement | null>(null);
    const resizeRef = useRef<ResizeState | null>(null);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1); // Track scale for positioning
    const [viewportKey, setViewportKey] = useState(0);
    const [isNarrow, setIsNarrow] = useState(false);

    // UI State
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveUrl, setSaveUrl] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool>(null); // Which tool panel is expanded
    const [copyStatus, setCopyStatus] = useState<string | null>(null);

    // Drawing State
    const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawColor, setDrawColor] = useState('#ff0000');
    const [brushSize, setBrushSize] = useState(3);
    const [drawMode, setDrawMode] = useState<'draw' | 'erase'>('draw');
    const [drawLayer, setDrawLayer] = useState<'behind' | 'front'>('front');
    const dataUrlToBlob = (dataUrl: string) => {
        const [header, base64] = dataUrl.split(',');
        if (!header || !base64) return new Blob();
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(base64);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };
    const copyImage = async (url: string) => {
        try {
            // Best effort: Chrome/Android/desktop Chromium supports this
            const blob = dataUrlToBlob(url);
            // @ts-ignore ClipboardItem global
            if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
                // @ts-ignore ClipboardItem global
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setCopyStatus('Image copied to clipboard');
                return;
            }
            throw new Error('Clipboard image not supported');
        } catch {
            setCopyStatus('Open image to long-press/save on iOS or right-click on desktop.');
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const getDefaultFontSize = () => {
        if (!image) return 60;
        const scaled = image.width * 0.05; // roughly 5% of template width
        return Math.max(20, Math.min(96, Math.round(scaled)));
    };

    const getMaxFontSize = () => {
        if (!image) return 200;
        return Math.max(48, Math.round(image.width * 0.3));
    };

    // Load Image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = templateSrc;
        img.onload = () => {
            setImage(img);
        };
    }, [templateSrc]);

    // Recompute layout on resize to keep the canvas contained on mobile
    useEffect(() => {
        const handleResize = () => {
            setViewportKey((k) => k + 1);
            setIsNarrow(window.innerWidth < 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Re-run layout when finishing text editing to avoid lingering zoom/scale offsets
    useEffect(() => {
        if (!editingTextId) {
            setViewportKey((k) => k + 1);
        }
    }, [editingTextId]);

    // Focus and auto-size textarea when editing text
    useEffect(() => {
        const editingElement = editingTextId ? elements.find(el => el.id === editingTextId && el.type === 'text') as TextElement | undefined : undefined;
        const ta = textAreaRef.current;
        if (editingElement && ta) {
            ta.focus();
            ta.style.height = 'auto';
            ta.style.height = `${ta.scrollHeight}px`;
        }
    }, [editingTextId, elements, scale]);

    // Render Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;

        // Resize canvas to fit container while maintaining aspect ratio
        const container = containerRef.current;
        if (container) {
            const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
            const toolbarWidth = 80; // right column width
            const padding = isNarrow ? 16 : 28;
            const availWidth = containerWidth - toolbarWidth - padding * 2;
            const availHeight = containerHeight - padding * 2;

            const newScale = Math.min(availWidth / image.width, availHeight / image.height);
            setScale(newScale);
            const dpr = window.devicePixelRatio || 1;

            // Set display size
            canvas.style.width = `${image.width * newScale}px`;
            canvas.style.height = `${image.height * newScale}px`;

            // Set actual size
            canvas.width = image.width * dpr;
            canvas.height = image.height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = true;
        }

        // Draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        const drawingCanvas = drawingLayerRef.current ?? document.createElement('canvas');
        if (!drawingLayerRef.current) drawingLayerRef.current = drawingCanvas;
        drawingCanvas.width = image.width;
        drawingCanvas.height = image.height;
        const drawingCtx = drawingCanvas.getContext('2d');

        if (drawingCtx) {
            drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            drawingCtx.imageSmoothingEnabled = true;

            drawingStrokes.forEach((stroke) => {
                if (stroke.points.length < 2) return;
                drawingCtx.save();
                drawingCtx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
                drawingCtx.strokeStyle = stroke.color;
                drawingCtx.lineWidth = stroke.lineWidth;
                drawingCtx.lineCap = 'round';
                drawingCtx.lineJoin = 'round';
                drawingCtx.beginPath();
                const firstPoint = stroke.points[0];
                if (firstPoint) drawingCtx.moveTo(firstPoint.x, firstPoint.y);
                for (let i = 1; i < stroke.points.length; i++) {
                    const point = stroke.points[i];
                    if (point) drawingCtx.lineTo(point.x, point.y);
                }
                drawingCtx.stroke();
                drawingCtx.restore();
            });

            if (currentStroke && currentStroke.length > 1) {
                drawingCtx.save();
                drawingCtx.globalCompositeOperation = drawMode === 'erase' ? 'destination-out' : 'source-over';
                drawingCtx.strokeStyle = drawColor;
                drawingCtx.lineWidth = brushSize;
                drawingCtx.lineCap = 'round';
                drawingCtx.lineJoin = 'round';
                drawingCtx.beginPath();
                const firstPoint = currentStroke[0];
                if (firstPoint) drawingCtx.moveTo(firstPoint.x, firstPoint.y);
                for (let i = 1; i < currentStroke.length; i++) {
                    const point = currentStroke[i];
                    if (point) drawingCtx.lineTo(point.x, point.y);
                }
                drawingCtx.stroke();
                drawingCtx.restore();
            }
        }

        if (drawLayer === 'behind') {
            ctx.drawImage(drawingCanvas, 0, 0);
        }

        elements.forEach((el) => {
            if (el.id === editingTextId) return;

            ctx.save();
            if (el.type === 'text') {
                const align = el.align ?? 'center';
                const { lines, lineHeight, maxWidth, height, fontStack } = getTextMetrics(ctx, el);
                ctx.font = `900 ${el.fontSize}px ${fontStack}`;
                ctx.textAlign = align;
                ctx.textBaseline = 'middle';

                const startY = -((lines.length - 1) * lineHeight) / 2;
                const textX = align === 'left' ? -maxWidth / 2 : align === 'right' ? maxWidth / 2 : 0;

                ctx.translate(el.x, el.y);
                ctx.rotate(degToRad(el.rotation));

                if (el.bgColor !== 'transparent') {
                    ctx.fillStyle = el.bgColor;
                    ctx.fillRect(-maxWidth / 2 - 12, startY - el.fontSize / 2 - 6, maxWidth + 24, height + 12);
                }

                ctx.fillStyle = el.color;
                ctx.strokeStyle = el.strokeColor || (el.color === '#ffffff' ? '#000000' : '#ffffff');
                ctx.lineWidth = el.fontSize / 20;

                lines.forEach((line, i) => {
                    const y = startY + i * lineHeight;
                    ctx.strokeText(line, textX, y);
                    ctx.fillText(line, textX, y);
                });
            } else if (el.type === 'emoji') {
                ctx.translate(el.x, el.y);
                ctx.rotate(degToRad(el.rotation));
                ctx.font = `${el.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.emoji, 0, 0);
            } else if (el.type === 'image' && el.imgObject) {
                ctx.translate(el.x, el.y);
                ctx.rotate(degToRad(el.rotation));
                try {
                    ctx.drawImage(el.imgObject, -el.width / 2, -el.height / 2, el.width, el.height);
                } catch (e) {
                    console.error("Error drawing image", e);
                }
            }
            ctx.restore();
        });

        if (drawLayer === 'front') {
            ctx.drawImage(drawingCanvas, 0, 0);
        }

        const selectedEl = selectedId ? elements.find((el) => el.id === selectedId) : undefined;
        if (selectedEl && selectedEl.id !== editingTextId) {
            const box = getElementBox(ctx, selectedEl);
            const handleRadius = 10;

            ctx.save();
            ctx.translate(box.cx, box.cy);
            ctx.rotate(degToRad(box.rotation));
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 10]);
            ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
            ctx.setLineDash([]);

            (Object.keys(HANDLE_SIGNS) as ResizeHandle[]).forEach((handle) => {
                const { sx, sy } = HANDLE_SIGNS[handle];
                const hx = sx * (box.width / 2);
                const hy = sy * (box.height / 2);
                ctx.beginPath();
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 3;
                ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            ctx.restore();
        }
    }, [image, elements, selectedId, editingTextId, drawingStrokes, currentStroke, drawColor, brushSize, drawMode, drawLayer, viewportKey]);



    // Handlers
	    const handleAddText = () => {
	        if (!image) return;
	        const newEl: TextElement = {
	            id: `text-${Date.now()}`,
	            type: 'text',
	            content: 'DOUBLE TAP',
	            x: image.width / 2,
	            y: image.height / 2,
	            fontSize: getDefaultFontSize(),
	            color: '#ffffff',
	            strokeColor: '#000000',
	            fontFamily: DEFAULT_FONT_STACK,
	            wrapWidth: clamp(image.width * 0.9, Math.min(160, image.width * 0.95), image.width * 0.95),
	            bgColor: 'transparent',
	            rotation: 0,
	            align: 'center',
	        };
	        setElements([...elements, newEl]);
	        setSelectedId(newEl.id);
	    };

    const handleAddEmoji = (emoji: string) => {
        if (!image) return;
        const newEl: EmojiElement = {
            id: `emoji-${Date.now()}`,
            type: 'emoji',
            emoji,
            x: image.width / 2,
            y: image.height / 2,
            size: 80,
            rotation: 0,
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
        setActiveTool(null); // close picker and show controls
    };

    const handleAddImage = (src: string) => {
        if (!image) return;

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        img.onload = () => {
            // Calculate initial size (max 150px or 1/3 of canvas)
            const maxSize = Math.min(150, image.width / 3);
            const aspect = img.width / img.height;
            let width = maxSize;
            let height = maxSize / aspect;

            if (width > height) {
                if (width > maxSize) {
                    width = maxSize;
                    height = width / aspect;
                }
            } else {
                if (height > maxSize) {
                    height = maxSize;
                    width = height * aspect;
                }
            }

            const newEl: ImageElement = {
                id: `image-${Date.now()}`,
                type: 'image',
                src,
                imgObject: img,
                x: image.width / 2,
                y: image.height / 2,
                width,
                height,
                rotation: 0,
            };
            setElements(prev => [...prev, newEl]);
            setSelectedId(newEl.id);
            setActiveTool(null); // Close panel
        };
    };

    const handleUploadImage = (file: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = reader.result as string;
            handleAddImage(src);
        };
        reader.readAsDataURL(file);
    };

    const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;

        if (clientX === undefined || clientY === undefined) return null;

        if (!image) return null;
        const scale = rect.width / image.width;

        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    };

    const handleCanvasStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (editingTextId) {
            // If clicking outside while editing, save and close
            setEditingTextId(null);
            return;
        }

        const coords = getCanvasCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        // Drawing mode
        if (activeTool === 'draw') {
            setIsDrawing(true);
            setCurrentStroke([{ x, y }]);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (selectedId && ctx) {
            const selectedEl = elements.find((el) => el.id === selectedId);
            if (selectedEl) {
                const box = getElementBox(ctx, selectedEl);
                const handleHitRadius = 18;
                const hit = getHandlePoints(box).find(({ point }) => dist2(point, { x, y }) <= handleHitRadius * handleHitRadius);
                if (hit) {
                    const { sx, sy } = HANDLE_SIGNS[hit.handle];
                    const r = degToRad(box.rotation);
                    const fixedLocal = { x: -sx * (box.width / 2), y: -sy * (box.height / 2) };
                    const fixedRotated = rotatePoint(fixedLocal, r);
                    resizeRef.current = {
                        elementId: selectedEl.id,
                        handle: hit.handle,
                        fixedCorner: { x: box.cx + fixedRotated.x, y: box.cy + fixedRotated.y },
                        startBox: { width: box.width, height: box.height },
                        start:
                            selectedEl.type === 'text'
                                ? { x: selectedEl.x, y: selectedEl.y, fontSize: selectedEl.fontSize }
                                : selectedEl.type === 'emoji'
                                    ? { x: selectedEl.x, y: selectedEl.y, size: selectedEl.size }
                                    : { x: selectedEl.x, y: selectedEl.y, width: selectedEl.width, height: selectedEl.height },
                        rotation: box.rotation,
                    };
                    setIsResizing(true);
                    setIsDragging(false);
                    return;
                }
            }
        }

        // Find clicked element (reverse order for z-index)
        const clicked = ctx ? [...elements].reverse().find((el) => pointInBox({ x, y }, getElementBox(ctx, el))) : undefined;

        if (clicked) {
            setSelectedId(clicked.id);
            setIsDragging(true);
            setDragOffset({ x: x - clicked.x, y: y - clicked.y });
        } else {
            setSelectedId(null);
        }
    };

    const handleCanvasMove = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCanvasCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        // Drawing mode
        if (isDrawing && currentStroke) {
            setCurrentStroke([...currentStroke, { x, y }]);
            return;
        }

        if (isResizing && resizeRef.current) {
            const resize = resizeRef.current;
            const { sx, sy } = HANDLE_SIGNS[resize.handle];
            const r = degToRad(resize.rotation);
            const diffLocal = rotatePoint({ x: x - resize.fixedCorner.x, y: y - resize.fixedCorner.y }, -r);

            const safeStartWidth = Math.max(1, resize.startBox.width);
            const safeStartHeight = Math.max(1, resize.startBox.height);
            const scaleX = Math.abs(diffLocal.x) / safeStartWidth;
            const scaleY = Math.abs(diffLocal.y) / safeStartHeight;
            const scale = Math.max(0.1, Math.max(scaleX, scaleY));
            const maxFontSize = getMaxFontSize();

            const newHalfW = (resize.startBox.width * scale) / 2;
            const newHalfH = (resize.startBox.height * scale) / 2;
            const centerOffset = rotatePoint({ x: sx * newHalfW, y: sy * newHalfH }, r);
            const nextCenter = { x: resize.fixedCorner.x + centerOffset.x, y: resize.fixedCorner.y + centerOffset.y };

            setElements((prev) =>
                prev.map((el) => {
                    if (el.id !== resize.elementId) return el;
                    if (el.type === 'text' && resize.start.fontSize) {
                        return { ...el, x: nextCenter.x, y: nextCenter.y, fontSize: clamp(resize.start.fontSize * scale, 12, maxFontSize) };
                    }
                    if (el.type === 'emoji' && resize.start.size) {
                        return { ...el, x: nextCenter.x, y: nextCenter.y, size: Math.max(20, resize.start.size * scale) };
                    }
                    if (el.type === 'image' && resize.start.width && resize.start.height) {
                        return {
                            ...el,
                            x: nextCenter.x,
                            y: nextCenter.y,
                            width: Math.max(20, resize.start.width * scale),
                            height: Math.max(20, resize.start.height * scale),
                        };
                    }
                    return el;
                })
            );
            return;
        }

        // Element dragging
        if (!isDragging || !selectedId) return;

        setElements(prev => prev.map(el => {
            if (el.id === selectedId) {
                return { ...el, x: x - dragOffset.x, y: y - dragOffset.y };
            }
            return el;
        }));
    };

    const handleCanvasEnd = () => {
        // Finish drawing stroke
        if (isDrawing && currentStroke && currentStroke.length > 1) {
            setDrawingStrokes([...drawingStrokes, {
                points: currentStroke,
                color: drawColor,
                lineWidth: brushSize,
                mode: drawMode
            }]);
        }
        setIsDrawing(false);
        setCurrentStroke(null);
        setIsDragging(false);
        setIsResizing(false);
        resizeRef.current = null;
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const coords = getCanvasCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const clicked = ctx
            ? [...elements].reverse().find((el) => el.type === 'text' && pointInBox({ x, y }, getElementBox(ctx, el)))
            : undefined;

        if (clicked && clicked.type === 'text') {
            setEditingTextId(clicked.id);
            // Clear default "DOUBLE TAP" text when editing starts
            if (clicked.content === 'DOUBLE TAP') {
                updateTextContent(clicked.id, '');
            }
        }
    };

    const handleSave = () => {
        if (!canvasRef.current) return;
        setSelectedId(null);
        setEditingTextId(null);
        // Wait for render cycle to clear selection box
        setTimeout(() => {
            const url = canvasRef.current!.toDataURL('image/jpeg', 0.9);
            setSaveUrl(url);
            setShowSaveModal(true);
        }, 50);
    };

    const handleDelete = () => {
        if (selectedId) {
            setElements(prev => prev.filter(el => el.id !== selectedId));
            setSelectedId(null);
        }
    };

    const updateTextContent = (id: string, content: string) => {
        setElements(prev => prev.map(el =>
            el.id === id ? { ...el, content } : el
        ));
    };

    // Style helpers
    const updateStyle = (key: keyof TextElement | keyof EmojiElement | keyof ImageElement, value: any) => {
        if (!selectedId) return;
        setElements(prev => prev.map(el =>
            el.id === selectedId ? { ...el, [key]: value } : el
        ));
    };

    // Drawing helpers
    const undoDrawing = () => {
        if (drawingStrokes.length > 0) {
            setDrawingStrokes(drawingStrokes.slice(0, -1));
        }
    };

    const toggleTool = (tool: ActiveTool) => {
        if (activeTool === tool) {
            setActiveTool(null); // Close if already open
        } else {
            setActiveTool(tool);
            setSelectedId(null); // Deselect elements when switching tools
        }
    };

    const moveSelectedLayer = (direction: 'front' | 'back') => {
        if (!selectedId) return;
        setElements((prev) => {
            const idx = prev.findIndex((el) => el.id === selectedId);
            if (idx === -1) return prev;
            if (direction === 'front' && idx === prev.length - 1) return prev;
            if (direction === 'back' && idx === 0) return prev;
            const next = prev.slice();
            const [item] = next.splice(idx, 1);
            if (!item) return prev;
            if (direction === 'front') next.push(item);
            else next.unshift(item);
            return next;
        });
    };

    const selectedElement = elements.find(el => el.id === selectedId);
    const editingElement = elements.find(el => el.id === editingTextId) as TextElement | undefined;
    const editingStrokeColor =
        editingElement?.strokeColor || (editingElement?.color === '#ffffff' ? '#000000' : '#ffffff');
    const editingTextareaWidthPx = (() => {
        if (!editingElement || !image) return 0;
        const canvasCssWidth = image.width * scale;
        const maxPx = Math.min(560, canvasCssWidth * 0.95);
        const minPx = Math.min(200, maxPx);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            const { maxWidth } = getTextMetrics(ctx, editingElement);
            const desiredPx = (maxWidth + 24) * scale;
            return clamp(desiredPx, minPx, maxPx);
        }
        const fallback = canvasCssWidth * (isNarrow ? 0.9 : 0.6);
        return clamp(fallback, minPx, maxPx);
    })();
    const editingTextareaLeftPx = (() => {
        if (!editingElement || !image) return 0;
        const canvasCssWidth = image.width * scale;
        const margin = 12;
        const minX = editingTextareaWidthPx / 2 + margin;
        const maxX = canvasCssWidth - editingTextareaWidthPx / 2 - margin;
        if (maxX <= minX) return canvasCssWidth / 2;
        return clamp(editingElement.x * scale, minX, maxX);
    })();
	    const editingTextareaTopPx = (() => {
	        if (!editingElement || !image) return 0;
	        const canvasCssHeight = image.height * scale;
	        const margin = 12;
	        const lineCount = (() => {
	            const ctx = canvasRef.current?.getContext('2d');
	            if (!ctx || scale <= 0) return getTextLines(editingElement.content).length;
	            const fontStack = editingElement.fontFamily || DEFAULT_FONT_STACK;
	            ctx.font = `900 ${editingElement.fontSize}px ${fontStack}`;
	            const wrapWidth = Math.max(1, editingTextareaWidthPx / scale);
	            return wrapTextLines(ctx, editingElement.content, wrapWidth).length;
	        })();
	        const approxHeightPx = Math.max(
	            editingElement.fontSize * scale * 1.5,
	            (lineCount * editingElement.fontSize * 1.12 + 24) * scale
	        );
        const minY = approxHeightPx / 2 + margin;
        const maxY = canvasCssHeight - approxHeightPx / 2 - margin;
        if (maxY <= minY) return canvasCssHeight / 2;
        return clamp(editingElement.y * scale, minY, maxY);
    })();

    let panelContent: React.ReactNode = null;

    if (activeTool === 'add-emoji') {
        panelContent = (
            <div className="p-2">
                <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2 px-1">Pick an emoji</p>
                <div
                    className="overflow-x-auto overflow-y-hidden pb-1"
                    style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                >
                    <div className="grid grid-rows-3 auto-cols-max grid-flow-col gap-2 pr-2">
                        {POPULAR_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleAddEmoji(emoji)}
                                className="text-2xl hover:bg-white/10 p-2 rounded-lg transition-colors active:scale-95 bg-white/5 shadow-sm"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    } else if (activeTool === 'add-image') {
        panelContent = (
            <div className="p-2">
                <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2 px-1">Add image</p>
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-white/50 uppercase tracking-wide px-1">Stickers</p>
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                            {STICKERS.map((sticker) => (
                                <button
                                    key={sticker.src}
                                    onClick={() => handleAddImage(sticker.src)}
                                    className="aspect-square bg-white/5 hover:bg-white/10 rounded-lg p-2 flex items-center justify-center transition-colors active:scale-95"
                                >
                                    <img src={sticker.src} alt={sticker.name} className="w-full h-full object-contain" />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-white/50 uppercase tracking-wide px-1">NFL</p>
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                            {NFL_LOGOS.map((logo) => (
                                <button
                                    key={logo.src}
                                    onClick={() => handleAddImage(logo.src)}
                                    className="aspect-square bg-white/5 hover:bg-white/10 rounded-lg p-2 flex items-center justify-center transition-colors active:scale-95"
                                >
                                    <img src={logo.src} alt={logo.name} className="w-full h-full object-contain" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    } else if (activeTool === 'draw') {
        panelContent = (
            <div className="p-3 space-y-3">
                <div className="space-y-1.5">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Color</p>
                    <div className="grid grid-cols-8 gap-1.5">
                        {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'].map(c => (
                            <button
                                key={c}
                                onClick={() => setDrawColor(c)}
                                className={clsx(
                                    "w-full aspect-square rounded-lg border-2 transition-transform",
                                    drawColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Size</p>
                    <input
                        type="range"
                        min="1" max="10"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full accent-purple-500 h-1"
                    />
                </div>
                <div className="space-y-1.5">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Mode</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setDrawMode('draw')}
                            className={clsx(
                                "py-2 rounded-lg border text-xs font-semibold transition-colors",
                                drawMode === 'draw' ? "bg-white/10 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                            )}
                        >
                            Pen
                        </button>
                        <button
                            onClick={() => setDrawMode('erase')}
                            className={clsx(
                                "py-2 rounded-lg border text-xs font-semibold transition-colors",
                                drawMode === 'erase' ? "bg-white/10 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                            )}
                        >
                            Eraser
                        </button>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Layer</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setDrawLayer('behind')}
                            className={clsx(
                                "py-2 rounded-lg border text-xs font-semibold transition-colors",
                                drawLayer === 'behind' ? "bg-white/10 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                            )}
                        >
                            Behind
                        </button>
                        <button
                            onClick={() => setDrawLayer('front')}
                            className={clsx(
                                "py-2 rounded-lg border text-xs font-semibold transition-colors",
                                drawLayer === 'front' ? "bg-white/10 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                            )}
                        >
                            Front
                        </button>
                    </div>
                </div>
            </div>
        );
    } else if (selectedElement && selectedElement.type === 'text') {
        panelContent = (
                <div className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Layer</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => moveSelectedLayer('back')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => moveSelectedLayer('front')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Front
                        </button>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Text</p>
	                    <div className="grid grid-cols-7 gap-1">
	                        {['#ffffff', '#000000', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((c) => (
	                            <button
	                                key={c}
	                                onClick={() => updateStyle('color', c)}
	                                className={clsx(
	                                    "w-5 h-5 rounded-md border-2 transition-transform mx-auto",
	                                    selectedElement.color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
	                                )}
	                                style={{ backgroundColor: c }}
	                            />
	                        ))}
	                    </div>
	                </div>
	                <div className="space-y-1">
	                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Border</p>
	                    <div className="grid grid-cols-7 gap-1">
	                        {['#000000', '#ffffff', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((c) => (
	                            <button
	                                key={c}
	                                onClick={() => updateStyle('strokeColor', c)}
	                                className={clsx(
	                                    "w-5 h-5 rounded-md border-2 transition-transform mx-auto",
	                                    (selectedElement as TextElement).strokeColor === c
	                                        ? "border-white scale-110"
	                                        : "border-transparent hover:scale-105"
	                                )}
	                                style={{ backgroundColor: c }}
	                            />
	                        ))}
	                    </div>
	                </div>
                {/* Font Size */}
                <div className="space-y-1">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Font Size</p>
                    <input
                        type="range"
                        min="12"
                        max={getMaxFontSize()}
                        value={(selectedElement as TextElement).fontSize}
                        onChange={(e) => updateStyle('fontSize', clamp(Number(e.target.value), 12, getMaxFontSize()))}
                        className="w-full accent-purple-500 h-1"
                    />
                </div>
                {/* Alignment */}
                <div className="space-y-1">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Alignment</p>
                    <div className="flex items-center gap-1">
                        {([
                            { key: 'left', Icon: AlignLeft },
                            { key: 'center', Icon: AlignCenter },
                            { key: 'right', Icon: AlignRight },
                        ] as const).map(({ key, Icon }) => (
                            <button
                                key={key}
                                onClick={() => updateStyle('align', key)}
                                aria-label={`Align ${key}`}
                                className={clsx(
                                    "w-10 h-8 flex items-center justify-center rounded-md border transition-colors",
                                    (selectedElement as TextElement).align === key
                                        ? "bg-white/10 border-white/40 text-white"
                                        : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>
                </div>
                {/* Rotation */}
                <div className="space-y-1.5">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Rotation</p>
                    <input
                        type="range"
                        min="-180" max="180"
                        value={(selectedElement as TextElement).rotation}
                        onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                        className="w-full accent-purple-500 h-1"
                    />
                </div>
            </div>
        );
    } else if (selectedElement && selectedElement.type === 'emoji') {
        panelContent = (
            <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Layer</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => moveSelectedLayer('back')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => moveSelectedLayer('front')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Front
                        </button>
                    </div>
                </div>
                <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold">Emoji Size</p>
                <input
                    type="range"
                    min="20" max="150"
                    value={(selectedElement as EmojiElement).size}
                    onChange={(e) => updateStyle('size', parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                />
                <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold">Rotation</p>
                <input
                    type="range"
                    min="-180" max="180"
                    value={(selectedElement as EmojiElement).rotation}
                    onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                />
            </div>
        );
    } else if (selectedElement && selectedElement.type === 'image') {
        panelContent = (
            <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Layer</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => moveSelectedLayer('back')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => moveSelectedLayer('front')}
                            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Front
                        </button>
                    </div>
                </div>
                <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold">Image Size</p>
                <input
                    type="range"
                    min="20"
                    max="400"
                    value={(selectedElement as ImageElement).width}
                    onChange={(e) => {
                        const newWidth = parseInt(e.target.value);
                        const aspect = (selectedElement as ImageElement).width / (selectedElement as ImageElement).height;
                        updateStyle('width', newWidth);
                        updateStyle('height', newWidth / aspect);
                    }}
                    className="w-full accent-purple-500 h-1"
                />
                <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold mt-2">Rotation</p>
                <input
                    type="range"
                    min="0"
                    max="360"
                    value={(selectedElement as ImageElement).rotation}
                    onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                />
            </div>
        );
    }

    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            {/* Full-Screen Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 flex items-start justify-center bg-zinc-950"
                style={{ padding: isNarrow ? '56px 80px 140px 12px' : '72px 96px 180px 24px' }} // leave room for top bar, right column + bottom panel
            >
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        className={clsx(
                            "shadow-2xl touch-none",
                            activeTool === 'draw' ? "cursor-crosshair" : "cursor-move"
                        )}
                        onMouseDown={handleCanvasStart}
                        onMouseMove={handleCanvasMove}
                        onMouseUp={handleCanvasEnd}
                        onMouseLeave={handleCanvasEnd}
                        onTouchStart={handleCanvasStart}
                        onTouchMove={handleCanvasMove}
                        onTouchEnd={handleCanvasEnd}
                        onDoubleClick={handleDoubleClick}
                    />

                    {/* Inline Text Editor */}
                    {editingElement && (
                    <textarea
                        ref={textAreaRef}
                        value={editingElement.content}
                        onChange={(e) => updateTextContent(editingElement.id, e.target.value)}
                        onBlur={() => setEditingTextId(null)}
                        autoFocus
                        style={{
                                position: 'absolute',
                                left: `${editingTextareaLeftPx}px`,
                                top: `${editingTextareaTopPx}px`,
                                transform: `translate(-50%, -50%) rotate(${editingElement.rotation}deg)`,
                                fontSize: `${editingElement.fontSize * scale}px`,
                                color: editingElement.color,
                                fontFamily: editingElement.fontFamily || 'Impact, Arial Black, sans-serif',
                                fontWeight: 900,
                                    textShadow: `-${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 ${editingStrokeColor}, ${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 ${editingStrokeColor}, -${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 ${editingStrokeColor}, ${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 ${editingStrokeColor}`,
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    textAlign: editingElement.align ?? 'center',
                                    resize: 'none',
                                    overflow: 'hidden',
                                    whiteSpace: 'pre-wrap',
                                    width: `${editingTextareaWidthPx}px`,
                                    minHeight: `${editingElement.fontSize * scale * 1.5}px`,
                                    height: 'auto',
                                    padding: 0,
                                    margin: 0,
                                    lineHeight: 1.12,
                                }}
                            />
                        )}
                    </div>

                {/* Hint overlay if empty */}
                {elements.length === 0 && drawingStrokes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-zinc-700 font-bold text-2xl opacity-20 uppercase">Tap to Add</p>
                    </div>
                )}
            </div>

            {/* Top Bar - Back & Save */}
            <div className="absolute top-0 left-0 right-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm z-30">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-white/90 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Back</span>
                </button>
                <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors flex items-center gap-1.5 shadow-lg"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save</span>
                </button>
            </div>

            {/* Right Column - Dedicated Tool Bar */}
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-zinc-900/95 backdrop-blur-md border-l border-white/10 z-40 flex flex-col">
                {/* Tool Buttons */}
                <div className="flex-1 flex flex-col items-center gap-2 py-4 overflow-y-auto">
                    {/* Add Text */}
                    <button
                        onClick={() => {
                            toggleTool('add-text');
                            handleAddText();
                        }}
                        className={clsx(
                            "w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1",
                            activeTool === 'add-text' ? "bg-purple-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <Type className="w-5 h-5" />
                        <span className="text-[9px]">Text</span>
                    </button>

                    {/* Emoji Picker Toggle */}
                    <button
                        onClick={() => toggleTool('add-emoji')}
                        className={clsx(
                            "w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1",
                            activeTool === 'add-emoji' ? "bg-purple-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <Smile className="w-5 h-5" />
                        <span className="text-[9px]">Emoji</span>
                    </button>

                    {/* Add Image Toggle */}
                    <button
                        onClick={() => toggleTool('add-image')}
                        className={clsx(
                            "w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1",
                            activeTool === 'add-image' ? "bg-purple-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-[9px]">Image</span>
                    </button>

                    {/* Upload custom image */}
                    <button
                        onClick={() => uploadInputRef.current?.click()}
                        className="w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-[9px]">Upload</span>
                    </button>

                    {/* Draw Tool */}
                    <button
                        onClick={() => toggleTool('draw')}
                        className={clsx(
                            "w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1",
                            activeTool === 'draw' ? "bg-purple-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <Pencil className="w-5 h-5" />
                        <span className="text-[9px]">Draw</span>
                    </button>

                    {/* Delete (only if element selected) */}
                    {selectedElement && (
                        <button
                            onClick={handleDelete}
                            className="w-14 h-14 flex flex-col items-center justify-center rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all text-xs gap-1"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="text-[9px]">Delete</span>
                        </button>
                    )}

                    {/* Undo Drawing */}
                    {drawingStrokes.length > 0 && (
                        <button
                            onClick={undoDrawing}
                            className="w-14 h-14 flex flex-col items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs gap-1"
                        >
                            <RotateCcw className="w-5 h-5" />
                            <span className="text-[9px]">Undo</span>
                        </button>
                    )}
                </div>

                {/* Expandable Panels */}
            </div>

            {/* Bottom Panel (tool options / selection settings) */}
            {panelContent && (
                <div className="absolute left-0 right-20 bottom-0 px-4 pb-4 pointer-events-none z-30">
                    <div className="max-w-5xl mx-auto">
                        <div className="pointer-events-auto bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
                            {panelContent}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden upload input */}
            <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        handleUploadImage(file);
                    }
                    if (uploadInputRef.current) {
                        uploadInputRef.current.value = '';
                    }
                }}
            />

            {/* Save Modal */}
            {showSaveModal && saveUrl && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full max-w-md text-center shadow-2xl relative">
                        <button
                            onClick={() => setShowSaveModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-lg font-bold text-white mb-3">Meme Ready! 🎉</h3>
                        <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800 mb-3">
                            <img src={saveUrl} alt="Meme" className="w-full rounded-lg" />
                        </div>
                        {copyStatus && <p className="text-[11px] text-white/70 mb-2 text-center">{copyStatus}</p>}
                        <div className="grid grid-cols-2 gap-2 text-left items-start">
                            <div className="rounded-lg bg-white/5 border border-white/10 p-2 shadow-sm space-y-1 sm:pr-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/60">iOS Users</p>
                                <p className="text-[12px] text-white/75">Hold or right-click the image to copy/share.</p>
                            </div>
                            <div className="rounded-lg bg-white/5 border border-white/10 p-2 shadow-sm space-y-1 sm:border-l sm:border-white/10 sm:pl-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/60">Android Users</p>
                                <p className="text-[12px] text-white/75">Tap download or copy image.</p>
                                <a
                                    href={saveUrl}
                                    download="meme.jpg"
                                    className="w-full text-center py-1.5 rounded-md bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors border border-white/10 block"
                                >
                                    Download
                                </a>
                                <button
                                    onClick={() => copyImage(saveUrl)}
                                    className="w-full py-1.5 rounded-md bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors border border-white/10"
                                >
                                    Copy image
                                </button>
                            </div>
                        </div>
                        <button onClick={() => setShowSaveModal(false)} className="w-full mt-3 py-2.5 rounded-xl bg-white/90 text-black font-bold hover:bg-zinc-200 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
