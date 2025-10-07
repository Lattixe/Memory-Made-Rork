import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { safeJsonParse } from "@/utils/json";

type OpenAIImageEditRequest = {
  model: 'gpt-image-1-mini' | 'gpt-image-1';
  prompt: string;
  image: string;
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  output_format?: 'png' | 'webp';
  background?: 'transparent' | 'opaque' | 'auto';
  content_moderation?: 'low' | 'medium' | 'high';
  quality?: 'low' | 'medium' | 'high';
};

type OpenAIImageEditResponse = {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
};

export const editImageProcedure = publicProcedure
  .input(
    z.object({
      base64Data: z.string(),
      prompt: z.string(),
      model: z.enum(['gpt-image-1-mini', 'gpt-image-1']).default('gpt-image-1-mini'),
      size: z.enum(['1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
      background: z.enum(['transparent', 'opaque', 'auto']).default('transparent'),
      content_moderation: z.enum(['low', 'medium', 'high']).default('low'),
      quality: z.enum(['low', 'medium', 'high']).default('medium'),
      timeout: z.number().default(60000),
    })
  )
  .mutation(async ({ input }) => {
    const {
      base64Data,
      prompt,
      model,
      size,
      background,
      content_moderation,
      quality,
      timeout,
    } = input;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`[backend] Calling OpenAI ${model} API for image editing...`);
      console.log(`[backend] Settings: size=${size}, background=${background}, output_format=png, content_moderation=${content_moderation}, quality=${quality}`);

      const requestBody: OpenAIImageEditRequest = {
        model,
        prompt,
        image: base64Data,
        n: 1,
        size,
        output_format: 'png',
        background,
        content_moderation,
        quality,
      };

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured on server');
      }

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[backend] OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      const jsonResult = safeJsonParse<OpenAIImageEditResponse>(responseText);

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

        const arrayBuffer = await imageResponse.arrayBuffer();
        resultBase64 = Buffer.from(arrayBuffer).toString('base64');
      } else {
        throw new Error('No image data in OpenAI response');
      }

      console.log('[backend] OpenAI image edit successful');
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

      console.error('[backend] OpenAI edit error:', error);
      throw error;
    }
  });
