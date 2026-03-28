import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";

const PUBLISHABLE_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

// Global flag — survives across Astro island hydration on the same page
let clerkMounted = false;

interface Props {
  children: ReactNode;
}

export default function AuthProvider({ children }: Props) {
  if (!PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  // If a ClerkProvider already exists on this page, just render children
  // They'll inherit context from the existing provider via the shared DOM
  if (clerkMounted) {
    return <>{children}</>;
  }

  clerkMounted = true;
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
