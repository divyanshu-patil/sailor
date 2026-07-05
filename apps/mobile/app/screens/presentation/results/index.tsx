import { StyleSheet, Text, View } from "react-native";
import React from "react";

interface ResultsScreenProps {
  title: string;
  script: string;
}

const ResultsScreen = ({ title }: ResultsScreenProps) => {
  return (
    <View>
      <Text>ResultsScreen</Text>
    </View>
  );
};

export default ResultsScreen;

const styles = StyleSheet.create({});
