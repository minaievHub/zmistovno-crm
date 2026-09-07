// Future integrations produce drafts/proposals; publishing always remains an explicit action.
export type SchoolTelegramEvent =
  | {
      type: "campaign.created";
      campaignId: string;
      courseName: string;
      registrationUrl: string;
    }
  | { type: "group.schedule_changed"; groupId: string; lessonTime: string }
  | { type: "lesson.starts_soon"; groupId: string; startsAt: string }
  | { type: "lesson.cancelled"; groupId: string; lessonId: string };
export interface TelegramAutomationRule {
  id: string;
  event: SchoolTelegramEvent["type"];
  enabled: boolean;
  templateId: string;
  action: "create_draft" | "schedule_approved_template";
}
export interface PublicationAiProvider {
  generate(input: {
    prompt: string;
    intent: "create" | "shorten" | "warmer" | "emoji" | "rewrite";
    currentText: string;
  }): Promise<{ text: string }>;
}
export interface TelegramInboxAdapter {
  listConversations(
    cursor?: string,
  ): Promise<{
    items: {
      chatId: string;
      leadId?: string;
      studentId?: string;
      lastMessageAt: string;
    }[];
    cursor?: string;
  }>;
}
