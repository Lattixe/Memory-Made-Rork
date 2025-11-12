import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { safeJsonParse } from '@/utils/json';

type OpenAIImageGenerateRequest = {
  model: 'gpt-image-1-mini' | 'gpt-image-1';
  prompt: string;
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  output_format?: 'png' | 'webp';
  background?: 'transparent' | 'opaque' | 'auto';
  quality?: 'low' | 'medium' | 'high';
};

type OpenAIImageGenerateResponse = {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
};

type OpenAIImageEditRequest = {
  model: 'gpt-image-1-mini' | 'gpt-image-1';
  prompt: string;
  image: string;
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  output_format?: 'png' | 'webp';
  background?: 'transparent' | 'opaque' | 'auto';
  quality?: 'low' | 'medium' | 'high';
};

export type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};

function resolveOpenAIKey(): string | undefined {
  console.log('[openaiImageApi] Attempting to resolve OpenAI API key...');
  
  const envAny = ((process as any)?.env ?? {}) as Record<string, string | undefined>;
  const fromEnv = envAny.EXPO_PUBLIC_OPENAI_API_KEY ?? envAny.EXPO_PUBLIC_OPENAI;
  console.log('[openaiImageApi] fromEnv:', fromEnv ? 'found' : 'not found');

  const extra = (Constants?.expoConfig as any)?.extra ?? {};
  const fromExtraDirect =
    extra?.EXPO_PUBLIC_OPENAI_API_KEY ??
    extra?.EXPO_PUBLIC_OPENAI ??
    extra?.OPENAI_API_KEY;
  console.log('[openaiImageApi] fromExtraDirect:', fromExtraDirect ? 'found' : 'not found');
  
  const fromExtraNested =
    extra?.openai?.apiKey ??
    extra?.public?.EXPO_PUBLIC_OPENAI_API_KEY ??
    extra?.public?.EXPO_PUBLIC_OPENAI;
  console.log('[openaiImageApi] fromExtraNested:', fromExtraNested ? 'found' : 'not found');

  const fromWindow = Platform.OS === 'web'
    ? (globalThis as any)?.ENV?.EXPO_PUBLIC_OPENAI_API_KEY ??
      (globalThis as any)?.ENV?.EXPO_PUBLIC_OPENAI ??
      (globalThis as any)?.EXPO_PUBLIC_OPENAI_API_KEY ??
      (globalThis as any)?.EXPO_PUBLIC_OPENAI
    : undefined;
  console.log('[openaiImageApi] fromWindow:', fromWindow ? 'found' : 'not found');

  const key = fromEnv ?? fromExtraDirect ?? fromExtraNested ?? fromWindow;
  if (key) {
    try {
      const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '***';
      console.log(`[openaiImageApi] OpenAI key detected (${masked}).`);
    } catch {}
  } else {
    console.log('[openaiImageApi] No OpenAI key found in any location');
    console.log('[openaiImageApi] Available extra keys:', Object.keys(extra));
    console.log('[openaiImageApi] Available env keys:', Object.keys(envAny).filter(k => k.includes('OPENAI')));
  }
  return key;
}

function assertApiKeyOrThrow(): string {
  const key = resolveOpenAIKey();
  if (!key) {
    throw new Error(
      'OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in your environment (.env), or add it to app.json under expo.extra.public.EXPO_PUBLIC_OPENAI_API_KEY, or provide extra.openai.apiKey.'
    );
  }
  return key;
}

