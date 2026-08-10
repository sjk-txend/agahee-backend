export function getConversationRoomId(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}