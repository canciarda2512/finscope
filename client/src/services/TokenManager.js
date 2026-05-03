// client/src/services/TokenManager.js

let accessToken = null;
let refreshToken = null;

const TokenManager = {
  setTokens(at, rt) {
    accessToken = at;
    refreshToken = rt;
  },

  getAccessToken() {
    return accessToken;
  },

  getRefreshToken() {
    return refreshToken;
  },

  clear() {
    accessToken = null;
    refreshToken = null;
  },
};

export default TokenManager;
