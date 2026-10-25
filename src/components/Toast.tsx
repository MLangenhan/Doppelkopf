import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

type Tone = 'error' | 'info' | 'success';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, tone: Tone = 'info') => {
    const id = nextId++;
    setItems((cur) => [...cur.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), tone === 'error' ? 4500 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-panel backdrop-blur-md ${
                t.tone === 'error'
                  ? 'bg-red-600/90 text-white'
                  : t.tone === 'success'
                    ? 'bg-emerald-500/90 text-felt-950'
                    : 'bg-felt-950/90 text-white ring-1 ring-white/15'
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
