import { createPetHttpClient } from "./httpClient.js";

export function createShopApi() {
  const client = createPetHttpClient();

  return {
    getShop: (options = {}) => client.request("/api/shop", { method: "GET", ...options }),
    buyItem: (body, options = {}) => client.request("/api/shop/buy", { method: "POST", body, ...options }),
  };
}

