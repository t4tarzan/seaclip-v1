/**
 * Streaming response handler for LLM providers
 * Unified SSE/streaming parser for OpenAI and Anthropic formats
 */

export interface StreamChunk {
  delta: string;
  finishReason?: string;
}

export interface StreamResult {
  fullText: string;
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Process OpenAI-style streaming response
 */
export async function processOpenAIStream(
  stream: AsyncIterable<any>,
  onChunk?: (chunk: StreamChunk) => void,
): Promise<StreamResult> {
  let fullText = '';
  let finishReason: string | undefined;
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    const finish = chunk.choices?.[0]?.finish_reason;

    if (delta) {
      fullText += delta;
      onChunk?.({ delta });
    }

    if (finish) {
      finishReason = finish;
    }

    // Extract usage if available
    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens || 0,
        outputTokens: chunk.usage.completion_tokens || 0,
      };
    }
  }

  return { fullText, finishReason, usage };
}

/**
 * Process Anthropic-style streaming response
 */
export async function processAnthropicStream(
  stream: AsyncIterable<any>,
  onChunk?: (chunk: StreamChunk) => void,
): Promise<StreamResult> {
  let fullText = '';
  let finishReason: string | undefined;
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const event of stream) {
    // content_block_delta events contain text deltas
    if (event.type === 'content_block_delta' && event.delta?.text) {
      const delta = event.delta.text;
      fullText += delta;
      onChunk?.({ delta });
    }

    // message_stop event signals completion
    if (event.type === 'message_stop') {
      finishReason = 'stop';
    }

    // message_delta contains usage info
    if (event.type === 'message_delta' && event.usage) {
      usage = {
        inputTokens: event.usage.input_tokens || 0,
        outputTokens: event.usage.output_tokens || 0,
      };
    }
  }

  return { fullText, finishReason, usage };
}

/**
 * Create a timeout wrapper for streams
 */
export async function withStreamTimeout<T>(
  streamPromise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    streamPromise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Stream timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Accumulate stream chunks with backpressure handling
 */
export class StreamAccumulator {
  private chunks: string[] = [];
  private maxChunks: number;

  constructor(maxChunks = 10000) {
    this.maxChunks = maxChunks;
  }

  add(chunk: string): void {
    if (this.chunks.length >= this.maxChunks) {
      throw new Error('Stream accumulator overflow');
    }
    this.chunks.push(chunk);
  }

  getText(): string {
    return this.chunks.join('');
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  clear(): void {
    this.chunks = [];
  }
}
