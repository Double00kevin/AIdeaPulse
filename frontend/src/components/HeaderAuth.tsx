import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import AuthProvider from "./AuthProvider";

function AuthButtons() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="w-20 h-6 bg-gray-800 animate-pulse rounded" />;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
          Dashboard
        </a>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-7 h-7",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <SignInButton mode="modal">
        <button className="text-sm text-gray-400 hover:text-white cursor-pointer transition-colors">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors">
          Get Started Free
        </button>
      </SignUpButton>
    </div>
  );
}

export default function HeaderAuth() {
  return (
    <AuthProvider>
      <AuthButtons />
    </AuthProvider>
  );
}
