import { Session } from "@supabase/supabase-js";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { supabase } from "../constants/supabase";

type AuthContextType = {
  session: Session | null;
  user: Session["user"] | null;
  isSessionReady: boolean;
  isSignedIn: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isSessionReady: false,
  isSignedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setSession(currentSession);
    };

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT"
      ) {
        setIsSessionReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isSessionReady,
      isSignedIn: Boolean(session),
    }),
    [session, isSessionReady],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
