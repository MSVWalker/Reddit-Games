import { useEffect, useState } from 'react';
import { MemeViewer } from './components/MemeViewer';
import { context as devvitContext } from '@devvit/web/client';
import { runMemeWizard } from './lib/memeWizard';
import type { PostMemeResponse } from '../shared/types/api';

export default function App() {
    const [wizardPosting, setWizardPosting] = useState(false);
    const [wizardError, setWizardError] = useState<string | null>(null);
    const [autoLaunched, setAutoLaunched] = useState(false);

    const devvitCtx = (() => {
        try {
            return devvitContext as any;
        } catch {
            return undefined;
        }
    })();
    const isMemeView = devvitCtx?.postData?.mode === 'meme-view' && devvitCtx?.postId;

    const handleWizard = async () => {
        if (wizardPosting) return;
        setAutoLaunched(true);
        setWizardPosting(true);
        setWizardError(null);
        try {
            const result = await runMemeWizard();
            if (result && (result as PostMemeResponse)?.url) {
                window.location.href = (result as PostMemeResponse).url;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create meme';
            setWizardError(message);
        } finally {
            setWizardPosting(false);
        }
    };

    useEffect(() => {
        if (isMemeView || wizardPosting || autoLaunched) return;
        // slight delay to ensure Devvit web client is ready before opening form
        const id = window.setTimeout(() => {
            setAutoLaunched(true);
            void handleWizard();
        }, 50);
        return () => window.clearTimeout(id);
    }, [isMemeView, wizardPosting, autoLaunched]);

    return (
        isMemeView ? (
            <MemeViewer postId={devvitCtx?.postId} />
        ) : (
            <div className="h-screen w-full bg-background text-foreground overflow-hidden flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-white/70">
                        {wizardPosting ? 'Launching meme form…' : wizardError ? wizardError : 'Starting meme form…'}
                    </p>
                    <button
                        onClick={handleWizard}
                        disabled={wizardPosting}
                        className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition disabled:opacity-60"
                    >
                        {wizardPosting ? 'Opening…' : 'Start meme form'}
                    </button>
                </div>
            </div>
        )
    );
}
