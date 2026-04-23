import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { initChatModel } from 'langchain/chat_models/universal';

const SUPPORTED_PROVIDERS = [
  'openai',
  'openrouter',
  'anthropic',
  'azure_openai',
  'cohere',
  'google-vertexai',
  'google-vertexai-web',
  'google-genai',
  'ollama',
  'together',
  'fireworks',
  'mistralai',
  'groq',
  'bedrock',
  'cerebras',
  'deepseek',
  'xai',
] as const;

/**
 * Load a chat model from a fully specified name.
 * Supported formats:
 * - provider/model-name
 * - openrouter/provider/model-name
 */
export async function loadChatModel(
  fullySpecifiedName: string,
  temperature: number = 0.2,
): Promise<BaseChatModel> {
  const index = fullySpecifiedName.indexOf('/');

  if (index === -1) {
    if (
      !SUPPORTED_PROVIDERS.includes(
        fullySpecifiedName as (typeof SUPPORTED_PROVIDERS)[number],
      )
    ) {
      throw new Error(`Unsupported model: ${fullySpecifiedName}`);
    }

    return await initChatModel(fullySpecifiedName, {
      temperature,
    });
  }

  const provider = fullySpecifiedName.slice(0, index);
  const model = fullySpecifiedName.slice(index + 1);

  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    return new ChatOpenAI({
      model,
      temperature,
      streamUsage: false,
      configuration: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });
  }

  if (
    !SUPPORTED_PROVIDERS.includes(
      provider as (typeof SUPPORTED_PROVIDERS)[number],
    )
  ) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return await initChatModel(model, {
    modelProvider: provider,
    temperature,
  });
}