export type UserSession = { userId: string; name?: string };
export async function getUserSession(): Promise<UserSession> { return { userId: 'demo' }; }
