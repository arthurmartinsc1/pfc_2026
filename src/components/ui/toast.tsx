"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/ui/icons";

// Toast global da aplicação — usar em qualquer confirmação de interação
// ("salvo com sucesso", erros de ação etc.). O provider vive no layout
// raiz, então o toast sobrevive a navegações (ex: salvar e voltar).
//
//   const toast = useToast();
//   toast("Termos salvos com sucesso");            // sucesso (padrão)
//   toast("Não foi possível salvar", "error");     // erro
//   toast("Mensagem instrutiva…", "success", 6000); // duração maior (ms)

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<
  (message: string, variant?: ToastVariant, durationMs?: number) => void
>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-olive/40 text-olive",
  error: "border-signal/40 text-signal",
};

const TOAST_DURATION_MS = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success", durationMs = TOAST_DURATION_MS) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, durationMs);
    },
    []
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter flex items-center gap-2 border bg-panel-raised px-4 py-2.5 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.45)] ${VARIANT_CLASSES[toast.variant]}`}
          >
            {toast.variant === "success" ? (
              <CheckCircleIcon className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="text-khaki">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
