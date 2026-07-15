import { AppleSignInButton } from "@/components/ui/auth/AppleSignInButton";
import { GoogleSignInButton } from "@/components/ui/auth/GoogleSignInButton";
import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts } from "@/constants/fonts";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { Image } from "expo-image";

export default function CreateAccount() {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/create_an_account.png")}
          style={styles.image}
          contentFit="cover"
          contentPosition={{ bottom: -80 }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>Create an Account</Text>

        <GoogleSignInButton logoSource={require("@/assets/icons/google.png")} />
        <AppleSignInButton />

        <Pressable
          style={styles.emailButton}
          onPress={() => router.push("/(unauthenticated)/(signup)/signup")}
        >
          <FontAwesome6
            name="envelope"
            iconStyle="solid"
            size={18}
            color="#666"
          />
          <Text style={styles.emailButtonText}>Continue with Email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#FFFEFE",
  },

  container: {
    flex: 1,
    paddingHorizontal: 30,
  },

  hero: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    marginBottom: 24,
  },

  image: {
    width: "100%",
    aspectRatio: 1,
  },

  title: {
    fontSize: 30,
    fontFamily: fonts.alanSans.bold,
    textAlign: "center",
    marginBottom: 12,
  },

  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },

  emailButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#1A1A1A",
    fontFamily: fonts.alanSans.semiBold,
  },
});
