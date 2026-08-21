import { Stack } from "expo-router";
import { useThemeColors } from "@/constants/theme";

export default function AuthLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.canvas },
        headerShown: false,
      }}
    >
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
