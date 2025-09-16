let authToken: string | undefined;

export function setAuthToken(token: string | undefined) {
  console.log('[authToken] setAuthToken called');
  authToken = token;
}

export function getAuthToken(): string | undefined {
  return authToken;
}
