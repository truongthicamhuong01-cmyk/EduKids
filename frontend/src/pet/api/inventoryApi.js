import { createPetHttpClient } from "./httpClient.js";

export function createInventoryApi() {
  const client = createPetHttpClient();

  return {
    getInventory: (options = {}) => client.request("/api/pet/inventory", { method: "GET", ...options }),
    useItem: (body, options = {}) => client.request("/api/pet/inventory/use", { method: "POST", body, ...options }),
  };
}