export async function callOpenAIImageGenerate(
  prompt: string,
  options: {
    model?: 'gpt-image-1-mini' | 'gpt-image-1';
    size?: '1024x1024' | '1024x1792' | '1792x1024';
    background?: 'transparent' | 'opaque' | 'auto';
    quality?: 'low' | 'medium' | 'high';
    timeout?: number;
  } = {}
): Promise<ImageEditResponse> {
  const {
    model = 'gpt-image-1-mini',
    size = '1024x1024',
    background = 'transparent',
    quality = 'medium',
    timeout = 60000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Calling OpenAI ${model} API for image generation...`);
    console.log(`Settings: size=${size}, background=${background}, quality=${quality}, output_format=png`);

    const requestBody: OpenAIImageGenerateRequest = {
      model,
      prompt,
      n: 1,
      size,
      output_format: 'png',
      background,
      quality,
    };

    const apiKey = assertApiKeyOrThrow();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const form = new FormData();
    form.append('model', requestBody.model);
    form.append('prompt', requestBody.prompt);
    form.append('n', String(requestBody.n ?? 1));
    form.append('size', requestBody.size ?? '1024x1024');
    if (requestBody.background) form.append('background', requestBody.background);
    if (requestBody.quality) form.append('quality', requestBody.quality);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const responseText = await response.text();
    const jsonResult = safeJsonParse<OpenAIImageGenerateResponse>(responseText);

    if (!jsonResult.success) {
      throw new Error('Invalid response format from OpenAI');
    }

    const data = jsonResult.data!;

    if (!data?.data || data.data.length === 0) {
      throw new Error('No images in OpenAI response');
    }

    const imageData = data.data[0];
    let base64Data: string;

    if (imageData.b64_json) {
      console.log('[openaiImageApi] Using b64_json from response, size:', imageData.b64_json.length);
      base64Data = imageData.b64_json;
    } else if (imageData.url) {
      console.log('[openaiImageApi] Fetching image from URL:', imageData.url);
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image from URL');
      }

      const blob = await imageResponse.blob();
      const reader = new FileReader();

      base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      throw new Error('No image data in OpenAI response');
    }

    if (!base64Data || base64Data.length === 0) {
      console.error('[openaiImageApi] Empty base64 data received');
      throw new Error('Empty image data received from OpenAI');
    }

    console.log('[openaiImageApi] Image generation successful, data size:', base64Data.length);
    return {
      image: {
        base64Data,
        mimeType: 'image/png',
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out');
    }

    throw error;
  }
}

export async function callOpenAIImageEdit(
  base64Data: string,
  prompt: string,
  options: {
    model?: 'gpt-image-1-mini' | 'gpt-image-1';
    size?: '1024x1024' | '1024x1792' | '1792x1024';
    background?: 'transparent' | 'opaque' | 'auto';
    quality?: 'low' | 'medium' | 'high';
    timeout?: number;
  } = {}
): Promise<ImageEditResponse> {
  const {
    model = 'gpt-image-1-mini',
    size = '1024x1024',
    background = 'transparent',
    quality = 'medium',
    timeout = 60000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Calling OpenAI ${model} API for image editing...`);
    console.log(`Settings: size=${size}, background=${background}, quality=${quality}, output_format=png`);

    const requestBody: OpenAIImageEditRequest = {
      model,
      prompt,
      image: base64Data,
      n: 1,
      size,
      output_format: 'png',
      background,
      quality,
    };

    const apiKey = assertApiKeyOrThrow();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const form = new FormData();
    form.append('model', requestBody.model);
    form.append('prompt', requestBody.prompt);
    form.append('n', String(requestBody.n ?? 1));
    form.append('size', requestBody.size ?? '1024x1024');
    if (requestBody.background) form.append('background', requestBody.background);
    if (requestBody.quality) form.append('quality', requestBody.quality);

    const dataUri = `data:image/png;base64,${base64Data}`;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(dataUri)).blob();
      const file = new File([blob], 'image.png', { type: 'image/png' });
      form.append('image', file);
    } else {
      form.append('image', {
        uri: dataUri,
        name: 'image.png',
        type: 'image/png',
      } as any);
    }

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const responseText = await response.text();
    const jsonResult = safeJsonParse<OpenAIImageGenerateResponse>(responseText);

    if (!jsonResult.success) {
      throw new Error('Invalid response format from OpenAI');
    }

    const data = jsonResult.data!;

    if (!data?.data || data.data.length === 0) {
      throw new Error('No images in OpenAI response');
    }

    const imageData = data.data[0];
    let resultBase64: string;

    if (imageData.b64_json) {
      console.log('[openaiImageApi] Using b64_json from edit response, size:', imageData.b64_json.length);
      resultBase64 = imageData.b64_json;
    } else if (imageData.url) {
      console.log('[openaiImageApi] Fetching edited image from URL:', imageData.url);
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch edited image from URL');
      }

      const blob = await imageResponse.blob();
      const reader = new FileReader();

      resultBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      throw new Error('No image data in OpenAI response');
    }

    if (!resultBase64 || resultBase64.length === 0) {
      console.error('[openaiImageApi] Empty base64 data received from edit');
      throw new Error('Empty image data received from OpenAI edit');
    }

    console.log('[openaiImageApi] Image edit successful, data size:', resultBase64.length);
    return {
      image: {
        base64Data: resultBase64,
        mimeType: 'image/png',
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out');
    }

    throw error;
  }
}
