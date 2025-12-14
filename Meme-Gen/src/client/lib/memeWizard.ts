import { showForm } from '@devvit/web/client';
import type { MemeRecipe } from '../../shared/types/meme';
import type { PostMemeResponse } from '../../shared/types/api';

type FormDefinition = Parameters<typeof showForm>[0];

const getSubmittedValues = async <T extends Record<string, unknown>>(
  form: FormDefinition
): Promise<T | null> => {
  const result = await showForm(form);
  if (result.action !== 'SUBMITTED') return null;
  return result.values as T;
};

type TemplateConfig = {
  id: string;
  label: string;
  asset: string; // path to template image in /memes
  layers: Array<{
    name: string;
    x: number; // normalized 0..1
    y: number; // normalized 0..1
    fontSize?: number;
    color?: string;
    align?: "left" | "center" | "right";
  }>;
};

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'am-i-the-only-one',
    label: 'Am I The Only One',
    asset: '/memes/am-i-the-only-one.jpg',
    layers: [
      { name: 'top', x: 0.5, y: 0.15, fontSize: 42, color: '#ffffff', align: 'center' },
      { name: 'bottom', x: 0.5, y: 0.85, fontSize: 42, color: '#ffffff', align: 'center' },
    ],
  },
  {
    id: 'drake-hotline-bling',
    label: 'Drake Hotline Bling',
    asset: '/memes/drake-hotline-bling.jpg',
    layers: [
      { name: 'nope', x: 0.72, y: 0.25, fontSize: 36, color: '#000000', align: 'left' },
      { name: 'yep', x: 0.72, y: 0.75, fontSize: 36, color: '#000000', align: 'left' },
    ],
  },
  {
    id: 'distracted-boyfriend',
    label: 'Distracted Boyfriend',
    asset: '/memes/distracted-boyfriend.jpg',
    layers: [
      { name: 'left', x: 0.24, y: 0.65, fontSize: 34, color: '#ffffff', align: 'center' },
      { name: 'center', x: 0.55, y: 0.35, fontSize: 34, color: '#ffffff', align: 'center' },
      { name: 'right', x: 0.76, y: 0.65, fontSize: 34, color: '#ffffff', align: 'center' },
    ],
  },
];

export async function runMemeWizard(): Promise<PostMemeResponse | null> {
  // Step 1: choose template
  const choice = await getSubmittedValues<{ templateId?: string[] }>({
    title: 'Choose a template',
    fields: [
      {
        type: 'select',
        name: 'templateId',
        label: 'Meme template',
        required: true,
        options: TEMPLATES.map((t) => ({ label: t.label, value: t.id })),
        defaultValue: TEMPLATES[0]?.id ? [TEMPLATES[0].id] : [],
        multiSelect: false,
      },
    ],
    acceptLabel: 'Next',
    cancelLabel: 'Cancel',
  });
  const templateId = choice?.templateId?.[0];
  const template = templateId ? TEMPLATES.find((t) => t.id === templateId) : null;
  if (!template) return null;

  // Step 2: text inputs
  const textResult = await getSubmittedValues<Record<string, string>>({
    title: 'Add text',
    fields: template.layers.map((layer) => ({
      type: 'string' as const,
      name: layer.name,
      label: `Text for ${layer.name}`,
      required: true,
    })),
    acceptLabel: 'Next',
    cancelLabel: 'Cancel',
  });
  if (!textResult) return null;

  // Step 3: optional background image (hosted by Reddit form upload)
  const bgResult = await showForm({
    title: 'Optional background',
    fields: [
      {
        type: 'image',
        name: 'background',
        label: 'Upload a background image (optional)',
        required: false,
      },
    ],
    acceptLabel: 'Continue',
    cancelLabel: 'Skip',
  } satisfies FormDefinition);

  // Build recipe
  const recipe: MemeRecipe = {
    templateId: template.id,
    backgroundUrl: bgResult.action === 'SUBMITTED' ? bgResult.values?.background || undefined : undefined,
    elements: template.layers.map((layer) => ({
      type: 'text' as const,
      content: textResult[layer.name] ?? '',
      x: layer.x,
      y: layer.y,
      fontSize: layer.fontSize ?? 36,
      color: layer.color ?? '#ffffff',
      align: layer.align ?? 'center',
      fontFamily: 'Impact, Arial Black, sans-serif',
      strokeColor: '#000000',
      bgColor: 'transparent',
      rotation: 0,
      boxWidth: 800,
      boxHeight: 200,
    })),
    drawingStrokes: [],
    createdAt: new Date().toISOString(),
  };

  // Final: title + post
  const titleResult = await getSubmittedValues<{ title?: string }>({
    title: 'Post title',
    fields: [
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        required: true,
        defaultValue: `${template.label} drop for this subreddit`,
      },
    ],
    acceptLabel: 'Post',
    cancelLabel: 'Cancel',
  });
  if (!titleResult) return null;

  const resp = await fetch('/api/post-meme-custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: titleResult.title,
      meme: recipe,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Failed to post meme: ${text || resp.statusText}`);
  }
  const data = (await resp.json()) as PostMemeResponse;
  return data;
}
