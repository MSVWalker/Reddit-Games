// Advanced Image Markup Editor - Production Ready
// Instagram-style draggable text, emojis, and sophisticated controls
import './game.css';

interface TextElement {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bgColor: string;
  bold: boolean;
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

type CanvasElement = TextElement | EmojiElement;

// State
let currentTemplate: HTMLImageElement | null = null;
let elements: CanvasElement[] = [];
let selectedElementId: string | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let nextId = 1;

// Popular emojis for quick access
const POPULAR_EMOJIS = ['😂', '😍', '🔥', '💯', '👍', '😭', '🙏', '💀', '😎', '🤔', '😱', '🎉'];

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
  'Gestures': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '🤲'],
  'Emotions': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'],
  'Symbols': ['🔥', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️', '🗨️', '💭', '💤', '✨', '⭐', '🌟', '💫', '🔆', '🔅', '💡']
};

// Elements
const galleryView = document.getElementById('gallery-view');
const editorView = document.getElementById('editor-view');
const templateGrid = document.getElementById('template-grid');
const canvas = document.getElementById('meme-canvas') as HTMLCanvasElement;
const ctx = canvas?.getContext('2d');

const canvasWrapper = document.querySelector('.canvas-wrapper');
const backBtn = document.getElementById('back-btn');
const downloadBtn = document.getElementById('download-btn');
const addTextBtn = document.getElementById('add-text-btn');
const addEmojiBtn = document.getElementById('add-emoji-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const emojiPanel = document.getElementById('emoji-panel');
const stylePanel = document.getElementById('style-panel');

// Templates
const TEMPLATES = [
  { src: '/template1.png', name: 'Reaction' },
  { src: '/template2.png', name: 'Comparison' },
  { src: '/template3.jpg', name: 'Urinals' },
  { src: '/toy-story.jpg', name: 'Toy Story' },
  { src: '/disaster-girl.jpg', name: 'Disaster Girl' },
  { src: '/uno-draw-25.jpg', name: 'UNO Draw 25' },
  { src: '/batman-slap.jpg', name: 'Batman Slap' },
  { src: '/left-exit.jpg', name: 'Left Exit 12' },
];

// Initialize Gallery
function initGallery() {
  templateGrid.innerHTML = '';
  TEMPLATES.forEach(template => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const img = document.createElement('img');
    img.src = template.src;
    img.alt = template.name;
    img.loading = 'lazy';
    card.appendChild(img);
    card.onclick = () => loadEditor(template.src);
    templateGrid.appendChild(card);
  });
}

// Load Editor
function loadEditor(src: string) {
  if (!canvas || !galleryView || !editorView) return;

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = src;

  img.onload = () => {
    currentTemplate = img;
    canvas.width = img.width;
    canvas.height = img.height;

    // Reset editor state
    elements = [];
    selectedElementId = null;

    renderCanvas();
    galleryView.classList.add('hidden');
    editorView.classList.remove('hidden');
  };
}

// Add Text Element
function addText() {
  const element: TextElement = {
    id: `text-${nextId++}`,
    type: 'text',
    content: 'Double-click to edit',
    x: canvas.width / 2,
    y: canvas.height / 2,
    fontSize: 48,
    color: '#ffffff',
    bgColor: 'transparent',
    bold: true,
    rotation: 0
  };
  elements.push(element);
  selectedElementId = element.id;
  renderCanvas();
}

// Add Emoji Element
function addEmoji(emoji: string) {
  const element: EmojiElement = {
    id: `emoji-${nextId++}`,
    type: 'emoji',
    emoji: emoji,
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 64
  };
  elements.push(element);
  selectedElementId = element.id;
  emojiPanel?.classList.add('hidden');
  renderCanvas();
}

