import React, { useState, useEffect } from "react";
import { FlatList, StyleSheet, View, useColorScheme } from "react-native";
import ThemedView from "../../components/ThemedView";
import ThemedText from "../../components/ThemedText";
import { useBt } from "../../hooks/useBluetooth";
import { Colors } from "../../constants/Colors";
import { t } from "../../constants/translations";
import { useAuth } from "../../hooks/useAuth";

export default function DiagnosticsScreen() {
  const { sendData, connectedDevice, receivedData } = useBt();
  const [leds, setLeds] = useState(Array(24).fill(0));
  const [batteries, setBatteries] = useState([0, 0]); // [mainBattery, txBattery]
  const [loading, setLoading] = useState(false);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { language } = useAuth();

  // ---------------------------
  // Diagnostics Parser
  // ---------------------------
  const parseDiagnosticsMessage = (msg) => {
    console.log(msg.length, "Message length", msg);
    if (!msg || msg[0] !== "d") return null;
    if (msg.length < 27) return null;

    const ledChars = msg.slice(1, 25);
    const battery1 = parseInt(msg[25], 10);
    const battery2 = parseInt(msg[26], 10);

    const leds = ledChars.split("").map((c) => {
      const n = parseInt(c, 10);
      return isNaN(n) ? 0 : n;
    });

    return {
      leds,
      batteries: [battery1, battery2],
      raw: msg,
    };
  };

  useEffect(() => {
    if (!receivedData) return;

    const parsed = parseDiagnosticsMessage(receivedData);
    if (!parsed) return;

    setLeds(parsed.leds);
    setBatteries(parsed.batteries);
    setLoading(false);
  }, [receivedData]);

  // Send "D" every second
  useEffect(() => {
    if (!connectedDevice) return;
    setLoading(true);
    sendData("D");
    // const interval = setInterval(() => {
    //   // sendData("N");
    // }, 1000);
    // return () => clearInterval(interval);
  }, [connectedDevice, sendData]);

  // LED colors
  const ledColor = (state) => {
    switch (state) {
      case 0:
        return "#ef4444";
      case 1:
        return "#22c55e";
      case 2:
        return "#3b82f6";
      case 3:
        return "#9ca3af";
      default:
        return "#9ca3af";
    }
  };

  const batteryColor = (state) => {
    switch (state) {
      case 0:
        return "#ef4444";
      case 1:
        return "#facc15";
      case 2:
        return "#22c55e";
      case 3:
        return "#9ca3af";
      default:
        return "#9ca3af";
    }
  };

  const renderLed = ({ item }) => (
    <View style={[styles.ledDot, { backgroundColor: ledColor(item) }]} />
  );

  return (
    <ThemedView safe style={styles.container}>
      <ThemedText title style={styles.title}>
        {t[language]?.diag_title || t.en.diag_title}
      </ThemedText>

      {!connectedDevice ? (
        <ThemedText style={[styles.cta, { color: theme.text }]}>
          {t[language]?.diag_no_device || t.en.diag_no_device}
        </ThemedText>
      ) : (
        <View style={styles.content}>
          {/* LED STRIP */}
          <FlatList
            data={leds}
            renderItem={renderLed}
            keyExtractor={(_, idx) => idx.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ledRow}
          />

          {/* BATTERIES */}
          <View style={styles.batteryContainer}>
            <View
              style={[
                styles.batteryCircle,
                { backgroundColor: batteryColor(batteries[0]) },
              ]}
            >
              {/* main */}
              <ThemedText style={styles.batteryText}>TX</ThemedText>
            </View>

            <View
              style={[
                styles.batteryCircle,
                { backgroundColor: batteryColor(batteries[1]) },
              ]}
            >
              <ThemedText style={styles.batteryText}>RX</ThemedText>
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // LED row
  ledRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },

  ledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },

  // Batteries
  batteryContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40,
    gap: 30,
  },

  batteryCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },

  batteryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
