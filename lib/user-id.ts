/** 端末に永続化するユーザーID（提出・振興券配布の紐付けに利用） */

const USER_ID_KEY = "disaster-app-user-id";

function generateId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return generateId();
  }
}
