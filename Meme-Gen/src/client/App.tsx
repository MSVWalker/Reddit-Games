import { useState } from 'react';
import { Gallery } from './components/Gallery';
import { Editor } from './components/Editor';

export default function App() {
    const [view, setView] = useState<'gallery' | 'editor'>('gallery');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [templateMode, setTemplateMode] = useState(false);

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
                <Gallery onSelect={handleSelectTemplate} templateMode={templateMode} onToggleTemplateMode={() => setTemplateMode((v) => !v)} />
            ) : (
                <Editor templateSrc={selectedTemplate!} onBack={handleBack} templateMode={templateMode} />
            )}
        </div>
    );
}
