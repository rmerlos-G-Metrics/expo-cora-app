import * as SecureStore from "expo-secure-store";

const API_URL = "http://207.154.238.161/api/auth/login";

export async function loginUser(email, password) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.accessToken && data.refreshToken) {
      await SecureStore.setItemAsync("accessToken", data.accessToken);
      await SecureStore.setItemAsync("refreshToken", data.refreshToken);
      return { success: true, data };
    } else {
      return { success: false, error: data.message || "Login failed" };
    }
  } catch (error) {
    return { success: false, error: "Network error ocurred" };
  }
}

export async function getStoredTokens() {
  const accessToken = await SecureStore.getItemAsync("accessToken");
  const refreshToken = await SecureStore.getItemAsync("refreshToken");
  return { accessToken, refreshToken };
}

export async function logoutUser() {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
}
