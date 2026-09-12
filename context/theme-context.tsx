import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import { CURRENCIES, CurrencyCode, DEFAULT_CURRENCY } from "../constants/currency";
import { DEFAULT_COUNTRY_CODE } from "../constants/phone";
import { Colors, ThemeColors, ThemeMode } from "../constants/theme";

const THEME_STORAGE_KEY = "@tradeapp_theme_mode";

type ThemeContextType = {
  themeMode: ThemeMode;
  colorScheme: "light" | "dark";
  isDark: boolean;
  colors: ThemeColors;
  currency: CurrencyCode;
  defaultCountryCode: string;
  isPinUnlocked: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  setDefaultCountryCode: (code: string) => Promise<void>;
  setPinUnlocked: (unlocked: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "system",
  colorScheme: "dark",
  isDark: true,
  colors: Colors.dark,
  currency: DEFAULT_CURRENCY,
  defaultCountryCode: DEFAULT_COUNTRY_CODE,
  isPinUnlocked: false,
  setThemeMode: async () => {},
  setCurrency: async () => {},
  setDefaultCountryCode: async () => {},
  setPinUnlocked: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [defaultCountryCode, setDefaultCountryCodeState] = useState(DEFAULT_COUNTRY_CODE);
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setThemeModeState(saved);
        }
        const savedSettings = await AsyncStorage.getItem("business_settings");
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.currency && parsed.currency in CURRENCIES) {
            setCurrencyState(parsed.currency);
          }
          if (typeof parsed.default_country_code === "string" && parsed.default_country_code) {
            setDefaultCountryCodeState(parsed.default_country_code.replace(/\D/g, ""));
          }
        }
      } catch {
        // Fallback to system
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignored
    }
  }, []);

  const setCurrency = useCallback(async (nextCurrency: CurrencyCode) => {
    setCurrencyState(nextCurrency);
    try {
      const savedSettings = await AsyncStorage.getItem("business_settings");
      const parsed = savedSettings ? JSON.parse(savedSettings) : {};
      await AsyncStorage.setItem(
        "business_settings",
        JSON.stringify({ ...parsed, currency: nextCurrency }),
      );
    } catch {
      // Ignored
    }
  }, []);

  const setDefaultCountryCode = useCallback(async (nextCode: string) => {
    const cleanCode = nextCode.replace(/\D/g, "");
    if (!cleanCode) return;
    setDefaultCountryCodeState(cleanCode);
    try {
      const savedSettings = await AsyncStorage.getItem("business_settings");
      const parsed = savedSettings ? JSON.parse(savedSettings) : {};
      await AsyncStorage.setItem(
        "business_settings",
        JSON.stringify({ ...parsed, default_country_code: cleanCode }),
      );
    } catch {
      // Ignored
    }
  }, []);

  const effectiveScheme: "light" | "dark" =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;

  const isDark = effectiveScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const setPinUnlocked = useCallback((unlocked: boolean) => {
    setIsPinUnlocked(unlocked);
  }, []);

  const contextValue = useMemo(
    () => ({
      themeMode,
      colorScheme: effectiveScheme,
      isDark,
      colors,
      currency,
      defaultCountryCode,
      isPinUnlocked,
      setThemeMode,
      setCurrency,
      setDefaultCountryCode,
      setPinUnlocked,
    }),
    [themeMode, effectiveScheme, isDark, colors, currency, defaultCountryCode, isPinUnlocked, setThemeMode, setCurrency, setDefaultCountryCode, setPinUnlocked],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
