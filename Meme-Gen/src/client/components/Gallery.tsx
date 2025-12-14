import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { incrementDailyCountOnce } from '../lib/dailyCount';

const MEME_FILES = [
    'am-i-the-only-one.jpg',
    'american-gothic-cat.jpg',
    'ancient-aliens.jpg',
    'annie.webp',
    'bad-luck-brian.jpg',
    'batman-slaps-robin.jpg',
    'bell-curve.jpg',
    'bernie-i-am-once-again.jpg',
    'boardroom-meeting.jpg',
    'buff-doge-vs-cheems.png',
    'change-my-mind.jpg',
    'conspiracy-keanu.jpg',
    'distracted-boyfriend.jpg',
    'doge.jpg',
    'drake-hotline-bling.jpg',
    'evill-kermit.jpg',
    'first-world-problems.jpg',
    'flex-tape.jpg',
    'futurama-fry.jpg',
    'grant-gustin-grave.jpg',
    'gru-plan.jpg',
    'grumpy-cat.jpg',
    'hard-to-swallow-pills.jpg',
    'hidden-the-pain-harold.jpg',
    'hide-the-pain-harold.jpg',
    'is-this-a-pigeon.jpg',
    'is-this-a-pigeon2.jpg',
    'it-always-has-been.jpg',
    'laughing-leo-orig.webp',
    'laughing-leo.webp',
    'left-exit-off-ramp2.jpg',
    'leonardo-dicaprio-cheers.jpg',
    'mocking-spongebob-new.jpg',
    'monkey-puppet-orig.jpg',
    'monkey-puppet.jpg',
    'most-interesting-man.jpg',
    'one-does-not-simply.jpg',
    'oprah-you-get-a.jpg',
    'pablo-escobar-waiting.jpg',
    'peter-parker-cry.jpg',
    'roll-safe-think-about-it.jpg',
    'running-away-balloon.jpg',
    'scumbag-steve.jpg',
    'soldier-protecting-child.jpg',
    'spider-man.jpg',
    'spongebob-ight-imma-head-out.jpg',
    'squidward-window.jpg',
    'surprised-pikachu-orig.jpg',
    'surprised-pikachu.jpg',
    'that-would-be-great.jpg',
    'they-dont-know.jpg',
    'this-is-fine.jpg',
    'three-headed-dragon.jpg',
    'toy-story.jpg',
    'two-buttons.jpg',
    'unimpressed-seal.jpg',
    'uno-draw-25.jpg',
    'urinal-guy.jpg',
    'waiting-skeleton.jpg',
    'who-killed-hannibal.jpg',
    'woman-yelling-cat.jpg',
    'x-all-the-y.jpg',
    'yall-got-any-more-of-that.jpg',
];

const formatName = (file: string) =>
    file
        .replace(/\.[^.]+$/, '')
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

const TEMPLATES = MEME_FILES.map((file) => ({
    src: `/memes/${file}`,
    name: formatName(file),
}));

interface GalleryProps {
    onSelect: (src: string) => void;
}

export function Gallery({ onSelect }: GalleryProps) {
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [dailyCount, setDailyCount] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        incrementDailyCountOnce()
            .then((count) => {
                if (active) setDailyCount(count);
            })
            .catch(() => {
                if (active) setDailyCount(null);
            });
        return () => {
            active = false;
        };
    }, []);

    const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = reader.result as string;
            onSelect(src);
        };
        reader.readAsDataURL(file);
        if (uploadInputRef.current) {
            uploadInputRef.current.value = '';
        }
    };

    return (
        <div className="h-full w-full bg-[#FDFBF7] overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-400">Templates</p>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900">Pick a meme base</h1>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm text-sm text-zinc-600">
                        <span className="text-orange-500">🔥</span>
                        <span>{dailyCount === null ? '…' : dailyCount} made today</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 sm:gap-2.5">
                    <button
                        onClick={() => uploadInputRef.current?.click()}
                        className="group relative overflow-hidden rounded-2xl border-2 border-purple-300/70 bg-gradient-to-br from-purple-50 via-white to-purple-100 hover:border-purple-500 hover:shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500 flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px] text-purple-700"
                    >
                        <div className="text-lg font-extrabold leading-tight text-center">
                            <div>Upload</div>
                            <div>Your</div>
                            <div>Own</div>
                        </div>
                    </button>
                    {TEMPLATES.map((template) => (
                        <button
                            key={template.src}
                            onClick={() => onSelect(template.src)}
                            className="group relative overflow-hidden rounded-2xl shadow-sm border border-zinc-200 bg-white hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
                        >
                            <img
                                src={template.src}
                                alt={template.name}
                                className="w-full aspect-[4/5] object-cover transition duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[11px] sm:text-xs font-semibold">
                                <span>{template.name}</span>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 backdrop-blur">
                                    <ArrowDown className="w-2.5 h-2.5 rotate-180" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
                <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadChange}
                />
            </div>
        </div>
    );
}
