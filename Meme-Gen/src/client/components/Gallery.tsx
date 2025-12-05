import React, { useRef } from 'react';
import { ArrowDown } from 'lucide-react';

const TEMPLATES = [
    { src: '/distracted-boyfriend.jpg', name: 'Distracted Boyfriend' },
    { src: '/drake.jpg', name: 'Drake Hotline' },
    { src: '/change-my-mind.jpg', name: 'Change My Mind' },
    { src: '/roll-safe-think-about-it.jpg', name: 'Roll Safe' },
    { src: '/this-is-fine.jpg', name: 'This Is Fine' },
    { src: '/they-dont-know.jpg', name: 'They Don\'t Know' },
    { src: '/surprised-pikachu.jpg', name: 'Surprised Pikachu' },
    { src: '/monkey-puppet.jpg', name: 'Awkward Monkey' },
    { src: '/laughing-leo.webp', name: 'Laughing Leo' },
    { src: '/hide-the-pain-harold.jpg', name: 'Hide the Pain Harold' },
    { src: '/is-this-a-pigeon.jpg', name: 'Is This a Pigeon?' },
    { src: '/waiting-skeleton.jpg', name: 'Waiting Skeleton' },
    { src: '/padme-anakin.jpg', name: 'Padme / Anakin' },
    { src: '/buttons.jpg', name: 'Buttons' },
    { src: '/toy-story.jpg', name: 'Toy Story' },
    { src: '/astronauts.jpg', name: 'Astronauts (Wait It\'s All...)' },
    { src: '/uno-draw-25.jpg', name: 'UNO Draw 25' },
    { src: '/batman-slap.jpg', name: 'Batman Slap' },
    { src: '/left-exit.jpg', name: 'Left Exit 12' },
    { src: '/disaster-girl.jpg', name: 'Disaster Girl' },
    { src: '/bernie-i-am-once-again.jpg', name: 'Bernie Once Again' },
    { src: '/flex-tape.jpg', name: 'Flex Tape' },
    { src: '/spider-man.jpg', name: 'Spider-Man' },
    { src: '/squidward-window.jpg', name: 'Squidward Window' },
    { src: '/leonardo-dicaprio-cheers.jpg', name: 'Leo Cheers' },
    { src: '/soldier-protecting-child.jpg', name: 'Soldier Protecting Child' },
    { src: '/grant-gustin-grave.jpg', name: 'Grant Gustin Grave' },
    { src: '/running-away-balloon.jpg', name: 'Running Away Balloon' },
    { src: '/three-headed-dragon.jpg', name: 'Three-Headed Dragon' },
    { src: '/bell-curve.jpg', name: 'Bell Curve' },
    { src: '/urinal-guy.jpg', name: 'Urinal Guy' },
    { src: '/yall-got-any-more-of-that.jpg', name: 'Y\'all Got Any More' },
];

interface GalleryProps {
    onSelect: (src: string) => void;
}

export function Gallery({ onSelect }: GalleryProps) {
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
        <div className="h-full w-full bg-[#FDFBF7] overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-400">Templates</p>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900">Pick a meme base</h1>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm text-sm text-zinc-600">
                        <span className="text-orange-500">🔥</span>
                        <span>872 made today</span>
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
