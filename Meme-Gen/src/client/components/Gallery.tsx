import { ArrowDown } from 'lucide-react';

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

interface GalleryProps {
    onSelect: (src: string) => void;
}

export function Gallery({ onSelect }: GalleryProps) {
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-sm font-semibold">
                                <span>{template.name}</span>
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur">
                                    <ArrowDown className="w-3 h-3 rotate-180" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
