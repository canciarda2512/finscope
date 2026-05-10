
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

const TokenManager = {
  setTokens(at, rt) {
    accessToken = at;
    refreshToken = rt;
    localStorage.setItem('accessToken', at);
    localStorage.setItem('refreshToken', rt);
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
    localStorage.removeItem('accessToken'); 
    localStorage.removeItem('refreshToken');
  },
};

export default TokenManager;
