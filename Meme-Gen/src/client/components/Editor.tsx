import React, { useEffect, useRef, useState } from 'react';
import { Download, Type, Trash2, X, ChevronLeft, Smile, Pencil, RotateCcw, Image as ImageIcon } from 'lucide-react';
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
    color: string;
    bgColor: string;
    rotation: number;
}

interface EmojiElement {
    id: string;
    type: 'emoji';
    emoji: string;
    x: number;
    y: number;
    size: number;
}

interface DrawingStroke {
    points: { x: number; y: number }[];
    color: string;
    lineWidth: number;
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

const POPULAR_EMOJIS = ['😂', '😍', '🔥', '💯', '👍', '😭', '🙏', '💀', '😎', '🤔', '😱', '🎉', '👀', '🧠', '🤡', '💩'];

const STICKERS = [
    { name: 'Speech Bubble', src: '/stickers/sticker_speech_bubble_1_1764881023554.png' },
    { name: 'Thought Cloud', src: '/stickers/sticker_speech_bubble_2_1764881039454.png' },
    { name: 'Up Arrow', src: '/stickers/sticker_arrow_up_1764881051412.png' },
    { name: 'Down Arrow', src: '/stickers/sticker_arrow_down_1764881063242.png' },
    { name: 'Sunglasses', src: '/stickers/sticker_sunglasses_1764881076117.png' },
    { name: 'Santa Hat', src: '/stickers/sticker_santa_hat_1764881088225.png' },
    { name: 'Fire', src: '/stickers/sticker_fire_1764881100984.png' },
];

export function Editor({ templateSrc, onBack }: EditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1); // Track scale for positioning
    const [viewportKey, setViewportKey] = useState(0);
    const [isNarrow, setIsNarrow] = useState(false);

