import React from "react";
import { router, Stack } from "expo-router";
import ScriptDetailScreen from "@/screens/presentation/script-detail";

/**
 * A public deck opens the *same* screen as one of your own — the route just
 * marks it as someone else's (the `public` param the feed card passes), which
 * swaps the data source and the toolbar. One screen, one set of components.
 *
 * The back button is declared here rather than in the screen, matching
 * (script)/[id]: the screen hides the default header, so each route that hosts
 * it provides its own way out.
 */
const PublicDeck = () => (
  <>
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={"chevron.backward"}
        onPress={() => router.back()}
      />
    </Stack.Toolbar>
    <ScriptDetailScreen />
  </>
);

export default PublicDeck;
