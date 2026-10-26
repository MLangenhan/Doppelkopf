import { StatsContent } from '../components/StatsContent';
import { TopBar } from '../components/TopBar';

export function StatsPage() {
  return (
    <div className="felt min-h-full">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-20">
        <StatsContent />
      </main>
    </div>
  );
}
