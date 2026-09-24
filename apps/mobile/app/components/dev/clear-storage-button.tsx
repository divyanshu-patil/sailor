// components/dev/ClearStorageButton.tsx
import { TouchableOpacity, Text, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { clearAppStorage } from "@/utils/dev-tools";

export default function ClearStorageButton() {
  const router = useRouter();

  const handlePress = () => {
    Alert.alert(
      "Clear App Storage",
      "This will log you out and reset onboarding. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const success = await clearAppStorage();
            if (success) {
              router.replace("/(unauthenticated)");
            } else {
              Alert.alert("Error", "Failed to clear storage. Check console.");
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Text style={styles.text}>Clear App Storage (Dev)</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    marginVertical: 12,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
