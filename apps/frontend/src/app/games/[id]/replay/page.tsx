import { api } from '@/lib/api';
import { ReplayViewer } from './replay-viewer';

interface Props {
  params: { id: string };
}

export default async function ReplayPage({ params }: Props) {
  let replay = null;
  let error = null;

  try {
    replay = await api.getReplay(params.id);
  } catch (e) {
    error = 'Replay not available. The game may not be finished yet.';
  }

  if (error || !replay) {
    return (
      <div className="text-center py-12 text-terminal-muted text-sm">
        <div className="text-3xl mb-3">📼</div>
        <div>{error}</div>
        <a href={`/games/${params.id}`} className="mt-3 block text-terminal-blue hover:underline text-xs">
          ← Back to live view
        </a>
      </div>
    );
  }

  return <ReplayViewer gameId={params.id} replay={replay} />;
}
