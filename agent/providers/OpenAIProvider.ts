import OpenAI from "openai";

export interface ModelRequest { instructions?: string; input: string; model?: string; previousResponseId?: string; }
export interface ModelResponse { id: string; text: string; rawOutputTypes: string[]; }
export interface ModelProvider { complete(request: ModelRequest): Promise<ModelResponse>; }

export class OpenAIProvider implements ModelProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  constructor(model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
  }
  async complete(request: ModelRequest): Promise<ModelResponse> {
    const response = await this.client.responses.create({
      model: request.model ?? this.model,
      ...(request.instructions ? { instructions: request.instructions } : {}),
      input: request.input,
      ...(request.previousResponseId ? { previous_response_id: request.previousResponseId } : {})
    });
    return { id: response.id, text: response.output_text, rawOutputTypes: response.output.map((item) => item.type) };
  }
}
