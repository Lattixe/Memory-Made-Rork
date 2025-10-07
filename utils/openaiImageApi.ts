import { Platform } from 'react-native';
import { safeJsonParse } from '@/utils/json';

type OpenAIImageGenerateRequest = {
  model: 'gpt-image-1-mini' | 'gpt-image-1';
  prompt: string;
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  output_format?: 'png' | 'webp';
  background?: 'transparent' | 'opaque' | 'auto';
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
};

export type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};

export async function callOpenAIImageGenerate(
  prompt: string,
  options: {
    model?: 'gpt-image-1-mini' | 'gpt-image-1';
    size?: '1024x1024' | '1024x1792' | '1792x1024';
    background?: 'transparent' | 'opaque' | 'auto';
    timeout?: number;
  } = {}
): Promise<ImageEditResponse> {
  const {
    model = 'gpt-image-1-mini',
    size = '1024x1024',
    background = 'transparent',
    timeout = 60000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Calling OpenAI ${model} API for image generation...`);
    console.log(`Settings: size=${size}, background=${background}, output_format=png`);

    const requestBody: OpenAIImageGenerateRequest = {
      model,
      prompt,
      n: 1,
      size,
      output_format: 'png',
      background,
    };

    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const form = new FormData();
    form.append('model', requestBody.model);
    form.append('prompt', requestBody.prompt);
    form.append('n', String(requestBody.n ?? 1));
    form.append('size', requestBody.size ?? '1024x1024');
    if (requestBody.background) form.append('background', requestBody.background);
    form.append('response_format', 'b64_json');

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
      base64Data = imageData.b64_json;
    } else if (imageData.url) {
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

    console.log('OpenAI image generation successful');
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
    timeout?: number;
  } = {}
): Promise<ImageEditResponse> {
  const {
    model = 'gpt-image-1-mini',
    size = '1024x1024',
    background = 'transparent',
    timeout = 60000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Calling OpenAI ${model} API for image editing...`);
    console.log(`Settings: size=${size}, background=${background}, output_format=png`);

    const requestBody: OpenAIImageEditRequest = {
      model,
      prompt,
      image: base64Data,
      n: 1,
      size,
      output_format: 'png',
      background,
    };

    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const form = new FormData();
    form.append('model', requestBody.model);
    form.append('prompt', requestBody.prompt);
    form.append('n', String(requestBody.n ?? 1));
    form.append('size', requestBody.size ?? '1024x1024');
    if (requestBody.background) form.append('background', requestBody.background);
    form.append('response_format', 'b64_json');

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
      resultBase64 = imageData.b64_json;
    } else if (imageData.url) {
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

    console.log('OpenAI image edit successful');
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
