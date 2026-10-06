import { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../constants/supabase";

export type AuthRole = "owner" | "worker" | null;

type BusinessResult = {
  businessId: string | null;
  role: AuthRole;
  failed: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: Session["user"] | null;
  businessId: string | null;
  role: AuthRole;
  isOwner: boolean;
  isSessionReady: boolean;
  isBusinessReady: boolean;
  businessError: boolean;
  isSignedIn: boolean;
  refreshBusiness: () => Promise<BusinessResult>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  businessId: null,
  role: null,
  isOwner: false,
  isSessionReady: false,
  isBusinessReady: false,
  businessError: false,
  isSignedIn: false,
  refreshBusiness: async () => ({ businessId: null, role: null, failed: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [isBusinessReady, setIsBusinessReady] = useState(false);
  const [businessError, setBusinessError] = useState(false);

  // De-duplicates loads: one load per user unless forced or the last load failed.
  const inFlight = useRef<{ userId: string; promise: Promise<BusinessResult> } | null>(null);

  const fetchBusinessContext = useCallback(
    (userId?: string, force = false): Promise<BusinessResult> => {
      if (!userId) {
        inFlight.current = null;
        setBusinessId(null);
        setRole(null);
        setBusinessError(false);
        setIsBusinessReady(true);
        return Promise.resolve({ businessId: null, role: null, failed: false });
      }

      if (!force && inFlight.current?.userId === userId) {
        return inFlight.current.promise;
      }

      setIsBusinessReady(false);

      const promise = (async (): Promise<BusinessResult> => {
        try {
          const { data: bId, error: bError } = await supabase.rpc("my_active_business");
          if (bError) throw bError;

          const resolvedBusinessId = bId ? String(bId) : null;
          let resolvedRole: AuthRole = null;

          if (resolvedBusinessId) {
            const { data: r, error: rError } = await supabase.rpc("get_my_role", {
              p_business_id: resolvedBusinessId,
            });
            if (rError) throw rError;
            resolvedRole = r === "owner" || r === "worker" ? r : null;
          }

          setBusinessId(resolvedBusinessId);
          setRole(resolvedRole);
          setBusinessError(false);
          setIsBusinessReady(true);
          return { businessId: resolvedBusinessId, role: resolvedRole, failed: false };
        } catch {
          // A network/server error is NOT the same as "no access": keep any
          // previous values and let the UI offer a retry.
          inFlight.current = null;
          setBusinessError(true);
          setIsBusinessReady(true);
          return { businessId: null, role: null, failed: true };
        }
      })();

      inFlight.current = { userId, promise };
      return promise;
    },
    [],
  );

  const refreshBusiness = useCallback(
    () => fetchBusinessContext(session?.user?.id, true),
    [fetchBusinessContext, session?.user?.id],
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setSession(currentSession);
      void fetchBusinessContext(currentSession?.user?.id);
    };

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setIsSessionReady(true);

      // Do NOT await Supabase calls inside this callback (can deadlock the
      // auth client). Defer the business load to the next tick.
      const uid = nextSession?.user?.id;
      setTimeout(() => {
        if (isMounted) void fetchBusinessContext(uid);
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchBusinessContext]);

  const contextValue = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      businessId,
      role,
      isOwner: role === "owner",
      isSessionReady,
      isBusinessReady,
      businessError,
      isSignedIn: Boolean(session),
      refreshBusiness,
    }),
    [session, businessId, role, isSessionReady, isBusinessReady, businessError, refreshBusiness],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}