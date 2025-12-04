import { useRef } from 'react';
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
    const templatesRef = useRef<HTMLDivElement>(null);

    const scrollToTemplates = () => {
        templatesRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="flex flex-col h-full bg-[#FDFBF7] relative overflow-x-hidden">
            {/* Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-purple-400/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[30%] bg-cyan-400/30 rounded-full blur-3xl pointer-events-none" />

            {/* Main Content Container */}
            <div className="flex-1 flex flex-col items-center px-6 pt-12 pb-6 z-10 overflow-y-auto">

                {/* Status Pill */}
                <div className="mb-6 px-4 py-1.5 bg-zinc-100 rounded-full shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-700">
                    <span className="text-sm font-medium text-zinc-600">🔥 872 memes made today</span>
                </div>

                {/* Logo & Tagline */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-top-8 duration-700 delay-100">
                    <h1 className="text-5xl font-black tracking-tighter mb-3">
                        MEME<span className="text-purple-600">GEN</span>
                    </h1>
                    <p className="text-zinc-500 font-medium text-lg max-w-[280px] mx-auto leading-tight">
                        Turn any post into a meme in three taps.
                    </p>
                </div>

                {/* Circular Process Flow */}
                <div className="relative w-full max-w-[320px] aspect-square mb-12 animate-in fade-in zoom-in-95 duration-700 delay-200">
                    {/* Connecting Arrows (SVG) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none text-zinc-300" viewBox="0 0 300 300">
                        {/* Top to Right */}
                        <path d="M180 60 Q 220 60, 240 90" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M235 85 L 240 90 L 245 85" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

                        {/* Right to Bottom */}
                        <path d="M240 180 Q 220 220, 180 240" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M185 235 L 180 240 L 185 245" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

                        {/* Bottom to Left */}
                        <path d="M120 240 Q 80 220, 60 180" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M65 185 L 60 180 L 55 185" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

                        {/* Left to Top */}
                        <path d="M60 120 Q 80 80, 120 60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M115 65 L 120 60 L 115 55" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>

                    {/* Circles */}
                    {/* 1. Choose Template (Top Left) */}
                    <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-[#FEF9C3] border-2 border-black/5 flex flex-col items-center justify-center text-center p-2 shadow-sm transform -rotate-3 hover:scale-105 transition-transform">
                        <span className="font-bold text-zinc-800 leading-tight">Choose<br />Template</span>
                    </div>

                    {/* 2. Add Text (Top Right) */}
                    <div className="absolute top-4 right-0 w-28 h-28 rounded-full bg-[#FCE7F3] border-2 border-black/5 flex flex-col items-center justify-center text-center p-2 shadow-sm transform rotate-6 hover:scale-105 transition-transform">
                        <span className="font-bold text-zinc-800 leading-tight">Add<br />Text</span>
                    </div>

                    {/* 3. Post to Reddit (Bottom Left) */}
                    <div className="absolute bottom-4 left-2 w-28 h-28 rounded-full bg-[#DCFCE7] border-2 border-black/5 flex flex-col items-center justify-center text-center p-2 shadow-sm transform rotate-2 hover:scale-105 transition-transform">
                        <span className="font-bold text-zinc-800 leading-tight">Post to<br />Reddit</span>
                    </div>

                    {/* 4. Download (Bottom Right) */}
                    <div className="absolute bottom-0 right-4 w-32 h-32 rounded-full bg-[#E9D5FF] border-2 border-black/5 flex flex-col items-center justify-center text-center p-2 shadow-sm transform -rotate-2 hover:scale-105 transition-transform">
                        <span className="font-bold text-zinc-800 leading-tight">Download<br />& Share</span>
                    </div>
                </div>

                {/* CTA Section */}
                <div className="w-full max-w-xs space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <button
                        onClick={scrollToTemplates}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl rounded-[2rem] rounded-tr-[1.5rem] rounded-bl-[1.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
                    >
                        Start Creating
                    </button>
                    <p className="text-center text-zinc-400 text-sm font-medium flex items-center justify-center gap-1">
                        Or jump straight into a popular template <ArrowDown className="w-3 h-3" />
                    </p>
                </div>

                {/* Template Strip Hint */}
                <div ref={templatesRef} className="w-full mt-12 pt-8 border-t border-black/5">
                    <h3 className="text-lg font-bold text-zinc-800 mb-4 px-2">Popular Templates</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-20">
                        {TEMPLATES.map((template) => (
                            <button
                                key={template.src}
                                onClick={() => onSelect(template.src)}
                                className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <img
                                    src={template.src}
                                    alt={template.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
