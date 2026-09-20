// [COMMENT LATER] — placeholder. Deliberately unstyled; the real restore flow
// replaces this whole file.
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function StreakRestore() {
  return (
    <>
      {/* The parent stack hides headers, so this turns one on just for the
          placeholder — otherwise there is no way back off it. */}
      <Stack.Screen options={{ title: "Restore streak", headerShown: true }} />
      <View style={styles.root}>
        <Text style={styles.text}>Streak restore goes here.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 17 },
});
