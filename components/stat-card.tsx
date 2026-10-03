import { Pressable, StyleSheet, Text } from "react-native";
import { ThemeColors } from "../constants/theme";

interface StatCardProps {
  label: string;
  value: number | string;
  colors: ThemeColors;
  backgroundColor?: string;
  borderColor?: string;
  labelColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: number;
  subtitleLineHeight?: number;
  subtitleNumberOfLines?: number;
  subtitleAdjustsFontSizeToFit?: boolean;
  valueColor?: string;
  minHeight?: number;
  onPress?: () => void;
}

export default function StatCard({
  label,
  value,
  colors,
  backgroundColor,
  borderColor,
  labelColor,
  subtitle,
  subtitleColor,
  subtitleFontSize = 11,
  subtitleLineHeight,
  subtitleNumberOfLines = 1,
  subtitleAdjustsFontSizeToFit = true,
  valueColor,
  minHeight,
  onPress,
}: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={[
        styles.card,
        {
          backgroundColor: backgroundColor ?? colors.surfaceSubtle,
          borderColor: borderColor ?? colors.border,
          minHeight,
        },
      ]}
    >
      <Text
        style={[styles.label, { color: labelColor ?? colors.textMuted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      <Text
        style={[styles.value, { color: valueColor ?? colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: subtitleColor ?? colors.textSecondary,
              fontSize: subtitleFontSize,
              lineHeight: subtitleLineHeight,
            },
          ]}
          numberOfLines={subtitleNumberOfLines}
          adjustsFontSizeToFit={subtitleAdjustsFontSizeToFit}
          minimumFontScale={subtitleAdjustsFontSizeToFit ? 0.75 : undefined}
          ellipsizeMode="tail"
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 128,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 11, marginTop: 4 },
});