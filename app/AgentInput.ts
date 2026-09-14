export interface AgentImageInput {
  type: "input_image";
  image_url: string;
  detail?: "low" | "high" | "auto";
}

export interface AgentFileInput {
  type: "input_file";
  filename: string;
  file_data: string;
}

export interface AgentTextInput {
  type: "input_text";
  text: string;
}

export type AgentContentPart = AgentTextInput | AgentImageInput | AgentFileInput;
export type AgentInput = string | AgentContentPart[];

export interface AgentAttachment {
  filename: string;
  mediaType: string;
  size: number;
  content: Buffer;
}

export function attachmentToContent(attachment: AgentAttachment): AgentContentPart {
  const base64 = attachment.content.toString("base64");
  const dataUrl = `data:${attachment.mediaType || "application/octet-stream"};base64,${base64}`;
  if (attachment.mediaType.startsWith("image/")) {
    return { type: "input_image", image_url: dataUrl, detail: "auto" };
  }
  return { type: "input_file", filename: attachment.filename, file_data: dataUrl };
}
