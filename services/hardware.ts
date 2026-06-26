import { authenticatedFetch } from "./auth";

const HARDWARE_API_URL = "http://207.154.238.161/api/hardware";

export async function registerDeviceAPI(implantId: string, readerId: string) {
  try {
    const response = await authenticatedFetch(`${HARDWARE_API_URL}/register`, {
      method: "POST",
      body: JSON.stringify({
        implant_id: implantId,
        reader_id: readerId,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      return {
        success: false,
        error: data.error || "Failed to register hardware",
      };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Network error occurred" };
  }
}
