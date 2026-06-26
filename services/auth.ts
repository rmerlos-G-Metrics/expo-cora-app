import * as SecureStore from "expo-secure-store";

const BASE_URL = "http://207.154.238.161/api/auth";

export async function loginUser(email, password) {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
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

export async function signupUser(email, password) {
  try {
    const response = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || "Registration failed" };
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

export async function refreshAccessToken() {
  try {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) throw new Error("No refresh token found");

    const response = await fetch(`${BASE_URL}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (response.ok && data.accessToken) {
      await SecureStore.setItemAsync("accessToken", data.accessToken);
      return data.accessToken;
    } else {
      await logoutUser();
      throw new Error("Session expired. Please log in again.");
    }
  } catch (error) {
    await logoutUser();
    throw error;
  }
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
) {
  let { accessToken } = await getStoredTokens();

  const getHeaders = (token) => ({
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  let response = await fetch(url, {
    ...options,
    headers: getHeaders(accessToken),
  });

  // If the token expired, attempt exactly one refresh and retry
  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    response = await fetch(url, {
      ...options,
      headers: getHeaders(newAccessToken),
    });
  }

  return response;
}
