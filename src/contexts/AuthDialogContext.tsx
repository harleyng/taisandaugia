import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthDialogContextType {
  isOpen: boolean;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
}

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

export const AuthDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openAuthDialog = useCallback(() => setIsOpen(true), []);
  const closeAuthDialog = useCallback(() => setIsOpen(false), []);

  return (
    <AuthDialogContext.Provider value={{ isOpen, openAuthDialog, closeAuthDialog }}>
      {children}
    </AuthDialogContext.Provider>
  );
};

export const useAuthDialog = () => {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error("useAuthDialog must be used within AuthDialogProvider");
  return ctx;
};
