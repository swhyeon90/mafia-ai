import { SpectatorView } from './spectator-view';

interface Props {
  params: { id: string };
}

export default function GamePage({ params }: Props) {
  return <SpectatorView gameId={params.id} />;
}
