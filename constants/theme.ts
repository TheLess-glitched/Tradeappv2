/**
 * Global 4-Color Theme System:
 * - Orange: Primary brand & CTA accent
 * - Lavender: Secondary accent, highlights, subtle badges/surfaces
 * - Navy: Text, card borders, dark-surfaces, light-text
 * - Black: Deep background base in dark mode
 */

import { Platform } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export const Colors = {
  light: {
    // Background & Surfaces
    background: "#F7F6FC", // Soft lavender-tinted off-white
    surface: "#FFFFFF", // Clean crisp card surface
    surfaceSubtle: "#EFEBF8", // Lavender-tinted surface
    surfaceHighlight: "#E3DCF7", // Lavender accent highlight
    
    // Borders
    border: "#E2DCF2", // Soft lavender-navy border
    borderStrong: "#CBD5E1", // Slate border
    
    // Typography
    text: "#0D1B2A", // Deep navy primary text
    textSecondary: "#4A5568", // Slate navy secondary text
    textMuted: "#718096", // Muted slate text
    
    // Accents & Actions
    primary: "#F6A623", // Vibrant orange primary CTA
    primaryDark: "#E08A0A", // Deeper orange for hover/pressed
    primaryText: "#0A0F1E", // Dark contrast text on orange
    
    secondary: "#7559C9", // Deep lavender accent
    secondarySurface: "#EAE6F8", // Soft lavender chip/badge surface
    secondaryText: "#5B3EBA", // Lavender badge text
    
    // Inputs
    inputBackground: "#FFFFFF",
    inputBorder: "#DCD5EE",
    inputText: "#0D1B2A",
    placeholder: "#8C96A8",
    
    // Navigation / Tabs
    tabBarBackground: "#FFFFFF",
    tabBarBorder: "#E8E3F5",
    tabBarActive: "#F6A623",
    tabBarInactive: "#718096",
    
    // Status colors
    statusPending: "#F6A623",
    statusInProgress: "#3182CE",
    statusDone: "#38A169",
    
    // Danger / Alerts
    danger: "#E53E3E",
    dangerSurface: "#FFF5F5",
    dangerText: "#C53030",
    
    // Card & Modal
    card: "#FFFFFF",
    modalOverlay: "rgba(13, 27, 42, 0.6)",
    modalBackground: "#FFFFFF",
    modalBorder: "#E2DCF2",

    // Chips
    chipBackground: "#EFEBF8",
    chipText: "#5B3EBA",
    chipBorder: "#DDD5F3",

    // Compatibility tokens
    icon: "#718096",
    tint: "#F6A623",
  },
  dark: {
    // Background & Surfaces
    background: "#070B14", // Deep black-navy base
    surface: "#0F172A", // Rich navy card surface
    surfaceSubtle: "#162038", // Elevated navy surface
    surfaceHighlight: "#232042", // Navy-lavender highlight
    
    // Borders
    border: "#1E2A3D", // Dark navy border
    borderStrong: "#2E3D56", // Elevated dark border
    
    // Typography
    text: "#FFFFFF", // Pure white primary text
    textSecondary: "#A0AEC0", // Light navy-slate secondary text
    textMuted: "#718096", // Muted slate text
    
    // Accents & Actions
    primary: "#F6A623", // Vibrant orange primary CTA
    primaryDark: "#E08A0A", // Deeper orange for hover/pressed
    primaryText: "#070B14", // Dark contrast text on orange
    
    secondary: "#A78BFA", // Lavender accent
    secondarySurface: "#262042", // Dark lavender chip/badge surface
    secondaryText: "#DDD6FE", // Lavender badge text
    
    // Inputs
    inputBackground: "#131D33",
    inputBorder: "#1E2A3D",
    inputText: "#FFFFFF",
    placeholder: "#4A5568",
    
    // Navigation / Tabs
    tabBarBackground: "#070B14",
    tabBarBorder: "#1E2A3D",
    tabBarActive: "#F6A623",
    tabBarInactive: "#718096",
    
    // Status colors
    statusPending: "#F6A623",
    statusInProgress: "#63B3ED",
    statusDone: "#68D391",
    
    // Danger / Alerts
    danger: "#E53E3E",
    dangerSurface: "#2D1515",
    dangerText: "#FEB2B2",
    
    // Card & Modal
    card: "#0F172A",
    modalOverlay: "rgba(0, 0, 0, 0.75)",
    modalBackground: "#131929",
    modalBorder: "#1E2A3D",

    // Chips
    chipBackground: "#1E1B38",
    chipText: "#C4B5FD",
    chipBorder: "#342C5B",

    // Compatibility tokens
    icon: "#A0AEC0",
    tint: "#F6A623",
  },
};

export type ThemeColors = typeof Colors.dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const hitSlop = {
  small: 8,
  medium: 10,
  large: 12,
};

export function getStatusStyle(colors: ThemeColors, status: string) {
  const map = {
    pending: colors.statusPending,
    in_progress: colors.statusInProgress,
    done: colors.statusDone,
  } as const;

  const color = map[status as keyof typeof map] ?? colors.textMuted;

  return {
    badgeBg: `${color}22`,
    text: color,
    dot: color,
  };
}

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
