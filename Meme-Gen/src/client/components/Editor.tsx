import React, { useEffect, useRef, useState } from 'react';
import {
    Download,
    Type,
    Trash2,
    X,
    ChevronLeft,
    Check,
    Circle,
    Smile,
    Pencil,
    RotateCcw,
    Image as ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { PostMemeResponse, SessionResponse } from '../../shared/types/api';

interface EditorProps {
    templateSrc: string;
    onBack: () => void;
    templateMode?: boolean;
}

type TemplateBox = {
    x: number;
    y: number;
    wrapWidth: number;
    boxHeight: number;
    fontSize: number;
    maxFontSize?: number;
    align?: TextElement['align'];
    rotation?: number;
    fontFamily?: string;
    color?: string;
    strokeColor?: string;
    bgColor?: string;
    content?: string;
};

interface TextElement {
    id: string;
    type: 'text';
    content: string;
    x: number;
    y: number;
    fontSize: number;
    maxFontSize: number;
    fontFamily: string;
    color: string;
    strokeColor: string;
    wrapWidth: number;
    boxHeight: number;
    bgColor: string;
    rotation: number;
    align: 'left' | 'center' | 'right';
    isPlaceholder?: boolean;
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
        maxFontSize?: number;
        wrapWidth?: number;
        boxHeight?: number;
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
const BASE64_UPLOAD_LIMIT_BYTES = 2.5 * 1024 * 1024;

const STICKERS = [
    { name: 'Brie President', src: '/stickers/brie-president-icon.jpeg' },
    { name: 'Speech Bubble', src: '/stickers/sticker_speech_bubble_1_1764881023554.png' },
    { name: 'Thought Cloud', src: '/stickers/sticker_speech_bubble_2_1764881039454.png' },
    { name: 'Up Arrow', src: '/stickers/sticker_arrow_up_1764881051412.png' },
    { name: 'Down Arrow', src: '/stickers/sticker_arrow_down_1764881063242.png' },
    { name: 'Deal With It', src: '/stickers/sticker_sunglasses_1764881076117.png' },
    { name: 'Santa Hat', src: '/stickers/sticker_santa_hat_1764881088225.png' },
    { name: 'Bro Hat', src: '/stickers/sticker_bro_hat.png' },
    { name: 'Censored Bar', src: '/stickers/sticker_censored.png' },
    { name: 'Red Circle', src: '/stickers/sticker_red_circle.png' },
    { name: 'WOW Burst', src: '/stickers/sticker_wow_burst.png' },
];

const NFL_LOGOS = [
    // AFC East
    { name: 'Buffalo Bills', src: '/stickers/nfl/buffalo-bills.png' },
    { name: 'Miami Dolphins', src: '/stickers/nfl/miami-dolphins.png' },
    { name: 'New England Patriots', src: '/stickers/nfl/new-england-patriots.png' },
    { name: 'New York Jets', src: '/stickers/nfl/new-york-jets.png' },
    // AFC North
    { name: 'Baltimore Ravens', src: '/stickers/nfl/baltimore-ravens.png' },
    { name: 'Cincinnati Bengals', src: '/stickers/nfl/cincinnati-bengals.png' },
    { name: 'Cleveland Browns', src: '/stickers/nfl/cleveland-browns.png' },
    { name: 'Pittsburgh Steelers', src: '/stickers/nfl/pittsburgh-steelers.png' },
    // AFC South
    { name: 'Houston Texans', src: '/stickers/nfl/houston-texans.png' },
    { name: 'Indianapolis Colts', src: '/stickers/nfl/indianapolis-colts.png' },
    { name: 'Jacksonville Jaguars', src: '/stickers/nfl/jacksonville-jaguars.png' },
    { name: 'Tennessee Titans', src: '/stickers/nfl/tennessee-titans.png' },
    // AFC West
    { name: 'Denver Broncos', src: '/stickers/nfl/denver-broncos.png' },
    { name: 'Kansas City Chiefs', src: '/stickers/nfl/kansas-city-chiefs.png' },
    { name: 'Las Vegas Raiders', src: '/stickers/nfl/las-vegas-raiders.png' },
    { name: 'Los Angeles Chargers', src: '/stickers/nfl/los-angeles-chargers.png' },
    // NFC East
    { name: 'Dallas Cowboys', src: '/stickers/nfl/dallas-cowboys.png' },
    { name: 'New York Giants', src: '/stickers/nfl/new-york-giants.png' },
    { name: 'Philadelphia Eagles', src: '/stickers/nfl/philadelphia-eagles.png' },
    { name: 'Washington Commanders', src: '/stickers/nfl/washington-commanders.png' },
    // NFC North
    { name: 'Chicago Bears', src: '/stickers/nfl/chicago-bears.png' },
    { name: 'Detroit Lions', src: '/stickers/nfl/detroit-lions.png' },
    { name: 'Green Bay Packers', src: '/stickers/nfl/green-bay-packers.png' },
    { name: 'Green Bay Packers (Alt)', src: '/stickers/nfl/green-bay-packers-alt.png' },
    { name: 'Minnesota Vikings', src: '/stickers/nfl/minnesota-vikings.png' },
    // NFC South
    { name: 'Atlanta Falcons', src: '/stickers/nfl/atlanta-falcons.png' },
    { name: 'Carolina Panthers', src: '/stickers/nfl/carolina-panthers.png' },
    { name: 'New Orleans Saints', src: '/stickers/nfl/new-orleans-saints.png' },
    { name: 'Tampa Bay Buccaneers', src: '/stickers/nfl/tampa-bay-buccaneers.png' },
    { name: 'Tampa Bay Buccaneers (Throwback)', src: '/stickers/nfl/tampa-bay-buccaneers-throwback.png' },
    // NFC West
    { name: 'Arizona Cardinals', src: '/stickers/nfl/arizona-cardinals.png' },
    { name: 'Los Angeles Rams', src: '/stickers/nfl/los-angeles-rams.png' },
    { name: 'San Francisco 49ers', src: '/stickers/nfl/san-francisco-49ers.png' },
    { name: 'Seattle Seahawks', src: '/stickers/nfl/seattle-seahawks.png' },
];

const HANDLE_SIGNS: Record<ResizeHandle, { sx: -1 | 1; sy: -1 | 1 }> = {
    nw: { sx: -1, sy: -1 },
    ne: { sx: 1, sy: -1 },
    se: { sx: 1, sy: 1 },
    sw: { sx: -1, sy: 1 },
};

const TEXT_BOX_PADDING = 14;

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

const getRotatedAabbSize = (width: number, height: number, rotationDeg: number) => {
    const r = degToRad(rotationDeg);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return {
        width: Math.abs(width * cos) + Math.abs(height * sin),
        height: Math.abs(width * sin) + Math.abs(height * cos),
    };
};

const clampCenterToImage = (
    center: Point,
    box: ElementBox,
    imageWidth: number,
    imageHeight: number,
    overflowRatio: number
) => {
    const aabb = getRotatedAabbSize(box.width, box.height, box.rotation);
    const overflowX = Math.max(0, imageWidth * overflowRatio);
    const overflowY = Math.max(0, imageHeight * overflowRatio);
    const minX = aabb.width / 2 - overflowX;
    const maxX = imageWidth - aabb.width / 2 + overflowX;
    const minY = aabb.height / 2 - overflowY;
    const maxY = imageHeight - aabb.height / 2 + overflowY;
    return {
        x: maxX >= minX ? clamp(center.x, minX, maxX) : imageWidth / 2,
        y: maxY >= minY ? clamp(center.y, minY, maxY) : imageHeight / 2,
    };
};

const getTextLines = (content: string) => {
    const lines = content.split('\n');
    return lines.length ? lines : [''];
};

const wrapTextLines = (ctx: CanvasRenderingContext2D, content: string, maxWidth: number) => {
    const width = Math.max(1, maxWidth);
    const hardLines = getTextLines(content);
    const wrapped: string[] = [];

    for (const hardLine of hardLines) {
        const words = hardLine.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            wrapped.push('');
            continue;
        }

        let line = '';
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width <= width) {
                line = next;
            } else {
                if (line) wrapped.push(line);
                line = word;
            }
        }
        if (line) wrapped.push(line);
    }

    return wrapped.length ? wrapped : [''];
};

