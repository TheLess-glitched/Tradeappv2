import { Colors } from "../constants/theme";
import { useTheme } from "../context/theme-context";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  try {
    const { colorScheme, colors } = useTheme();
    const colorFromProps = props[colorScheme];
    if (colorFromProps) {
      return colorFromProps;
    }
    return colors[colorName];
  } catch {
    const colorFromProps = props.dark;
    return colorFromProps || Colors.dark[colorName];
  }
}
