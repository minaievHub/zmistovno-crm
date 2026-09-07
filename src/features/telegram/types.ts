export type PostStatus =
  "Draft" | "Scheduled" | "Publishing" | "Published" | "Failed" | "Cancelled";
export interface TelegramChat {
  id: string;
  chat_id: string | null;
  title: string;
  description: string;
  kind: "group" | "channel";
  group_id: string | null;
  course_id: string | null;
  campaign_id: string | null;
  username: string;
  invite_link: string;
  member_count: number;
  bot_status: string;
  status: "active" | "archived" | "provisioning" | "failed";
  error: string;
  created_at: string;
}
export interface TelegramPost {
  id: string;
  body: string;
  status: PostStatus;
  author_id: string | null;
  created_at: string;
  scheduled_at: string | null;
  timezone: string;
  published_at: string | null;
  error: string;
}
export interface TelegramMedia {
  id: string;
  post_id: string;
  url: string;
  kind: "photo" | "video" | "document";
  name: string;
  position: number;
}
export interface TelegramButton {
  id: string;
  post_id: string;
  label: string;
  url: string;
  position: number;
}
export interface TelegramDelivery {
  id: string;
  post_id: string;
  chat_id: string;
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  error: string;
  started_at: string | null;
  published_at: string | null;
}
export interface TelegramMessage {
  id: string;
  delivery_id: string;
  message_id: number;
  kind: "text" | "photo" | "video" | "document";
  deleted: boolean;
  pinned: boolean;
}
export interface TelegramTemplate {
  id: string;
  name: string;
  body: string;
}
export interface TelegramJoin {
  id: string;
  chat_id: string;
  user_id: string;
  name: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
}
export interface TelegramEvent {
  id: string;
  actor_id: string | null;
  action: string;
  entity_id: string | null;
  detail: string;
  created_at: string;
}
export interface TelegramData {
  chats: TelegramChat[];
  posts: TelegramPost[];
  media: TelegramMedia[];
  buttons: TelegramButton[];
  deliveries: TelegramDelivery[];
  messages: TelegramMessage[];
  templates: TelegramTemplate[];
  joins: TelegramJoin[];
  events: TelegramEvent[];
  demo: boolean;
}
export interface PostInput {
  id?: string;
  body: string;
  destinations: string[];
  media: { url: string; kind: TelegramMedia["kind"]; name: string }[];
  buttons: { label: string; url: string }[];
  mode: "draft" | "now" | "schedule";
  localTime: string;
  timezone: string;
}
export interface BotMessage {
  message_id: number;
  chat: { id: number };
}
export interface ChatInfo {
  id: number;
  title?: string;
  description?: string;
  username?: string;
  type: string;
  invite_link?: string;
}
export interface GroupInput {
  requestId: string;
  title: string;
  description: string;
  mode: "create" | "existing";
  existingId?: string;
  groupId?: string;
  courseId?: string;
  campaignId?: string;
  addBot: boolean;
  invite: boolean;
}
