import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface AuthDialogContextType {
  isOpen: boolean;
  openAuthDialog: (pendingAction?: () => void) => void;
  closeAuthDialog: () => void;
  executePendingAction: () => void;
}

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

export const AuthDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const openAuthDialog = useCallback((pendingAction?: () => void) => {
    pendingActionRef.current = pendingAction ?? null;
    setIsOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => setIsOpen(false), []);

  const executePendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  }, []);

  return (
    <AuthDialogContext.Provider value={{ isOpen, openAuthDialog, closeAuthDialog, executePendingAction }}>
      {children}
    </AuthDialogContext.Provider>
  );
};

export const useAuthDialog = () => {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error("useAuthDialog must be used within AuthDialogProvider");
  return ctx;
};
