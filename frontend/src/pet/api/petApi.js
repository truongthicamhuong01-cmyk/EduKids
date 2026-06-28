import { createPetHttpClient } from "./httpClient.js";

export function createPetApi() {
  const client = createPetHttpClient();

  return {
    getPet: (options = {}) => client.request("/api/pet", { method: "GET", ...options }),
    selectPet: (body, options = {}) => client.request("/api/pet/select", { method: "POST", body, ...options }),
    feedPet: (body, options = {}) => client.request("/api/pet/feed", { method: "POST", body, ...options }),
    playPet: (body, options = {}) => client.request("/api/pet/play", { method: "POST", body, ...options }),
    sleepPet: (body, options = {}) => client.request("/api/pet/sleep", { method: "POST", body, ...options }),
    wakePet: (body, options = {}) => client.request("/api/pet/wake", { method: "POST", body, ...options }),
  };
}
