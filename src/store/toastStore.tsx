import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
}
interface ToastState {
  toasts: Toast[];
  push: (text: string) => void;
  remove: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span className="ok">✓</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
