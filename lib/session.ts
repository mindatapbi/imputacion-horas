import { SessionOptions } from "iron-session";

export interface SessionData {
  user?: {
    accountId: string;
    displayName: string;
    email: string;
    avatarUrl: string;
  };
  cloudId?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET as string,
  cookieName: "jira-imputacion-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};