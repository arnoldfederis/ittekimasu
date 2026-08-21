import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  View,
} from "react-native";
import { useThemeColors } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "regular" | "large" | "auth";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Rendered to the left of the title — an icon, a flame, a provider logo. */
  leading?: React.ReactNode;
  className?: string;
};

const container: Record<Variant, string> = {
  primary: "bg-primary active:bg-primary-pressed",
  secondary: "bg-surface border border-line active:bg-surface-sunken",
  ghost: "bg-transparent active:bg-surface-sunken",
  // The only place a warning colour is allowed: irreversible account actions.
  destructive: "bg-surface border border-line active:bg-surface-sunken",
};

const label: Record<Variant, string> = {
  primary: "text-ink-inverse",
  secondary: "text-ink",
  ghost: "text-primary",
  destructive: "text-[#D9584B]",
};

const height: Record<Size, string> = {
  regular: "h-12",
  large: "h-14",
  auth: "h-14",
};

/**
 * `auth` matches Apple's native Sign in with Apple button, which renders its label at 43%
 * of the button height in a medium weight. Using the app's normal body size next to it
 * makes the two buttons look mismatched.
 */
const labelSize: Record<Size, string> = {
  regular: "text-body font-semibold",
  large: "text-body font-semibold",
  auth: "text-auth-button font-medium",
};

export function Button({
  title,
  variant = "primary",
  size = "regular",
  loading = false,
  leading,
  disabled,
  className = "",
  ...rest
}: ButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`${height[size]} ${container[variant]} flex-row items-center justify-center gap-2 rounded-button px-5 ${isDisabled ? "opacity-50" : ""} ${className}`}
      disabled={isDisabled}
      style={{ borderCurve: "continuous" }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.inkInverse : colors.primary}
        />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text className={`${labelSize[size]} ${label[variant]}`}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
