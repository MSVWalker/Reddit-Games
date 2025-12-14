export type SerializableCanvasText = {
  type: "text";
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor?: string;
  bgColor: string;
  rotation: number;
  align: "left" | "center" | "right";
  boxWidth: number;
  boxHeight: number;
};

export type SerializableCanvasEmoji = {
  type: "emoji";
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

export type SerializableCanvasImage = {
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type SerializableCanvasElement =
  | SerializableCanvasText
  | SerializableCanvasEmoji
  | SerializableCanvasImage;

export type SerializableStroke = {
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  mode: "draw" | "erase";
};

export type MemeRecipe = {
  templateId: string;
  backgroundUrl?: string;
  createdAt: string;
  elements: SerializableCanvasElement[];
  drawingStrokes: SerializableStroke[];
  canvasWidth?: number;
  canvasHeight?: number;
};
