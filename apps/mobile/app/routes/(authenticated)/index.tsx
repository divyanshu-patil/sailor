import { Redirect } from "expo-router";

import { useProIntroStore } from "@/store/pro-intro.store";
import { useIsPro } from "@/store/subscription.store";

/**
 * The way into the app. Straight home — except right after a sign-in, when
 * someone without Pro sees what it includes first.
 */
const Home = () => {
  const owed = useProIntroStore((s) => s.pending);
  const isPro = useIsPro();
  if (owed && !isPro) {
    return <Redirect href="/(authenticated)/sailors-pro" />;
  }
  return <Redirect href={"/(authenticated)/(tabs)/(home)"} />;
};

export default Home;
