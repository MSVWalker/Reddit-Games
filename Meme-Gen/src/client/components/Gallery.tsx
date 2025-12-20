import { useRef, useState } from 'react';

const MEME_FILES = [
    // Top set (ordered)
    'distracted-boyfriend.jpg',
    'drake-hotline-bling.jpg',
    'two-buttons.jpg',
    'hide-the-pain-harold.jpg',
    'bernie-i-am-once-again.jpg',
    'hard-to-swallow-pills.jpg',
    'laughing-leo.webp',
    'tiger-vs-daly.jpg',
    'george-bush.jpg',
    'anakin-padme.webp',
    'clown-makeup.jpg',
    'they-dont-know.jpg',
    'left-exit-off-ramp2.jpg',
    'change-my-mind.jpg',
    'toughest-battles.png',
    'pablo-escobar-waiting.jpg',
    'this-is-worthless.jpg',
    'tried-your-best.jpg',
    'waiting-skeleton.jpg',
    'three-headed-dragon.jpg',
    'this-is-fine.jpg',
    'urinal-guy.jpg',
    'toy-story.jpg',
    'trade-offer.jpg',
    // Rest (alphabetical by name)
    'am-i-the-only-one.jpg',
    'american-gothic-cat.jpg',
    'ancient-aliens.jpg',
    'bad-luck-brian.jpg',
    'batman-slapping-robin.jpg',
    'bike-fall.jpg',
    'boardroom-meeting.jpg',
    'brace-yourselves.jpg',
    'buff-doge-vs-cheems.png',
    'charlie-mail-room.jpg',
    'crying-jordan.webp',
    'doge.jpg',
    'drowning-kid.jpg',
    'epic-handshake.jpg',
    'evill-kermit.jpg',
    'expanding-brain.jpg',
    'first-world-problems.jpg',
    'flex-tape.jpg',
    'frank-hanging-himself.jpg',
    'futurama-fry.jpg',
    'getting-paid.png',
    'grant-gustin-grave.jpg',
    'grim-reaper-doors.webp',
    'gru-plan.jpg',
    'grumpy-cat.jpg',
    'homer-at-bar.jpg',
    'inhaling-seagull.jpg',
    'iq-bell-curve.jpg',
    'is-this-a-pigeon.jpg',
    'it-always-has-been.jpg',
    'jim-halpert-explains-2.jpg',
    'leonardo-dicaprio-cheers.jpg',
    'look-at-me.jpg',
    'megamind-peeking.png',
    'mocking-spongebob-new.jpg',
    'moe-tossing-barney.jpg',
    'monkey-puppet.jpg',
    'most-interesting-man.jpg',
    'night-king.jpg',
    'nut-button.jpg',
    'nvpfua0y5sg41.jpg',
    'one-does-not-simply.jpg',
    'oprah-you-get-a.jpg',
    'panik-kalm-panik.png',
    'pawn-stars.jpg',
    'pbs-meme.jpg',
    'pepe-smoking.png',
    'peter-parker-cry.jpg',
    'philosoraptor.jpg',
    'pinimg-meme.jpg',
    'quiz-kid.jpg',
    'roll-safe-think-about-it.jpg',
    'running-away-balloon.jpg',
    'same-picture.jpg',
    'sleeping-shaq.jpg',
    'soldier-protecting-child.jpg',
    'spider-man.jpg',
    'spongebob-fire.jpg',
    'spongebob-ight-imma-head-out.jpg',
    'squidward-window.jpg',
    'success-kid.jpg',
    'surprised-pikachu.jpg',
    'tell-me-more.jpg',
    'that-would-be-great.jpg',
    'thinking-about-other-women.jpg',
    'trophy-case.jpg',
    'tuxedo-winnie-the-pooh.png',
    'uno-draw-25.jpg',
    'whiteboard-blank.jpg',
    'who-killed-hannibal.jpg',
    'woman-yelling-cat.jpg',
    'wondershare-meme.jpg',
    'x-all-the-y.jpg',
    'y-u-no.jpg',
    'yall-got-any-more-of-that.jpg',
    'yoda.jpg',
    'whiteboard-blank.jpg',
];

const formatName = (file: string) =>
    file
        .replace(/\.[^.]+$/, '')
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

const UNIQUE_MEME_FILES = (() => {
    const seen = new Set<string>();
    return MEME_FILES.filter((file) => {
        const key = file.replace(/\.[^.]+$/, '').replace(/-orig$/i, '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
})();

const TEMPLATES = UNIQUE_MEME_FILES.map((file) => ({
    src: `/memes/${file}`,
    name: formatName(file),
}));

interface GalleryProps {
    onSelect: (src: string) => void;
}

interface GalleryProps {
    onSelect: (src: string) => void;
    templateMode: boolean;
    onToggleTemplateMode: () => void;
}

export function Gallery({ onSelect, templateMode, onToggleTemplateMode }: GalleryProps) {
    const uploadInputRef = useRef<HTMLInputElement>(null);

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
        <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#0e0f13] via-[#0b0b10] to-[#0e0f13]">
            <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-orange-400/80">Templates</p>
                        <h1 className="text-3xl sm:text-[2.4rem] font-black tracking-tight text-white drop-shadow whitespace-nowrap">Pick a meme base</h1>
                    </div>
                    <button
                        onClick={onToggleTemplateMode}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                            templateMode ? 'bg-orange-500/20 border-orange-500/60 text-orange-100' : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                        }`}
                        title="Toggle template creator mode"
                    >
                        {templateMode ? 'Template Mode: On' : 'Template Mode: Off'}
                    </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 sm:gap-2.5">
                    <button
                        onClick={() => uploadInputRef.current?.click()}
                        className="group relative overflow-hidden rounded-2xl border border-orange-500/60 bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/30 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px] text-white font-extrabold"
                    >
                        <div className="text-lg leading-tight text-center drop-shadow-sm">
                            <div>Upload</div>
                            <div>Your</div>
                            <div>Own</div>
                        </div>
                    </button>
                    {TEMPLATES.map((template) => (
                        <button
                            key={template.src}
                            onClick={() => onSelect(template.src)}
                            className="group relative overflow-hidden rounded-2xl shadow-sm border border-orange-500/10 bg-[#14141d] hover:border-orange-400/50 hover:shadow-lg hover:shadow-orange-500/20 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                        >
                            <img
                                src={template.src}
                                alt={template.name}
                                className="w-full aspect-[4/5] object-cover transition duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition" />
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-start text-white text-[10px] sm:text-[11px] font-semibold drop-shadow">
                                <span className="px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm leading-none">{template.name}</span>
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