    // UI State
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveUrl, setSaveUrl] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool>(null); // Which tool panel is expanded

    // Drawing State
    const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawColor, setDrawColor] = useState('#ff0000');
    const [brushSize, setBrushSize] = useState(3);

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

            // Set display size
            canvas.style.width = `${image.width * newScale}px`;
            canvas.style.height = `${image.height * newScale}px`;

            // Set actual size
            canvas.width = image.width;
            canvas.height = image.height;
        }

        // Draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        elements.forEach(el => {
            // Don't draw the text being edited (it will be covered by the textarea)
            if (el.id === editingTextId) return;

            ctx.save();
            if (el.type === 'text') {
                ctx.translate(el.x, el.y);
                ctx.rotate((el.rotation * Math.PI) / 180);
                ctx.font = `900 ${el.fontSize}px Impact, Arial Black, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Background
                if (el.bgColor !== 'transparent') {
                    const metrics = ctx.measureText(el.content);
                    ctx.fillStyle = el.bgColor;
                    ctx.fillRect(-metrics.width / 2 - 10, -el.fontSize / 2 - 5, metrics.width + 20, el.fontSize + 10);
                }

                // Text
                ctx.fillStyle = el.color;
                ctx.strokeStyle = el.color === '#ffffff' ? '#000000' : '#ffffff';
                ctx.lineWidth = el.fontSize / 20;
                ctx.strokeText(el.content, 0, 0);
                ctx.fillText(el.content, 0, 0);
            } else if (el.type === 'emoji') {
                ctx.font = `${el.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.emoji, el.x, el.y);
            } else if (el.type === 'image' && el.imgObject) {
                ctx.translate(el.x, el.y);
                ctx.rotate((el.rotation * Math.PI) / 180);
                // Draw image centered
                try {
                    ctx.drawImage(el.imgObject, -el.width / 2, -el.height / 2, el.width, el.height);
                } catch (e) {
                    console.error("Error drawing image", e);
                }
            }
            ctx.restore();

            // Selection Box
            if (el.id === selectedId && el.id !== editingTextId) {
                ctx.save();
                ctx.strokeStyle = '#a855f7'; // Purple-500
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 10]);
                if (el.type === 'text') {
                    // Note: Text selection box is approximate in this simple implementation
                    // For better text box, we'd use measureText but we need the rect for hit testing too
                    const metrics = ctx.measureText(el.content);
                    ctx.strokeRect(el.x - metrics.width / 2 - 10, el.y - el.fontSize / 2 - 10, metrics.width + 20, el.fontSize + 20);
                } else if (el.type === 'emoji') {
                    const size = el.size;
                    ctx.strokeRect(el.x - size / 2, el.y - size / 2, size, size);
                } else if (el.type === 'image') {
                    ctx.translate(el.x, el.y);
                    ctx.rotate((el.rotation * Math.PI) / 180);
                    ctx.strokeRect(-el.width / 2, -el.height / 2, el.width, el.height);
                }
                ctx.restore();
            }
        });

        // Draw strokes
        drawingStrokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            ctx.save();
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

        // Draw current stroke being drawn
        if (currentStroke && currentStroke.length > 1) {
            ctx.save();
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            const firstPoint = currentStroke[0];
            if (firstPoint) ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < currentStroke.length; i++) {
                const point = currentStroke[i];
                if (point) ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }, [image, elements, selectedId, editingTextId, drawingStrokes, currentStroke, drawColor, brushSize, viewportKey]);



    // Handlers
    const handleAddText = () => {
        if (!image) return;
        const newEl: TextElement = {
            id: `text-${Date.now()}`,
            type: 'text',
            content: 'DOUBLE TAP',
            x: image.width / 2,
            y: image.height / 2,
            fontSize: 60,
            color: '#ffffff',
            bgColor: 'transparent',
            rotation: 0,
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
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
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

        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
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

        // Find clicked element (reverse order for z-index)
        // Find clicked element (reverse order for z-index)
        const clicked = [...elements].reverse().find(el => {
            if (el.type === 'text') {
                // Approximate hit box for text
                return Math.abs(x - el.x) < el.fontSize * 2 && Math.abs(y - el.y) < el.fontSize;
            } else if (el.type === 'emoji') {
                return Math.abs(x - el.x) < el.size / 2 && Math.abs(y - el.y) < el.size / 2;
            } else if (el.type === 'image') {
                return Math.abs(x - el.x) < el.width / 2 && Math.abs(y - el.y) < el.height / 2;
            }
            return false;
        });

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
                lineWidth: brushSize
            }]);
        }
        setIsDrawing(false);
        setCurrentStroke(null);
        setIsDragging(false);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const coords = getCanvasCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        const clicked = [...elements].reverse().find(el => {
            if (el.type === 'text') {
                return Math.abs(x - el.x) < el.fontSize * 2 && Math.abs(y - el.y) < el.fontSize;
            } else if (el.type === 'emoji') {
                return Math.abs(x - el.x) < el.size / 2 && Math.abs(y - el.y) < el.size / 2;
            } else if (el.type === 'image') {
                return Math.abs(x - el.x) < el.width / 2 && Math.abs(y - el.y) < el.height / 2;
            }
            return false;
        });

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

    const selectedElement = elements.find(el => el.id === selectedId);
    const editingElement = elements.find(el => el.id === editingTextId) as TextElement | undefined;

    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            {/* Full-Screen Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 flex items-center justify-center bg-zinc-950"
                style={{ padding: isNarrow ? '12px 80px 12px 12px' : '24px 96px 24px 24px' }} // leave room for right column
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
                            value={editingElement.content}
                            onChange={(e) => updateTextContent(editingElement.id, e.target.value)}
                            onBlur={() => setEditingTextId(null)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    setEditingTextId(null);
                                }
                            }}
                            autoFocus
                            style={{
                                position: 'absolute',
                                left: `${editingElement.x * scale}px`,
                                top: `${editingElement.y * scale}px`,
                                transform: `translate(-50%, -50%) rotate(${editingElement.rotation}deg)`,
                                fontSize: `${editingElement.fontSize * scale}px`,
                                color: editingElement.color,
                                fontFamily: 'Impact, Arial Black, sans-serif',
                                fontWeight: 900,
                                textShadow: editingElement.color === '#ffffff'
                                    ? `-${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 #000, ${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 #000, -${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 #000, ${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 #000`
                                    : `-${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 #fff, ${editingElement.fontSize * scale / 20}px -${editingElement.fontSize * scale / 20}px 0 #fff, -${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 #fff, ${editingElement.fontSize * scale / 20}px ${editingElement.fontSize * scale / 20}px 0 #fff`,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                textAlign: 'center',
                                resize: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'pre',
                                width: '1000px',
                                height: 'auto',
                                padding: 0,
                                margin: 0,
                                lineHeight: 1,
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
                <div className="border-t border-white/10">
                    {/* Emoji Picker Panel */}
                    {activeTool === 'add-emoji' && (
                        <div className="p-2">
                            <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                                {POPULAR_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleAddEmoji(emoji)}
                                        className="text-2xl hover:bg-white/10 p-1.5 rounded-lg transition-colors active:scale-95"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Image Picker Panel */}
                    {activeTool === 'add-image' && (
                        <div className="p-2">
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                {STICKERS.map((sticker, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAddImage(sticker.src)}
                                        className="aspect-square bg-white/5 hover:bg-white/10 rounded-lg p-2 flex items-center justify-center transition-colors active:scale-95"
                                    >
                                        <img src={sticker.src} alt={sticker.name} className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Drawing Controls Panel */}
                    {activeTool === 'draw' && (
                        <div className="p-3 space-y-3">
                            {/* Color Picker */}
                            <div className="space-y-1.5">
                                <p className="text-[9px] text-white/50 uppercase tracking-wide">Color</p>
                                <div className="grid grid-cols-3 gap-1.5">
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

                            {/* Brush Size */}
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
                        </div>
                    )}

                    {/* Element Style Panel (when element selected) */}
                    {selectedElement && selectedElement.type === 'text' && (
                        <div className="p-3 space-y-3 border-t border-white/10">
                            <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold">Text Style</p>
                            {/* Color Swatches */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {['#ffffff', '#000000', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => updateStyle('color', c)}
                                        className={clsx(
                                            "w-full aspect-square rounded-lg border-2 transition-transform",
                                            selectedElement.color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            {/* Font Size */}
                            <div className="space-y-1.5">
                                <p className="text-[9px] text-white/50 uppercase tracking-wide">Font Size</p>
                                <input
                                    type="range"
                                    min="20" max="150"
                                    value={(selectedElement as TextElement).fontSize}
                                    onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                                    className="w-full accent-purple-500 h-1"
                                />
                            </div>
                        </div>
                    )}

                    {/* Emoji Size Panel (when emoji selected) */}
                    {selectedElement && selectedElement.type === 'emoji' && (
                        <div className="p-3 space-y-3 border-t border-white/10">
                            <p className="text-[9px] text-purple-400 uppercase tracking-wide font-bold">Emoji Size</p>
                            <input
                                type="range"
                                min="20" max="150"
                                value={(selectedElement as EmojiElement).size}
                                onChange={(e) => updateStyle('size', parseInt(e.target.value))}
                                className="w-full accent-purple-500 h-1"
                            />
                        </div>
                    )}

                    {/* Image Size Panel (when image selected) */}
                    {selectedElement && selectedElement.type === 'image' && (
                        <div className="p-3 space-y-3 border-t border-white/10">
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
                    )}
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && saveUrl && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl relative">
                        <button
                            onClick={() => setShowSaveModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">Meme Ready! 🎉</h3>
                        <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800 mb-4">
                            <img src={saveUrl} alt="Meme" className="w-full rounded-lg" />
                        </div>
                        <p className="text-purple-400 font-medium text-sm mb-6 bg-purple-500/10 py-2 rounded-lg">
                            Long-press or Right-click image to Save
                        </p>
                        <button onClick={() => setShowSaveModal(false)} className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