// Render Canvas
function renderCanvas() {
  if (!currentTemplate || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentTemplate, 0, 0);

  // Render all elements
  elements.forEach(el => {
    if (el.type === 'text') {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(el.rotation * Math.PI / 180);

      const fontWeight = el.bold ? '900' : 'bold';
      ctx.font = `${fontWeight} ${el.fontSize}px Impact, Arial Black, sans-serif`;
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

      ctx.restore();
    } else if (el.type === 'emoji') {
      ctx.save();
      ctx.font = `${el.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.emoji, el.x, el.y);
      ctx.restore();
    }

    // Selection indicator
    if (el.id === selectedElementId) {
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      const size = el.type === 'text' ? el.fontSize : el.size;
      ctx.strokeRect(el.x - size, el.y - size, size * 2, size * 2);
      ctx.setLineDash([]);
    }
  });
}

// Get element at position
function getElementAtPosition(x: number, y: number): CanvasElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const size = el.type === 'text' ? el.fontSize : el.size;
    if (Math.abs(x - el.x) < size && Math.abs(y - el.y) < size) {
      return el;
    }
  }
  return null;
}

// Text Editor Modal logic
const textEditorModal = document.getElementById('text-editor-modal');
const textEditorInput = document.getElementById('text-editor-input') as HTMLTextAreaElement;
const closeTextEditorBtn = document.getElementById('close-text-editor');
const saveTextBtn = document.getElementById('save-text-btn');
const editTextBtn = document.getElementById('edit-text-btn');

function openTextEditor() {
  const element = elements.find(el => el.id === selectedElementId);
  if (element && element.type === 'text' && textEditorInput && textEditorModal) {
    textEditorInput.value = element.content;
    textEditorModal.classList.remove('hidden');
    textEditorInput.focus();
  }
}

function saveText() {
  const element = elements.find(el => el.id === selectedElementId);
  if (element && element.type === 'text' && textEditorInput) {
    const newText = textEditorInput.value;
    if (newText.trim()) {
      element.content = newText;
      renderCanvas();
    }
    textEditorModal?.classList.add('hidden');
  }
}

if (editTextBtn) editTextBtn.onclick = openTextEditor;
if (closeTextEditorBtn) closeTextEditorBtn.onclick = () => textEditorModal?.classList.add('hidden');
if (saveTextBtn) saveTextBtn.onclick = saveText;

// Canvas interaction
let lastClickTime = 0;
let lastClickElement: CanvasElement | null = null;

if (canvas) {
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const element = getElementAtPosition(x, y);
    const now = Date.now();

    // Double-click detection for text editing
    if (element && element.type === 'text' &&
      element === lastClickElement &&
      now - lastClickTime < 500) {
      // Double-click - open editor
      selectedElementId = element.id; // Ensure selected
      openTextEditor();
      lastClickTime = 0;
      lastClickElement = null;
      return;
    }

    lastClickTime = now;
    lastClickElement = element;

    if (element) {
      selectedElementId = element.id;
      isDragging = true;
      dragOffset = { x: x - element.x, y: y - element.y };
      renderCanvas();
      updateStylePanel();
    } else {
      selectedElementId = null;
      stylePanel?.classList.add('hidden');
      renderCanvas();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !selectedElementId) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const element = elements.find(el => el.id === selectedElementId);
    if (element) {
      element.x = x - dragOffset.x;
      element.y = y - dragOffset.y;
      renderCanvas();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Color presets (Instagram-style)
const COLOR_PRESETS = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
];

// Update style panel
function updateStylePanel() {
  const element = elements.find(el => el.id === selectedElementId);
  if (!element || element.type !== 'text') {
    stylePanel.classList.add('hidden');
    return;
  }

  stylePanel.classList.remove('hidden');
  (document.getElementById('font-size') as HTMLInputElement).value = element.fontSize.toString();

  // Update color swatch selections
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    const color = (swatch as HTMLElement).dataset.color;
    if (color === element.color) {
      swatch.classList.add('selected');
    } else {
      swatch.classList.remove('selected');
    }
  });

  document.querySelectorAll('.bg-swatch').forEach(swatch => {
    const color = (swatch as HTMLElement).dataset.color;
    if (color === element.bgColor) {
      swatch.classList.add('selected');
    } else {
      swatch.classList.remove('selected');
    }
  });
}

// Build emoji picker
function buildEmojiPicker() {
  const container = document.getElementById('emoji-categories')!;
  container.innerHTML = '';

  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    const section = document.createElement('div');
    section.className = 'emoji-category';

    const title = document.createElement('div');
    title.className = 'emoji-category-title';
    title.textContent = category;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.onclick = () => addEmoji(emoji);
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });
}

// Build color swatches
function buildColorSwatches() {
  const textColorContainer = document.getElementById('text-color-swatches')!;
  const bgColorContainer = document.getElementById('bg-color-swatches')!;

  textColorContainer.innerHTML = '';
  bgColorContainer.innerHTML = '';

  COLOR_PRESETS.forEach(color => {
    const textSwatch = document.createElement('div');
    textSwatch.className = 'color-swatch';
    textSwatch.dataset.color = color;
    textSwatch.style.background = color;
    textColorContainer.appendChild(textSwatch);

    const bgSwatch = document.createElement('div');
    bgSwatch.className = 'bg-swatch';
    bgSwatch.dataset.color = color;
    bgSwatch.style.background = color;
    bgColorContainer.appendChild(bgSwatch);
  });

  // Add transparent option for background
  const transparentSwatch = document.createElement('div');
  transparentSwatch.className = 'bg-swatch';
  transparentSwatch.dataset.color = 'transparent';
  transparentSwatch.style.background = 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)';
  transparentSwatch.style.backgroundSize = '10px 10px';
  transparentSwatch.style.backgroundPosition = '0 0, 5px 5px';
  transparentSwatch.title = 'Transparent';
  bgColorContainer.appendChild(transparentSwatch);
}

// Event listeners
if (backBtn) {
  backBtn.onclick = () => {
    editorView.classList.add('hidden');
    galleryView.classList.remove('hidden');
  };
}

// Save/Download logic
const saveModal = document.getElementById('save-modal');
const closeSaveBtn = document.getElementById('close-save-btn');
const finalImage = document.getElementById('final-image') as HTMLImageElement;

if (downloadBtn && saveModal && finalImage) {
  downloadBtn.onclick = () => {
    selectedElementId = null;
    renderCanvas();

    // Convert canvas to image (JPG as requested)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    finalImage.src = dataUrl;

    // Show modal
    saveModal.classList.remove('hidden');
  };
}

if (closeSaveBtn && saveModal) {
  closeSaveBtn.onclick = () => {
    saveModal.classList.add('hidden');
  };
}

// Close modal on outside click
if (saveModal) {
  saveModal.onclick = (e) => {
    if (e.target === saveModal) {
      saveModal.classList.add('hidden');
    }
  };
}

if (addTextBtn) addTextBtn.onclick = addText;

if (addEmojiBtn && emojiPanel) {
  addEmojiBtn.onclick = () => {
    emojiPanel.classList.remove('hidden');
  };
}

if (clearAllBtn) {
  clearAllBtn.onclick = () => {
    document.getElementById('clear-modal')?.classList.remove('hidden');
  };
}

// Clear Modal Logic
const clearModal = document.getElementById('clear-modal');
const confirmClearBtn = document.getElementById('confirm-clear-btn');
const cancelClearBtn = document.getElementById('cancel-clear-btn');
const closeClearBtn = document.getElementById('close-clear-btn');

if (confirmClearBtn) {
  confirmClearBtn.onclick = () => {
    elements = [];
    selectedElementId = null;
    stylePanel?.classList.add('hidden');
    renderCanvas();
    clearModal?.classList.add('hidden');
  };
}

if (cancelClearBtn) cancelClearBtn.onclick = () => clearModal?.classList.add('hidden');
if (closeClearBtn) closeClearBtn.onclick = () => clearModal?.classList.add('hidden');

// Close clear modal on outside click
if (clearModal) {
  clearModal.onclick = (e) => {
    if (e.target === clearModal) {
      clearModal.classList.add('hidden');
    }
  };
}

document.getElementById('delete-element')?.addEventListener('click', () => {
  if (selectedElementId) {
    elements = elements.filter(el => el.id !== selectedElementId);
    selectedElementId = null;
    stylePanel?.classList.add('hidden');
    renderCanvas();
  }
});

// Style controls
document.getElementById('font-size')?.addEventListener('input', (e) => {
  const element = elements.find(el => el.id === selectedElementId);
  if (element && element.type === 'text') {
    element.fontSize = parseInt((e.target as HTMLInputElement).value);
    renderCanvas();
  }
});

// Color swatch handlers
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('color-swatch')) {
    const color = target.dataset.color;
    const element = elements.find(el => el.id === selectedElementId);
    if (element && element.type === 'text' && color) {
      element.color = color;
      renderCanvas();
      updateStylePanel();
    }
  }

  if (target.classList.contains('bg-swatch')) {
    const color = target.dataset.color;
    const element = elements.find(el => el.id === selectedElementId);
    if (element && element.type === 'text' && color) {
      element.bgColor = color;
      renderCanvas();
      updateStylePanel();
    }
  }
});

// Initialize
if (templateGrid) initGallery();
if (document.getElementById('emoji-categories')) buildEmojiPicker();
if (document.getElementById('text-color-swatches')) buildColorSwatches();
console.log('🎨 Advanced Meme Editor loaded!');

