import { Image } from "expo-image";
import { useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useThemeColors } from "@/constants/theme";

type TextFieldProps<T extends FieldValues> = Omit<
  TextInputProps,
  "value" | "onChangeText"
> & {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Renders the field as a password with a show/hide eye toggle. */
  secure?: boolean;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  secure = false,
  ...inputProps
}: TextFieldProps<T>) {
  const colors = useThemeColors();
  const [revealed, setRevealed] = useState(false);
  const {
    field,
    fieldState: { error },
  } = useController({ control, name });

  return (
    <View className="gap-1.5">
      <Text className="font-semibold text-caption text-ink-muted">{label}</Text>

      <View className="relative justify-center">
        <TextInput
          className={`h-12 rounded-button border bg-surface px-4 text-body text-ink ${
            error ? "border-accent" : "border-line"
          } ${secure ? "pr-12" : ""}`}
          onBlur={field.onBlur}
          onChangeText={field.onChange}
          placeholderTextColor={colors.inkSubtle}
          secureTextEntry={secure && !revealed}
          style={{ borderCurve: "continuous" }}
          value={field.value ?? ""}
          {...inputProps}
        />

        {secure ? (
          <Pressable
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            accessibilityRole="button"
            className="absolute right-0 h-12 w-12 items-center justify-center"
            // Toggling is a deliberate action; keep the tap target the full 44pt minimum.
            onPress={() => setRevealed((current) => !current)}
          >
            <Image
              source={revealed ? "sf:eye.slash" : "sf:eye"}
              style={{ width: 20, height: 20 }}
              tintColor={colors.inkMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Amber, not red — validation is guidance, not a failure state. */}
      {error ? (
        <Text className="text-accent text-caption">{error.message}</Text>
      ) : null}
    </View>
  );
}
