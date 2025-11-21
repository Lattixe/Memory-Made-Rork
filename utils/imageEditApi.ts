import { getAdminSettings, EditModel } from '@/app/admin';
import { safeJsonParse } from '@/utils/json';
import { callOpenAIImageEdit, callOpenAIImageGenerate } from '@/utils/openaiImageApi';

type ImageEditRequest = {
  prompt: string;
  images: { type: 'image'; image: string }[];
};

type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};

type SeeDreamRequest = {
  prompt: string;
  image_url: string;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
};

type SeeDreamResponse = {
  images: {
    url: string;
    content_type: string;
  }[];
};

async function callNanoBananaApi(
  base64Data: string,
  prompt: string,
  timeout: number = 4000
): Promise<ImageEditResponse> {
  const requestBody: ImageEditRequest = {
    prompt,
    images: [{ type: 'image', image: base64Data }],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log('Calling Nano Banana API...');
    
    const response = await fetch('https://toolkit.rork.com/images/edit/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status >= 502 && response.status <= 504) {
      throw new Error(`Server temporarily unavailable (${response.status})`);
    }
    
    if (response.status === 429) {
      throw new Error('Rate limited');
    }

    if (!response.ok) {
      throw new Error(`API Error ${response.status}`);
    }

    const responseText = await response.text();
    
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      throw new Error('Received error page');
    }
    
    const jsonResult = safeJsonParse<ImageEditResponse>(responseText);
    
    if (!jsonResult.success) {
      throw new Error('Invalid response format');
    }
    
    const data = jsonResult.data!;
    
    if (!data?.image?.base64Data) {
      throw new Error('Incomplete response');
    }
    
    console.log('Nano Banana API call successful');
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    throw error;
  }
}

async function callGptImageMiniApi(
  base64Data: string,
  prompt: string,
  timeout: number = 60000
): Promise<ImageEditResponse> {
  try {
    console.log('Using OpenAI GPT Image 1 Mini API with transparent background...');
    
    return await callOpenAIImageEdit(base64Data, prompt, {
      model: 'gpt-image-1-mini',
      size: '1024x1024',
      background: 'transparent',
      timeout,
    });
  } catch (error: any) {
    console.error('GPT Image 1 Mini API error:', error.message);
    throw error;
  }
}

async function callSeeDreamApi(
  base64Data: string,
  prompt: string,
  timeout: number = 30000
): Promise<ImageEditResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log('Calling SeeDream API...');
    
    const imageDataUrl = `data:image/png;base64,${base64Data}`;
    
    const requestBody: SeeDreamRequest = {
      prompt,
      image_url: imageDataUrl,
      seed: Math.floor(Math.random() * 1000000),
      guidance_scale: 7.5,
      num_inference_steps: 25,
    };

    const response = await fetch('https://fal.run/fal-ai/bytedance/seedream/v4/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.EXPO_PUBLIC_FAL_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('SeeDream API error:', response.status, errorText);
      throw new Error(`SeeDream API error: ${response.status}`);
    }

    const responseText = await response.text();
    const jsonResult = safeJsonParse<SeeDreamResponse>(responseText);
    
    if (!jsonResult.success) {
      throw new Error('Invalid response format from SeeDream');
    }
    
    const data = jsonResult.data!;
    
    if (!data?.images || data.images.length === 0) {
      throw new Error('No images in SeeDream response');
    }
    
    const imageUrl = data.images[0].url;
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch generated image');
    }
    
    const blob = await imageResponse.blob();
    const reader = new FileReader();
    
    const base64Result = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    console.log('SeeDream API call successful');
    return {
      image: {
        base64Data: base64Result,
        mimeType: data.images[0].content_type || 'image/png',
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('SeeDream request timed out');
    }
    
    throw error;
  }
}

async function callGptImageMiniGenerateApi(
  prompt: string,
  timeout: number = 60000
): Promise<ImageEditResponse> {
  try {
    console.log('Using OpenAI GPT Image 1 Mini API for generation with transparent background...');
    
    return await callOpenAIImageGenerate(prompt, {
      model: 'gpt-image-1-mini',
      size: '1024x1024',
      background: 'transparent',
      timeout,
    });
  } catch (error: any) {
    console.error('GPT Image 1 Mini Generate API error:', error.message);
    throw error;
  }
}

export async function callImageGenerateApi(
  prompt: string,
  retryCount: number = 0
): Promise<ImageEditResponse> {
  const settings = await getAdminSettings();
  const model: EditModel = settings.editModel || 'gpt-image-1-mini';
  
  console.log(`Using model for generation: ${model}`);
  
  try {
    // For now, we only support gpt-image-1-mini for generation as it's the only one with a generation endpoint
    // If we add other models, we can switch here
    return await callGptImageMiniGenerateApi(prompt);
  } catch (error: any) {
    console.error(`Generation API error:`, error.message);
    
    if (retryCount < 1) {
      console.log(`Retrying generation...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return callImageGenerateApi(prompt, retryCount + 1);
    }
    
    throw error;
  }
}

export async function callImageEditApi(
  base64Data: string,
  prompt: string,
  retryCount: number = 0
): Promise<ImageEditResponse> {
  const settings = await getAdminSettings();
  const model: EditModel = settings.editModel || 'gpt-image-1-mini';
  
  console.log(`Using model: ${model}`);
  
  try {
    if (model === 'seedream') {
      return await callSeeDreamApi(base64Data, prompt);
    } else if (model === 'gpt-image-1-mini') {
      return await callGptImageMiniApi(base64Data, prompt);
    } else {
      return await callNanoBananaApi(base64Data, prompt);
    }
  } catch (error: any) {
    console.error(`${model} API error:`, error.message);
    
    if (retryCount < 1 && (model === 'nano-banana' || model === 'gpt-image-1-mini')) {
      console.log(`Retrying ${model}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return callImageEditApi(base64Data, prompt, retryCount + 1);
    }
    
    throw error;
  }
}
