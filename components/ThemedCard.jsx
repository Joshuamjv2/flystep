import React from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Colors } from "../constants/Colors";

function ThemedCard({ style, ...props }) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? colorScheme.light;
    return (
        <View
        style={[{ backgroundColor: theme.uiBackground }, styles.card, style]}
        {...props}
        />
    );
}

export default ThemedCard;
const styles = StyleSheet.create({
    card: {
        borderRadius: 5,
        padding: 20,
    },
});
