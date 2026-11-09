import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  isLive: boolean;
  isFetching: boolean;
  lastUpdatedAt: number;
}

function useRelativeTime(timestamp: number) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      if (!timestamp) { setLabel('—'); return; }
      const seconds = Math.round((Date.now() - timestamp) / 1000);
      if (seconds < 5) setLabel('just now');
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else setLabel(`${Math.round(seconds / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5_000);
    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}

export default function LiveStatusBar({ isLive, isFetching, lastUpdatedAt }: Props) {
  const timeLabel = useRelativeTime(lastUpdatedAt);

  return (
    <div className="shrink-0 border-t border-syn-border bg-syn-surface/70 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-8 flex items-center gap-3">

        {/* Live / Static indicator */}
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={11} className="text-syn-muted" />
              <span className="text-[11px] text-syn-muted">Static preview</span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-3.5 bg-syn-border" />

        {/* Data source */}
        <span className="text-[11px] text-syn-muted">
          {isLive ? 'Revenue Cloud · GraphQL' : 'Local mock data'}
        </span>

        {/* Last sync */}
        {isLive && (
          <>
            <div className="w-px h-3.5 bg-syn-border" />
            <span className="text-[11px] text-syn-muted">
              Updated {timeLabel}
            </span>
          </>
        )}

        {/* Fetching spinner */}
        <AnimatePresence>
          {isFetching && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 ml-1"
            >
              <RefreshCw size={10} className="text-syn-secondary animate-spin" />
              <span className="text-[10px] text-syn-secondary">Syncing…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: poll interval hint */}
        {isLive && (
          <div className="ml-auto text-[10px] text-syn-muted opacity-60">
            polls every 30s
          </div>
        )}
      </div>
    </div>
  );
}
