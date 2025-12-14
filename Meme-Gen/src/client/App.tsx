import { useState } from 'react';
import { Gallery } from './components/Gallery';
import { Editor } from './components/Editor';

export default function App() {
    const [view, setView] = useState<'gallery' | 'editor'>('gallery');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    const handleSelectTemplate = (src: string) => {
        setSelectedTemplate(src);
        setView('editor');
    };

    const handleBack = () => {
        setView('gallery');
        setSelectedTemplate(null);
    };

    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden">
            {view === 'gallery' ? (
                <Gallery onSelect={handleSelectTemplate} />
            ) : (
                <Editor templateSrc={selectedTemplate!} onBack={handleBack} />
            )}
        </div>
    );
}
