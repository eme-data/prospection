export const msalConfig = {
    auth: {
        clientId: "67ae828e-a871-46c9-9606-925672c43c4e", // Hardcoded temporarily to bypass Vite env issues
        authority: "https://login.microsoftonline.com/11d55f60-e3b1-48e4-a5cd-911c091fc1a7",
        redirectUri: "/",
        postLogoutRedirectUri: "/",
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
};

export const loginRequest = {
    scopes: ["User.Read"]
};
