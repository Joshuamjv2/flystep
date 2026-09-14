import { PermissionsAndroid, Platform } from "react-native";
import { request, PERMISSIONS } from "react-native-permissions";

export async function requestBlePermissions() {
  if (Platform.OS === "android") {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
  }

  if (Platform.OS === "ios") {
    await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
    await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  }
}