const getTextMetrics = (ctx: CanvasRenderingContext2D, el: TextElement) => {
    const fontStack = el.fontFamily || DEFAULT_FONT_STACK;
    ctx.font = `900 ${el.fontSize}px ${fontStack}`;
    const wrapWidth = Math.max(1, typeof el.wrapWidth === 'number' && Number.isFinite(el.wrapWidth) ? el.wrapWidth : Math.max(120, el.fontSize * 6));
    const lines = wrapTextLines(ctx, el.content, wrapWidth);
    const lineHeight = el.fontSize * 1.1;
    const height = lineHeight * Math.max(1, lines.length);
    return { lines, lineHeight, wrapWidth, height, fontStack };
};

const getMaxFittableTextFontSize = (
    ctx: CanvasRenderingContext2D,
    el: TextElement,
    imageWidth: number,
    imageHeight: number
) => {
    const wrapWidth = Math.max(1, typeof el.wrapWidth === 'number' && Number.isFinite(el.wrapWidth) ? el.wrapWidth : Math.max(120, el.fontSize * 6));
    const baseBoxHeight = Math.max(20, typeof el.boxHeight === 'number' && Number.isFinite(el.boxHeight) ? el.boxHeight : Math.max(el.fontSize * 1.6, 60));
    const fontStack = el.fontFamily || DEFAULT_FONT_STACK;
    const minFontSize = 2;
    const maxCandidate = Math.max(minFontSize, Math.floor(Math.min(240, imageWidth, imageHeight)));

    let best = minFontSize;
    for (let size = minFontSize; size <= maxCandidate; size++) {
        ctx.font = `900 ${size}px ${fontStack}`;
        const lines = wrapTextLines(ctx, el.content, wrapWidth);
        const lineHeight = size * 1.1;
        const contentHeight = lineHeight * Math.max(1, lines.length);
        const rectWidth = wrapWidth + TEXT_BOX_PADDING * 2;
        const rectHeight = Math.max(contentHeight, baseBoxHeight) + TEXT_BOX_PADDING * 2;
        const aabb = getRotatedAabbSize(rectWidth, rectHeight, el.rotation);
        if (aabb.width <= imageWidth && aabb.height <= imageHeight) {
            best = size;
        } else {
            break;
        }
    }
    return best;
};

const getElementBox = (ctx: CanvasRenderingContext2D, el: CanvasElement): ElementBox => {
    if (el.type === 'image') {
        return { cx: el.x, cy: el.y, width: el.width, height: el.height, rotation: el.rotation };
    }
    if (el.type === 'emoji') {
        return { cx: el.x, cy: el.y, width: el.size, height: el.size, rotation: el.rotation };
    }
    const wrapWidth = Math.max(1, typeof el.wrapWidth === 'number' && Number.isFinite(el.wrapWidth) ? el.wrapWidth : Math.max(120, el.fontSize * 6));
    const boxHeight = Math.max(20, typeof el.boxHeight === 'number' && Number.isFinite(el.boxHeight) ? el.boxHeight : Math.max(el.fontSize * 1.6, 60));
    return {
        cx: el.x,
        cy: el.y,
        width: wrapWidth + TEXT_BOX_PADDING * 2,
        height: boxHeight + TEXT_BOX_PADDING * 2,
        rotation: el.rotation,
    };
};

