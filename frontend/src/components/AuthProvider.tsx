import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";

const PUBLISHABLE_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

interface Props {
  children: ReactNode;
}

export default function AuthProvider({ children }: Props) {
  if (!PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
