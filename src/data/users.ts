/**
 * Stashly has no accounts yet, so this is a single local-session identity rather
 * than a user directory. Replace it with real users when authentication lands.
 */
export const users = [
  {
    id: "local",
    name: "Local session",
    username: "local",
    email: "Nothing is written to disk",
    avatar: "",
    role: "owner",
  },
];

export const rootUser = users[0];