const constrainElementToImage = (
    ctx: CanvasRenderingContext2D | null,
    el: CanvasElement,
    imageWidth: number,
    imageHeight: number,
    overflowRatio: number
): CanvasElement => {
    if (el.type === 'text') {
        const minWrapWidth = 60;
        const minBoxHeight = 20;
        const maxWrapWidth = Math.max(minWrapWidth, imageWidth - TEXT_BOX_PADDING * 2 - 16);
        const maxBoxHeight = Math.max(minBoxHeight, imageHeight - TEXT_BOX_PADDING * 2 - 16);
        const maxFontSize =
            typeof el.maxFontSize === 'number' && Number.isFinite(el.maxFontSize) ? el.maxFontSize : el.fontSize;
        let fontSize = Math.min(el.fontSize, maxFontSize);
        const wrapWidth = clamp(el.wrapWidth, minWrapWidth, maxWrapWidth);
        const boxHeight = clamp(el.boxHeight, minBoxHeight, maxBoxHeight);
        if (ctx) {
            const fitCap = getMaxFittableTextFontSize(
                ctx,
                { ...el, fontSize, wrapWidth, boxHeight },
                imageWidth,
                imageHeight
            );
            fontSize = Math.min(fontSize, fitCap);
        }
        const nextText: TextElement = { ...el, fontSize, maxFontSize, wrapWidth, boxHeight };
        console.debug("[text] constrain", {
            id: el.id,
            wrapWidth,
            boxHeight,
            fontSize,
            maxFontSize,
            imageWidth,
            imageHeight,
            overflowRatio,
        });
        const box = ctx
            ? getElementBox(ctx, nextText)
            : {
                  cx: nextText.x,
                  cy: nextText.y,
                  width: Math.max(1, wrapWidth) + TEXT_BOX_PADDING * 2,
                  height: Math.max(1, boxHeight) + TEXT_BOX_PADDING * 2,
                  rotation: nextText.rotation,
              };
        const clamped = clampCenterToImage(
            { x: nextText.x, y: nextText.y },
            box,
            imageWidth,
            imageHeight,
            overflowRatio
        );
        return { ...nextText, x: clamped.x, y: clamped.y };
    }

    const box: ElementBox =
        el.type === 'image'
            ? { cx: el.x, cy: el.y, width: el.width, height: el.height, rotation: el.rotation }
            : { cx: el.x, cy: el.y, width: el.size, height: el.size, rotation: el.rotation };
    const clamped = clampCenterToImage({ x: el.x, y: el.y }, box, imageWidth, imageHeight, overflowRatio);
    return { ...el, x: clamped.x, y: clamped.y };
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

export function Editor({ templateSrc, onBack, templateMode = false }: EditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const drawingLayerRef = useRef<HTMLCanvasElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [shareImageData, setShareImageData] = useState<string | null>(null);
    const [shareImageBytes, setShareImageBytes] = useState<number | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool>(null); // Which tool panel is expanded
    const [panelHeight, setPanelHeight] = useState(0);
    const [postTitle, setPostTitle] = useState('');
    const [postError, setPostError] = useState<string | null>(null);
    const [postSuccessUrl, setPostSuccessUrl] = useState<string | null>(null);
    const [postCompleted, setPostCompleted] = useState(false);
    const [postingKey, setPostingKey] = useState<string | null>(null);
    const [sessionInfo, setSessionInfo] = useState<SessionResponse | null>(null);
    const [templateLayouts, setTemplateLayouts] = useState<Record<string, { boxes: TemplateBox[] }>>({});
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [templateSaveStatus, setTemplateSaveStatus] = useState<string | null>(null);

    // Drawing State
    const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawColor, setDrawColor] = useState('#ff0000');
    const [brushSize, setBrushSize] = useState(3);
    const [drawMode, setDrawMode] = useState<'draw' | 'erase'>('draw');
    const [drawLayer, setDrawLayer] = useState<'behind' | 'front'>('front');
    const templateId = (() => {
        const match = templateSrc.match(/\/memes\/([^?]+)/i);
        if (match?.[1]) return match[1].toLowerCase();
        return null;
    })();
    const getBase64Length = (dataUrl: string) => {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return dataUrl.length;
        return dataUrl.length - commaIndex - 1;
    };

    const exportScaledJpeg = (source: HTMLCanvasElement, scale: number, quality: number) => {
        if (scale >= 0.999) return source.toDataURL('image/jpeg', quality);
        const scaled = document.createElement('canvas');
        scaled.width = Math.max(1, Math.round(source.width * scale));
        scaled.height = Math.max(1, Math.round(source.height * scale));
        const ctx = scaled.getContext('2d');
        if (ctx) {
            ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
        }
        return scaled.toDataURL('image/jpeg', quality);
    };

    const generateShareImage = (canvas: HTMLCanvasElement) => {
        let quality = 0.92;
        let scale = 1;
        let attempt = 0;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let base64Bytes = getBase64Length(dataUrl);

        while (base64Bytes > BASE64_UPLOAD_LIMIT_BYTES && attempt < 8) {
            if (quality > 0.6) {
                quality = Math.max(0.6, quality - 0.1);
            } else if (scale > 0.5) {
                scale = Math.max(0.5, scale * 0.85);
            } else {
                break;
            }
            dataUrl = exportScaledJpeg(canvas, scale, quality);
            base64Bytes = getBase64Length(dataUrl);
            attempt++;
        }

        return { dataUrl, base64Bytes };
    };
    const getDefaultFontSize = () => {
        if (!image) return 60;
        const scaled = image.width * 0.05; // roughly 5% of template width
        return Math.max(20, Math.min(96, Math.round(scaled)));
    };

    const getMaxFontSize = () => {
        if (!image) return 160;
        const scaled = image.width * 0.18;
        return Math.round(Math.min(160, Math.max(32, scaled)));
    };

    useEffect(() => {
        let ignore = false;
        const loadSession = async () => {
            try {
                const res = await fetch('/api/session');
                if (!res.ok) throw new Error('Failed to fetch session');
                const data = (await res.json()) as SessionResponse;
                if (!ignore) {
                    setSessionInfo(data);
                }
            } catch {
                if (!ignore) {
                    setSessionInfo(null);
                }
            }
        };
        loadSession();
        return () => {
            ignore = true;
        };
    }, []);

    // Load Image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = templateSrc;
        img.onload = () => {
            setImage(img);
        };
    }, [templateSrc]);

    useEffect(() => {
        if (!image || !templateId) return;
        const preset = templateLayouts[templateId];
        if (!preset || !Array.isArray(preset.boxes)) return;
        const hasTextElements = elements.some((el) => el.type === 'text');
        if (hasTextElements) return;
        const textElements: TextElement[] = preset.boxes.map((box, idx) => ({
            id: `preset-${idx}-${Date.now()}`,
            type: 'text',
            content: box.content ?? '',
            x: box.x,
            y: box.y,
            wrapWidth: box.wrapWidth,
            boxHeight: box.boxHeight,
            fontSize: box.fontSize,
            maxFontSize: box.maxFontSize ?? box.fontSize,
            align: 'center',
            rotation: box.rotation ?? 0,
            fontFamily: box.fontFamily || DEFAULT_FONT_STACK,
            color: box.color || '#ffffff',
            strokeColor: box.strokeColor || '#000000',
            bgColor: box.bgColor ?? 'transparent',
            isPlaceholder: !templateMode && Boolean((box.content ?? '').trim()),
        }));
        setElements(textElements);
    }, [image, templateId, templateLayouts, elements]);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/template-layouts')
            .then((res) => (res.ok ? res.json() : {}))
            .then((data) => {
                if (!cancelled) setTemplateLayouts(data || {});
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    // Recompute layout on resize to keep the canvas contained on mobile
    useEffect(() => {
        const handleResize = () => {
            setViewportKey((k) => k + 1);
            setIsNarrow(window.innerWidth < 1024);
            // recompute panel height on desktop to keep canvas above it
            if (panelRef.current) {
                setPanelHeight(panelRef.current.getBoundingClientRect().height);
            }
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
            const focusAndSize = () => {
                ta.focus({ preventScroll: true });
                const len = ta.value.length;
                if (typeof ta.setSelectionRange === 'function') {
                    ta.setSelectionRange(len, len);
                }
            };
            requestAnimationFrame(focusAndSize);
            console.debug("[text] editing start", { id: editingElement.id, wrapWidth: editingElement.wrapWidth, boxHeight: editingElement.boxHeight, fontSize: editingElement.fontSize, contentLength: editingElement.content.length });
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
                const align: 'left' | 'center' | 'right' = 'center';
                const { lines, lineHeight, wrapWidth, height: contentHeight, fontStack } = getTextMetrics(ctx, el);
                ctx.font = `900 ${el.fontSize}px ${fontStack}`;
                ctx.textAlign = align;
                ctx.textBaseline = 'top';

                const desiredBoxHeight = typeof el.boxHeight === 'number' && Number.isFinite(el.boxHeight)
                    ? el.boxHeight
                    : Math.max(el.fontSize * 1.6, 60);
                const boxHeight = Math.max(desiredBoxHeight, 20);
                const textX = align === 'left' ? -wrapWidth / 2 : align === 'right' ? wrapWidth / 2 : 0;
                const contentTop = -(boxHeight / 2) + (boxHeight - contentHeight) / 2;
                console.debug("[text] render", {
                    id: el.id,
                    wrapWidth,
                    boxHeight,
                    contentHeight,
                    lines: lines.length,
                    fontSize: el.fontSize,
                    textX,
                    contentTop,
                });

                ctx.translate(el.x, el.y);
                ctx.rotate(degToRad(el.rotation));

                if (el.bgColor !== 'transparent') {
                    ctx.fillStyle = el.bgColor;
                    ctx.fillRect(-wrapWidth / 2 - 12, -boxHeight / 2 - 6, wrapWidth + 24, boxHeight + 12);
                }

                const outlineColor = el.strokeColor || (el.color === '#ffffff' ? '#000000' : '#ffffff');
                const outlineOffset = el.fontSize / 20;
                const lineOffset = (lineHeight - el.fontSize) / 2;
                lines.forEach((line, i) => {
                    const y = contentTop + i * lineHeight + lineOffset;
                    if (outlineOffset > 0) {
                        ctx.fillStyle = outlineColor;
                        ctx.fillText(line, textX - outlineOffset, y - outlineOffset);
                        ctx.fillText(line, textX + outlineOffset, y - outlineOffset);
                        ctx.fillText(line, textX - outlineOffset, y + outlineOffset);
                        ctx.fillText(line, textX + outlineOffset, y + outlineOffset);
                    }
                    ctx.fillStyle = el.color;
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
        if (selectedEl) {
            const box = getElementBox(ctx, selectedEl);
            const handleRadius = isNarrow ? 16 : 10;

            ctx.save();
            ctx.translate(box.cx, box.cy);
            ctx.rotate(degToRad(box.rotation));
            ctx.strokeStyle = '#ff6b00';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 8]);
            ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
            ctx.setLineDash([]);

            (Object.keys(HANDLE_SIGNS) as ResizeHandle[]).forEach((handle) => {
                const { sx, sy } = HANDLE_SIGNS[handle];
                const hx = sx * (box.width / 2);
                const hy = sy * (box.height / 2);
                ctx.beginPath();
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#ff6b00';
                ctx.lineWidth = 3;
                ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            ctx.restore();
        }
    }, [image, elements, selectedId, editingTextId, drawingStrokes, currentStroke, drawColor, brushSize, drawMode, drawLayer, viewportKey]);



    // Handlers
	    const firstTapTextAddedRef = useRef(false);

    const handleAddText = () => {
        if (!image) return;
        const fontSize = getDefaultFontSize();
        const maxWrapWidth = Math.max(80, image.width - TEXT_BOX_PADDING * 2 - 16);
        const maxBoxHeight = Math.max(60, image.height - TEXT_BOX_PADDING * 2 - 16);
        const newEl: TextElement = {
            id: `text-${Date.now()}`,
            type: 'text',
            content: '',
            x: image.width / 2,
            y: image.height / 2,
            fontSize,
            maxFontSize: fontSize,
            color: '#ffffff',
            strokeColor: '#000000',
            fontFamily: DEFAULT_FONT_STACK,
            wrapWidth: clamp(image.width * 0.4, 80, maxWrapWidth),
            boxHeight: clamp(Math.max(Math.round(fontSize * 1.6), 60), 60, maxBoxHeight),
            bgColor: 'transparent',
            rotation: 0,
            align: 'center',
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
        setEditingTextId(newEl.id);
        firstTapTextAddedRef.current = true;
        console.debug("[text] add", { id: newEl.id, fontSize: newEl.fontSize, wrapWidth: newEl.wrapWidth, boxHeight: newEl.boxHeight, x: newEl.x, y: newEl.y });
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

        // First tap: auto-add a text box once
        if (!firstTapTextAddedRef.current && elements.every(el => el.type !== 'text')) {
            handleAddText();
            return;
        }

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
                const handleHitRadius = isNarrow ? 28 : 18;
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
	                                ? {
	                                      x: selectedEl.x,
	                                      y: selectedEl.y,
	                                      fontSize: selectedEl.fontSize,
	                                      maxFontSize: selectedEl.maxFontSize ?? selectedEl.fontSize,
	                                      wrapWidth: box.width - TEXT_BOX_PADDING * 2,
	                                      boxHeight: box.height - TEXT_BOX_PADDING * 2,
	                                  }
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
            const ctx = canvasRef.current?.getContext('2d') ?? null;

            const safeStartWidth = Math.max(1, resize.startBox.width);
            const safeStartHeight = Math.max(1, resize.startBox.height);
            const scaleX = Math.abs(diffLocal.x) / safeStartWidth;
            const scaleY = Math.abs(diffLocal.y) / safeStartHeight;
            const uniformScale = Math.max(0.1, Math.max(scaleX, scaleY));

            const newHalfW = (resize.startBox.width * uniformScale) / 2;
            const newHalfH = (resize.startBox.height * uniformScale) / 2;
            const centerOffset = rotatePoint({ x: sx * newHalfW, y: sy * newHalfH }, r);
            const uniformNextCenter = { x: resize.fixedCorner.x + centerOffset.x, y: resize.fixedCorner.y + centerOffset.y };

            setElements((prev) =>
                prev.map((el) => {
                    if (el.id !== resize.elementId) return el;
                    if (el.type === 'text' && image) {
                        const minWrapWidth = 60;
                        const minBoxHeight = 20;
                        const maxWrapWidth = Math.max(minWrapWidth, image.width - TEXT_BOX_PADDING * 2 - 16);
                        const maxBoxHeight = Math.max(minBoxHeight, image.height - TEXT_BOX_PADDING * 2 - 16);

                        const boxWidth = clamp(
                            Math.abs(diffLocal.x),
                            TEXT_BOX_PADDING * 2 + minWrapWidth,
                            TEXT_BOX_PADDING * 2 + maxWrapWidth
                        );
                        const boxHeight = clamp(
                            Math.abs(diffLocal.y),
                            TEXT_BOX_PADDING * 2 + minBoxHeight,
                            TEXT_BOX_PADDING * 2 + maxBoxHeight
                        );

                        const nextCenter = { x: (resize.fixedCorner.x + x) / 2, y: (resize.fixedCorner.y + y) / 2 };
                        const nextWrapWidth = clamp(boxWidth - TEXT_BOX_PADDING * 2, minWrapWidth, maxWrapWidth);
                        const nextBoxHeight = clamp(boxHeight - TEXT_BOX_PADDING * 2, minBoxHeight, maxBoxHeight);

                        const startWrapWidth = Math.max(1, resize.start.wrapWidth ?? nextWrapWidth);
                        const startBoxHeight = Math.max(1, resize.start.boxHeight ?? nextBoxHeight);
                        const startFontSize = resize.start.fontSize ?? el.fontSize;
                        const maxFontSize =
                            typeof el.maxFontSize === 'number' && Number.isFinite(el.maxFontSize)
                                ? el.maxFontSize
                                : (resize.start.maxFontSize ?? startFontSize);
                        const widthScale = Math.max(0.25, nextWrapWidth / startWrapWidth);
                        const heightScale = Math.max(0.25, nextBoxHeight / startBoxHeight);
                        const weightedScale = Math.exp(0.25 * Math.log(widthScale) + 0.75 * Math.log(heightScale));
                        const nextFontSize = clamp(startFontSize * weightedScale, 2, maxFontSize);
                        const updated: TextElement = {
                            ...el,
                            x: nextCenter.x,
                            y: nextCenter.y,
                            fontSize: nextFontSize,
                            wrapWidth: nextWrapWidth,
                            boxHeight: nextBoxHeight,
                        };
                        return constrainElementToImage(ctx, updated, image.width, image.height, overflowRatio) as TextElement;
                    }
                    if (el.type === 'emoji' && resize.start.size) {
                        const updated: EmojiElement = {
                            ...el,
                            x: uniformNextCenter.x,
                            y: uniformNextCenter.y,
                            size: Math.max(20, resize.start.size * uniformScale),
                        };
                        return image
                            ? (constrainElementToImage(ctx, updated, image.width, image.height, overflowRatio) as EmojiElement)
                            : updated;
                    }
                    if (el.type === 'image' && resize.start.width && resize.start.height) {
                        const updated: ImageElement = {
                            ...el,
                            x: uniformNextCenter.x,
                            y: uniformNextCenter.y,
                            width: Math.max(20, resize.start.width * uniformScale),
                            height: Math.max(20, resize.start.height * uniformScale),
                        };
                        return image
                            ? (constrainElementToImage(ctx, updated, image.width, image.height, overflowRatio) as ImageElement)
                            : updated;
                    }
                    return el;
                })
            );
            return;
        }

        // Element dragging
        if (!isDragging || !selectedId) return;

        const ctx = canvasRef.current?.getContext('2d') ?? null;
        setElements((prev) =>
            prev.map((el) => {
                if (el.id !== selectedId) return el;
                const next = { ...el, x: x - dragOffset.x, y: y - dragOffset.y } as CanvasElement;
                return image ? constrainElementToImage(ctx, next, image.width, image.height, overflowRatio) : next;
            })
        );
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
            const shouldClear = clicked.isPlaceholder || clicked.content === 'DOUBLE TAP';
            if (shouldClear) {
                updateTextContent(clicked.id, '');
            }
            setEditingTextId(clicked.id);
        }
    };

    const handleSave = () => {
        if (!canvasRef.current) return;
        setSelectedId(null);
        setEditingTextId(null);
        // Wait for render cycle to clear selection box
        setTimeout(() => {
            const canvas = canvasRef.current!;
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
            const upload = generateShareImage(canvas);
            setPreviewUrl(jpegUrl);
            setShareImageData(upload.dataUrl);
            setShareImageBytes(upload.base64Bytes);
            setPostError(null);
            setPostSuccessUrl(null);
            setPostCompleted(false);
            setShowSaveModal(true);
        }, 50);
    };

    const handleDelete = () => {
        if (selectedId) {
            setElements(prev => prev.filter(el => el.id !== selectedId));
            setSelectedId(null);
        }
    };

    const handlePostToReddit = async (mode: 'link' | 'custom') => {
        if (postCompleted) return;
        if (!shareImageData) {
            setPostError('Please generate a meme first.');
            return;
        }
        if (!sessionInfo?.loggedIn) {
            setPostError('Log in to Reddit to share your meme.');
            return;
        }
        if (overLimit) {
            setPostError('Meme is over the 2.5 MB upload cap. Try simplifying your design or downloading instead.');
            return;
        }

        const title = postTitle.trim();
        if (!title) {
            setPostError('Enter a title before posting.');
            return;
        }

        const key = `post-${mode}`;
        setPostingKey(key);
        setPostError(null);
        setPostSuccessUrl(null);
        try {
            const res = await fetch('/api/post-meme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64Image: shareImageData,
                    title,
                    postMode: mode,
                }),
            });
            const data = (await res.json()) as PostMemeResponse;
            if (!res.ok || data.status !== 'success') {
                throw new Error(data.status === 'error' ? data.message : 'Failed to post meme.');
            }
            setPostSuccessUrl(data.url);
            setPostCompleted(true);
            window.open(data.url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            setPostError(error instanceof Error ? error.message : 'Failed to post meme.');
        } finally {
            setPostingKey(null);
        }
    };

    const postingSubredditLabel = sessionInfo?.subreddit ? `r/${sessionInfo.subreddit}` : 'this community';
    const overLimit = shareImageBytes !== null && shareImageBytes > BASE64_UPLOAD_LIMIT_BYTES;
    const canPostMeme = Boolean(sessionInfo?.loggedIn && shareImageData && postTitle.trim() && !overLimit);
    const hasTitle = Boolean(postTitle.trim());
    const postCreated = Boolean(postSuccessUrl);
    const postingHint = !sessionInfo?.loggedIn
        ? 'Log in with Reddit to post directly.'
        : overLimit
            ? 'This meme is too large to upload. Try simplifying or download it instead.'
        : '';
    const actionIsPosting = (key: string) => postingKey === key;
    const overflowRatio = isNarrow ? 0.2 : 0;

    const updateTextContent = (id: string, content: string) => {
        setElements((prev) =>
            prev.map((el) => {
                if (el.id !== id || el.type !== 'text') return el;
                const next = { ...el, content, align: 'center', isPlaceholder: false };
                console.debug("[text] update content", { id, length: content.length, wrapWidth: next.wrapWidth, boxHeight: next.boxHeight });
                return next;
            })
        );
    };

    // Style helpers
    const updateStyle = (key: keyof TextElement | keyof EmojiElement | keyof ImageElement, value: any) => {
        if (!selectedId) return;
        const ctx = canvasRef.current?.getContext('2d') ?? null;
        setElements((prev) =>
            prev.map((el) => {
                if (el.id !== selectedId) return el;
                const next = { ...el, [key]: value } as CanvasElement;
                return image ? constrainElementToImage(ctx, next, image.width, image.height, overflowRatio) : next;
            })
        );
    };

    const updateTextMaxFontSize = (id: string, value: number) => {
        const ctx = canvasRef.current?.getContext('2d') ?? null;
        const nextMaxFontSize = Math.max(2, Math.round(value));
        setElements((prev) =>
            prev.map((el) => {
                if (el.id !== id || el.type !== 'text') return el;
                const next: TextElement = {
                    ...el,
                    maxFontSize: nextMaxFontSize,
                    fontSize: nextMaxFontSize,
                };
                return image
                    ? (constrainElementToImage(ctx, next, image.width, image.height, overflowRatio) as TextElement)
                    : next;
            })
        );
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

    const handleSaveTemplateLayout = async () => {
        if (!templateMode) return;
        if (!templateId) {
            setTemplateSaveStatus("No template id available for saving.");
            return;
        }
        const textBoxes = elements.filter((el): el is TextElement => el.type === 'text');
        if (textBoxes.length === 0) {
            setTemplateSaveStatus("Add at least one text box before saving.");
            return;
        }
        const payload = {
            templateId,
            boxes: textBoxes.map((el) => ({
                x: el.x,
                y: el.y,
                wrapWidth: el.wrapWidth,
                boxHeight: el.boxHeight,
                fontSize: el.fontSize,
                maxFontSize: el.maxFontSize,
                align: 'center',
                rotation: el.rotation,
                fontFamily: el.fontFamily,
                color: el.color,
                strokeColor: el.strokeColor,
                bgColor: el.bgColor,
                content: el.content,
            })),
        };
        try {
            setSavingTemplate(true);
            setTemplateSaveStatus(null);
            const res = await fetch("/api/template-layouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            setTemplateSaveStatus("Template layout saved.");
            setTemplateLayouts((prev) => ({
                ...prev,
                [templateId]: { boxes: payload.boxes },
            }));
        } catch (err) {
            setTemplateSaveStatus(err instanceof Error ? err.message : "Failed to save template layout.");
        } finally {
            setSavingTemplate(false);
        }
    };

    const selectedElement = elements.find(el => el.id === selectedId);
    const editingElement = elements.find(el => el.id === editingTextId) as TextElement | undefined;
    const editingStrokeColor =
        editingElement?.strokeColor || (editingElement?.color === '#ffffff' ? '#000000' : '#ffffff');
    const editingMetrics = (() => {
        if (!editingElement || !image || !canvasRef.current) return null;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return null;
        const { lineHeight, height: contentHeight, wrapWidth } = getTextMetrics(ctx, editingElement);
        const boxHeight = Math.max(
            20,
            typeof editingElement.boxHeight === 'number' && Number.isFinite(editingElement.boxHeight)
                ? editingElement.boxHeight
                : Math.max(editingElement.fontSize * 1.6, 60)
        );
        return { wrapWidth, lineHeight, contentHeight, boxHeight };
    })();

    const editingTextareaWidthPx = (() => {
        if (!editingElement || !image) return 0;
        const canvasCssWidth = image.width * scale;
        const baseWrap =
            typeof editingElement.wrapWidth === 'number' && Number.isFinite(editingElement.wrapWidth)
                ? editingElement.wrapWidth
                : Math.max(120, editingElement.fontSize * 6);
        const desiredPx = baseWrap * scale;
        return clamp(desiredPx, 1, canvasCssWidth);
    })();
    const editingContentHeightPx = editingMetrics ? editingMetrics.contentHeight * scale : 0;
    const editingTextareaHeightPx = editingMetrics ? Math.max(editingMetrics.boxHeight * scale, editingContentHeightPx) : editingContentHeightPx;
    const editingTextareaLeftPx = (() => {
        if (!editingElement) return 0;
        return editingElement.x * scale;
    })();
    const editingTextareaTopPx = (() => {
        if (!editingElement) return 0;
        return editingElement.y * scale;
    })();
    const editingPaddingPx = (() => {
        if (!editingMetrics) return { top: 0, bottom: 0 };
        const boxPx = editingTextareaHeightPx;
        const contentPx = editingContentHeightPx;
        const pad = Math.max(0, (boxPx - contentPx) / 2);
        return { top: pad, bottom: pad };
    })();

    let panelContent: React.ReactNode = null;

    if (activeTool === 'add-emoji') {
        panelContent = (
            <div className="p-2">
                <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2 px-1">Pick an emoji</p>
                <div
                    className="max-h-64 overflow-y-auto overflow-x-hidden pb-1"
                    style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                >
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-9 lg:grid-cols-10 gap-1">
                        {POPULAR_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleAddEmoji(emoji)}
                                className="text-xl hover:bg-white/10 p-1.5 rounded-lg transition-colors active:scale-95 bg-white/5 shadow-sm"
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
	                <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2 px-1">Add assets</p>
	                <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
	                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
	                        {STICKERS.map((item) => (
	                            <button
	                                key={item.src}
	                                onClick={() => handleAddImage(item.src)}
	                                className="aspect-square bg-white/5 hover:bg-white/10 rounded-lg p-2 flex items-center justify-center transition-colors active:scale-95"
	                            >
	                                <img src={item.src} alt={item.name} className="w-full h-full object-contain" />
	                            </button>
	                        ))}
	                    </div>
	                    <div className="space-y-1">
	                        <p className="text-[10px] text-white/50 uppercase tracking-wide px-1">NFL</p>
	                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
	                            {NFL_LOGOS.map((item) => (
	                                <button
	                                    key={item.src}
	                                    onClick={() => handleAddImage(item.src)}
	                                    className="aspect-square bg-white/5 hover:bg-white/10 rounded-lg p-2 flex items-center justify-center transition-colors active:scale-95"
	                                >
	                                    <img src={item.src} alt={item.name} className="w-full h-full object-contain" />
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
                        className="w-full accent-orange-500 h-1"
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
                <div className="p-2 pb-3 space-y-1">
                <div className="flex items-center justify-between">
                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Layer</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => moveSelectedLayer('back')}
                            className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => moveSelectedLayer('front')}
                            className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Front
                        </button>
                    </div>
                </div>
                <div className="space-y-0.5">
                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Text</p>
		                    <div className="grid grid-cols-7 gap-0.5">
		                        {['#ffffff', '#000000', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((c) => (
		                            <button
		                                key={c}
		                                onClick={() => updateStyle('color', c)}
		                                className={clsx(
		                                    "w-4 h-4 rounded border-2 transition-transform mx-auto",
		                                    selectedElement.color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
		                                )}
		                                style={{ backgroundColor: c }}
		                            />
		                        ))}
		                    </div>
		                </div>
		                <div className="space-y-0.5">
		                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Border</p>
		                    <div className="grid grid-cols-7 gap-0.5">
		                        {['#000000', '#ffffff', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((c) => (
		                            <button
		                                key={c}
		                                onClick={() => updateStyle('strokeColor', c)}
		                                className={clsx(
		                                    "w-4 h-4 rounded border-2 transition-transform mx-auto",
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
                <div className="space-y-0.5">
                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Size</p>
                    <input
                        type="range"
                        min="8"
                        max={getMaxFontSize()}
                        value={(selectedElement as TextElement).maxFontSize ?? (selectedElement as TextElement).fontSize}
                        onChange={(e) =>
                            updateTextMaxFontSize(
                                selectedElement.id,
                                clamp(Number(e.target.value), 8, getMaxFontSize())
                            )
                        }
                        className="w-full accent-orange-500 h-1"
                    />
                </div>
                {/* Alignment */}
                <div className="flex items-center justify-between">
                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Align</p>
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
                                    "w-7 h-6 flex items-center justify-center rounded border transition-colors",
                                    (selectedElement as TextElement).align === key
                                        ? "bg-white/10 border-white/40 text-white"
                                        : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                                )}
                            >
                                <Icon className="w-3 h-3" />
                            </button>
                        ))}
                    </div>
                </div>
                {/* Rotation */}
                <div className="space-y-0.5">
                    <p className="text-[8px] text-white/50 uppercase tracking-wide leading-none">Rotate</p>
                    <input
                        type="range"
                        min="-180" max="180"
                        value={(selectedElement as TextElement).rotation}
                    onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1"
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
                <p className="text-[9px] text-orange-300 uppercase tracking-wide font-bold">Emoji Size</p>
                <input
                    type="range"
                    min="20" max="150"
                    value={(selectedElement as EmojiElement).size}
                    onChange={(e) => updateStyle('size', parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1"
                />
                <p className="text-[9px] text-orange-300 uppercase tracking-wide font-bold">Rotation</p>
                <input
                    type="range"
                    min="-180" max="180"
                    value={(selectedElement as EmojiElement).rotation}
                    onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1"
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
                <p className="text-[9px] text-orange-300 uppercase tracking-wide font-bold">Asset Size</p>
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
                    className="w-full accent-orange-500 h-1"
                />
                <p className="text-[9px] text-orange-300 uppercase tracking-wide font-bold mt-2">Rotation</p>
                <input
                    type="range"
                    min="0"
                    max="360"
                    value={(selectedElement as ImageElement).rotation}
                    onChange={(e) => updateStyle('rotation', parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1"
                />
            </div>
        );
    }

    // Measure the bottom panel on desktop so the canvas resizes to sit above it.
    useEffect(() => {
        if (isNarrow || !panelContent) {
            setPanelHeight(0);
            return;
        }
        if (panelRef.current) {
            setPanelHeight(panelRef.current.getBoundingClientRect().height);
        }
    }, [panelContent, isNarrow]);

    const desktopBottomPadding = Math.max(280, panelHeight ? panelHeight + 56 : 0);
    const paddingTop = isNarrow ? 56 : 72;
    const paddingRight = isNarrow ? 80 : 120;
    const paddingBottom = isNarrow ? 140 : desktopBottomPadding;
    const paddingLeft = isNarrow ? 12 : 32;

    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            {/* Full-Screen Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 flex items-start justify-center bg-zinc-950"
                style={{
                    padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
                }}
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
                                textAlign: 'center',
                                resize: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'pre-wrap',
                                width: `${editingTextareaWidthPx}px`,
                                height: `${editingTextareaHeightPx}px`,
                                padding: 0,
                                paddingTop: `${editingPaddingPx.top}px`,
                                paddingBottom: `${editingPaddingPx.bottom}px`,
                                margin: 0,
                                lineHeight: editingMetrics ? `${editingMetrics.lineHeight * scale}px` : 1.12,
                            }}
                        onInput={() => {
                            if (editingMetrics) {
                                console.debug("[text] textarea", {
                                    id: editingElement.id,
                                    wrapWidth: editingMetrics.wrapWidth,
                                    heightPx: editingTextareaHeightPx,
                                    paddingTop: editingPaddingPx.top,
                                    paddingBottom: editingPaddingPx.bottom,
                                    lineHeight: editingMetrics.lineHeight,
                                    contentLength: editingElement.content.length,
                                });
                            }
                        }}
                        />
                    )}
                    </div>

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
                <div className="flex items-center gap-2">
                    {templateMode && (
                        <button
                            onClick={handleSaveTemplateLayout}
                            disabled={savingTemplate}
                            className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1.5 shadow-lg border border-white/15"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{savingTemplate ? 'Saving…' : 'Save Layout'}</span>
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 rounded-full bg-[#ff4500] text-white text-xs font-bold hover:bg-[#ff5c1c] transition-colors flex items-center gap-1.5 shadow-lg"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>{`Post to ${postingSubredditLabel}`}</span>
                    </button>
                </div>
            </div>
            {templateMode && templateSaveStatus && (
                <div className="absolute top-14 right-3 z-30 text-xs text-white/80 bg-black/50 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
                    {templateSaveStatus}
                </div>
            )}

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
                            activeTool === 'add-text' ? "bg-[#ff4500] text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
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
                            activeTool === 'add-emoji' ? "bg-[#ff4500] text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
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
                            activeTool === 'add-image' ? "bg-[#ff4500] text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-[9px]">Assets</span>
                    </button>

                    {/* Draw Tool */}
                    <button
                        onClick={() => toggleTool('draw')}
                        className={clsx(
                            "w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-all text-xs gap-1",
                            activeTool === 'draw' ? "bg-[#ff4500] text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
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
                    <div className="max-w-5xl mx-auto" ref={panelRef}>
                        <div className="pointer-events-auto bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
                            {panelContent}
                        </div>
                    </div>
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && previewUrl && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in zoom-in-95 duration-200">
                    <div className="bg-[#09090f] border border-white/5 rounded-3xl px-5 py-5 sm:py-6 w-full max-w-md text-left shadow-[0_25px_70px_rgba(0,0,0,0.65)] relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowSaveModal(false)}
                            className="absolute top-5 right-5 text-white/40 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-4">
                            <div className="space-y-1 pr-8">
                                <h3 className="text-2xl font-bold text-white">Post meme</h3>
                                <p className="text-sm text-white/70">
                                    Posting to <span className="font-semibold text-[#ff4500]">{postingSubredditLabel}</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">Title</p>
                                <input
                                    type="text"
                                    value={postTitle}
                                    onChange={(e) => setPostTitle(e.target.value)}
                                    maxLength={300}
                                    placeholder="Add a title to unlock posting..."
                                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-base text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff4500]/60"
                                />
                                {postingHint && <p className="text-xs text-white/50">{postingHint}</p>}
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                                <div className="flex items-center justify-center max-h-44">
                                    <img src={previewUrl} alt="Meme" className="w-full max-h-44 object-contain" />
                                </div>
                            </div>

                            {postError && <p className="text-sm text-red-400">{postError}</p>}

                            <button
                                onClick={() => handlePostToReddit('link')}
                                disabled={!canPostMeme || actionIsPosting('post-link') || postCompleted}
                                className={clsx(
                                    "w-full py-3 rounded-2xl font-semibold text-base transition-colors",
                                    canPostMeme && !actionIsPosting('post-link') && !postCompleted
                                        ? "bg-[#ff4500] text-white hover:bg-[#ff571a]"
                                        : "bg-white/10 text-white/40 cursor-not-allowed"
                                )}
                            >
                                {postCompleted
                                    ? 'Finished Post'
                                    : actionIsPosting('post-link')
                                        ? 'Posting…'
                                        : `Post to ${postingSubredditLabel}`}
                            </button>

                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="w-full py-2.5 rounded-2xl bg-transparent border border-white/10 text-sm font-semibold text-white hover:border-white/30 transition-colors"
                            >
                                Discard
                            </button>
                            {postSuccessUrl && (
                                <a
                                    href={postSuccessUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center text-xs text-white/60 hover:text-white"
                                >
                                    View your post on Reddit ↗
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
