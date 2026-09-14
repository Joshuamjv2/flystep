// ble/useBle.js
import { useContext } from "react";
import { BluetoothContext } from "../contexts/bluetoothContext";

export const useBt = () => {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error("useBle must be used inside a <BleProvider>");
  }
  return ctx;
};
