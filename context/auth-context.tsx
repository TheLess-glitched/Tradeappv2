import NetInfo from "@react-native-community/netinfo";
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
import { clearAllCaches } from "../constants/read-cache";
import { withTimeout } from "../constants/network-error";
import {
  clearOfflineIdentity,
  loadOfflineIdentity,
  saveOfflineIdentity,
} from "../constants/offline-identity";
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
  isOffline: boolean;
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
  isOffline: false,
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
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(false);
  const userIdRef = useRef<string | undefined>(undefined);
  const businessIdRef = useRef<string | null>(null);

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

      const uid = userId;
      // Only show the loading state on the first load. A background refresh must not
      // flip "ready" off, or the screens underneath get reset.
      if (!businessIdRef.current) setIsBusinessReady(false);

      const promise = (async (): Promise<BusinessResult> => {
        // Cache first: open straight away from what this phone saved last time,
        // then confirm with the server below.
        const early = await loadOfflineIdentity();
        if (early && early.userId !== uid) {
          // A different account is signing in on this phone: drop the previous
          // account's saved data.
          void clearAllCaches();
        }
        if (!force && early && early.userId === uid && early.businessId && early.role) {
          setBusinessId(early.businessId);
          setRole(early.role);
          setBusinessError(false);
          setIsBusinessReady(true);
        }

        try {
          const { data: bId, error: bError } = await withTimeout(
            supabase.rpc("my_active_business"),
            8000,
          );
          if (bError) throw bError;

          const resolvedBusinessId = bId ? String(bId) : null;
          let resolvedRole: AuthRole = null;

          if (resolvedBusinessId) {
            const { data: r, error: rError } = await withTimeout(
              supabase.rpc("get_my_role", { p_business_id: resolvedBusinessId }),
              8000,
            );
            if (rError) throw rError;
            resolvedRole = r === "owner" || r === "worker" ? r : null;
          }

          setBusinessId(resolvedBusinessId);
          setRole(resolvedRole);
          setBusinessError(false);
          setIsOffline(false);
          setIsBusinessReady(true);
          void saveOfflineIdentity({
            userId: uid,
            businessId: resolvedBusinessId,
            role: resolvedRole,
            savedAt: new Date().toISOString(),
          });
          return { businessId: resolvedBusinessId, role: resolvedRole, failed: false };
        } catch {
          // A network/server error is NOT the same as "no access": fall back to
          // what this phone saved, and let the UI offer a retry otherwise.
          inFlight.current = null;
          const cached = await loadOfflineIdentity();
          if (cached && cached.userId === uid && cached.businessId && cached.role) {
            setBusinessId(cached.businessId);
            setRole(cached.role);
            setBusinessError(false);
            setIsOffline(true);
            setIsBusinessReady(true);
            return { businessId: cached.businessId, role: cached.role, failed: true };
          }
          setBusinessError(true);
          setIsBusinessReady(true);
          return { businessId: null, role: null, failed: true };
        }
      })();

      inFlight.current = { userId: uid, promise };
      return promise;
    },
    [],
  );

  const refreshBusiness = useCallback(
    () => fetchBusinessContext(session?.user?.id, true),
    [fetchBusinessContext, session?.user?.id],
  );

  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  useEffect(() => {
    userIdRef.current = session?.user?.id;
  }, [session]);

  useEffect(() => {
    businessIdRef.current = businessId;
  }, [businessId]);

  // When the connection comes back, confirm everything with the server.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      if (online && isOfflineRef.current && userIdRef.current) {
        void fetchBusinessContext(userIdRef.current, true);
      }
    });
    return unsubscribe;
  }, [fetchBusinessContext]);

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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        void clearOfflineIdentity();
        void clearAllCaches();
      }

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
      isOffline,
      isSignedIn: Boolean(session),
      refreshBusiness,
    }),
    [
      session,
      businessId,
      role,
      isSessionReady,
      isBusinessReady,
      businessError,
      isOffline,
      refreshBusiness,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}