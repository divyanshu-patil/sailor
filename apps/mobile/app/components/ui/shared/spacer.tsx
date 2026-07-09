import { StyleSheet } from "react-native";
import React from "react";
import Animated, { LinearTransition } from "react-native-reanimated";

const Spacer = () => {
  return (
    <Animated.View
      style={styles.spacer}
      layout={LinearTransition.springify()}
    />
  );
};

export default Spacer;

const styles = StyleSheet.create({ spacer: { flex: 1 } });
