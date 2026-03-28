import {
  PRINTFUL_CONFIG,
  PRINTFUL_PRODUCTS,
  PrintfulOrderRequest,
  PrintfulOrderResponse,
  PrintfulOrderRecipient,
  generateOrderId,
  formatPrintfulPrice,
} from '@/constants/printful';
import { safeJsonParse } from '@/utils/json';

export class PrintfulService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${PRINTFUL_CONFIG.API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    console.log(`Making Printful API request: ${method} ${url}`);
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Printful API error:', response.status, errorText);
      throw new Error(`Printful API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Printful API response:', result);
    
    return result;
  }

  // Upload image to Printful file library with retry logic
  async uploadImage(base64Data: string, filename: string, retries: number = 0): Promise<{ id: number; url: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Uploading image to Printful (attempt ${attempt}/${retries})...`);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second timeout - fail fast
        
        try {
          // Convert base64 to blob for upload
          const response = await fetch(`data:image/png;base64,${base64Data}`);
          const blob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('type', 'default');

          const uploadResponse = await fetch(`${PRINTFUL_CONFIG.API_BASE_URL}/files`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text().catch(() => 'Unknown error');
            
            // Check for specific error codes
            if (uploadResponse.status === 504 || uploadResponse.status === 502 || uploadResponse.status === 503) {
              console.log(`Server error ${uploadResponse.status} - will retry or use fallback`);
              throw new Error(`Server temporarily unavailable`);
            } else if (uploadResponse.status === 413) {
              throw new Error('Image too large. Please try a smaller image.');
            } else {
              console.log(`Upload failed with status ${uploadResponse.status}`);
              throw new Error(`Upload failed: ${uploadResponse.status}`);
            }
          }

          const responseText = await uploadResponse.text();
          
          // Check if response is HTML error page
          if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.log('Received HTML error page instead of JSON');
            throw new Error('Server returned an error page');
          }
          
          const parseResult = safeJsonParse<any>(responseText);
          
          if (!parseResult.success) {
            console.log('Failed to parse response as JSON:', parseResult.error);
            throw new Error(`Invalid response format from server: ${parseResult.error}`);
          }
          
          const result = parseResult.data;
          console.log('Image uploaded successfully');
          return {
            id: result.result.id,
            url: result.result.url,
          };
        } catch (error: any) {
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            throw new Error('Request timed out');
          }
          throw error;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`Upload attempt ${attempt} failed:`, error.message);
        
        // If it's the last attempt, throw a more user-friendly error
        if (attempt === retries) {
          console.log('All upload attempts failed');
          throw new Error(`Unable to upload image. Please try again later.`);
        }
        
        // No wait for retries - fail fast
        // Skip retry wait to meet 3 second requirement
      }
    }
    
    throw lastError || new Error('Upload failed after all retries');
  }

  // Create order with Printful
  async createOrder(orderData: {
    customerInfo: {
      name: string;
      email: string;
      phone?: string;
      address: string;
      city: string;
      zipCode: string;
    };
    stickerImageUrl: string;
    selectedVariant?: string;
    quantity?: number;
    isStickerSheet?: boolean;
    sheetSize?: string;
  }): Promise<PrintfulOrderResponse> {
    try {
      const recipient: PrintfulOrderRecipient = {
        name: orderData.customerInfo.name,
        address1: orderData.customerInfo.address,
        city: orderData.customerInfo.city,
        country_code: 'US', // Default to US, could be made configurable
        zip: orderData.customerInfo.zipCode,
        phone: orderData.customerInfo.phone,
        email: orderData.customerInfo.email,
      };

      let orderRequest: PrintfulOrderRequest;

      if (orderData.isStickerSheet) {
        const sheetSize = orderData.sheetSize || orderData.selectedVariant || PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.defaultVariant;
        const variant = PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.variants[sheetSize as keyof typeof PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.variants];
        
        const stickerSheetPrice = variant.price;
        const tax = stickerSheetPrice * 0.08;
        
        orderRequest = {
          external_id: generateOrderId(),
          shipping: 'STANDARD',
          recipient,
          items: [
            {
              sync_variant_id: variant.id,
              quantity: 1,
              name: `Custom Kiss Cut Sticker Sheet ${variant.size} (${variant.totalMinis} mini stickers)`,
              retail_price: formatPrintfulPrice(stickerSheetPrice),
              files: [
                {
                  type: 'default',
                  url: orderData.stickerImageUrl,
                  filename: `sticker-sheet-${Date.now()}.png`,
                  visible: true,
                },
              ],
            },
          ],
          retail_costs: {
            currency: 'USD',
            subtotal: formatPrintfulPrice(stickerSheetPrice),
            shipping: formatPrintfulPrice(4.99),
            tax: formatPrintfulPrice(tax),
          },
        };
      } else {
        // Handle individual sticker orders
        const variantKey = orderData.selectedVariant || PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.defaultVariant;
        const variant = PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.variants[variantKey as keyof typeof PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.variants];

        const quantity = orderData.quantity || 1;
        const subtotal = variant.price * quantity;
        const tax = subtotal * 0.08;
        
        orderRequest = {
          external_id: generateOrderId(),
          shipping: 'STANDARD', // Standard shipping
          recipient,
          items: [
            {
              sync_variant_id: variant.id,
              quantity,
              name: `Custom Kiss Cut Stickers (${variant.size})`,
              retail_price: formatPrintfulPrice(variant.price),
              files: [
                {
                  type: 'default',
                  url: orderData.stickerImageUrl,
                  filename: `sticker-${Date.now()}.png`,
                  visible: true,
                },
              ],
            },
          ],
          retail_costs: {
            currency: 'USD',
            subtotal: formatPrintfulPrice(subtotal),
            shipping: formatPrintfulPrice(4.99),
            tax: formatPrintfulPrice(tax),
          },
        };
      }

      console.log('Creating Printful order:', orderRequest);

      const response = await this.makeRequest<PrintfulOrderResponse>(
        '/orders',
        'POST',
        orderRequest
      );

      return response;
    } catch (error) {
      console.error('Error creating Printful order:', error);
      throw error;
    }
  }

  // Get order status
  async getOrderStatus(orderId: string): Promise<any> {
    try {
      return await this.makeRequest(`/orders/${orderId}`);
    } catch (error) {
      console.error('Error getting order status:', error);
      throw error;
    }
  }

  // Calculate shipping costs (mock implementation)
  async calculateShipping(recipient: Partial<PrintfulOrderRecipient>): Promise<{
    shipping: number;
    tax: number;
  }> {
    // In a real implementation, you would call Printful's shipping calculation API
    // For now, we'll return standard rates
    return {
      shipping: 4.99,
      tax: 2.39,
    };
  }
}

// Mock service for development/demo purposes
export class MockPrintfulService {
  async uploadImage(base64Data: string, filename: string, retries: number = 0): Promise<{ id: number; url: string }> {
    console.log('Mock: Uploading image to Printful...');
    // Instant response - no delay
    return {
      id: Math.floor(Math.random() * 10000),
      url: `data:image/png;base64,${base64Data}`, // Return the same image for demo
    };
  }

  async createOrder(orderData: any): Promise<PrintfulOrderResponse> {
    console.log('Mock: Creating Printful order...', orderData);
    // Instant response - no delay

    // Calculate pricing based on order type
    let subtotal: string;
    let tax: string;
    let total: string;
    
    if (orderData.isStickerSheet) {
      const sheetSize = orderData.sheetSize || orderData.selectedVariant || PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.defaultVariant;
      const variant = PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.variants[sheetSize as keyof typeof PRINTFUL_PRODUCTS.KISS_CUT_STICKER_SHEET.variants];
      
      const stickerSheetPrice = variant.price;
      const taxAmount = stickerSheetPrice * 0.08;
      const totalAmount = stickerSheetPrice + 4.99 + taxAmount;
      
      subtotal = stickerSheetPrice.toFixed(2);
      tax = taxAmount.toFixed(2);
      total = totalAmount.toFixed(2);
    } else {
      const variantKey = orderData.selectedVariant || PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.defaultVariant;
      const variant = PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.variants[variantKey as keyof typeof PRINTFUL_PRODUCTS.INDIVIDUAL_KISS_CUT_STICKERS.variants];
      const quantity = orderData.quantity || 1;
      const itemSubtotal = variant.price * quantity;
      const taxAmount = itemSubtotal * 0.08;
      const totalAmount = itemSubtotal + 4.99 + taxAmount;
      
      subtotal = itemSubtotal.toFixed(2);
      tax = taxAmount.toFixed(2);
      total = totalAmount.toFixed(2);
    }

    const mockResponse: PrintfulOrderResponse = {
      code: 200,
      result: {
        id: Math.floor(Math.random() * 100000),
        external_id: generateOrderId(),
        status: 'draft',
        shipping: 'STANDARD',
        created: Date.now(),
        updated: Date.now(),
        recipient: {
          name: orderData.customerInfo.name,
          address1: orderData.customerInfo.address,
          city: orderData.customerInfo.city,
          country_code: 'US',
          zip: orderData.customerInfo.zipCode,
          email: orderData.customerInfo.email,
        },
        items: [],
        costs: {
          currency: 'USD',
          subtotal,
          discount: '0.00',
          shipping: '4.99',
          digitization: '0.00',
          additional_fee: '0.00',
          fulfillment_fee: '0.00',
          tax,
          vat: '0.00',
          total,
        },
        retail_costs: {
          currency: 'USD',
          subtotal,
          discount: '0.00',
          shipping: '4.99',
          tax,
          total,
        },
      },
      extra: [],
    };

    return mockResponse;
  }

  async getOrderStatus(orderId: string): Promise<any> {
    console.log('Mock: Getting order status for:', orderId);
    return {
      code: 200,
      result: {
        id: orderId,
        status: 'fulfilled',
        tracking_number: 'MOCK123456789',
      },
    };
  }

  async calculateShipping(): Promise<{ shipping: number; tax: number }> {
    return {
      shipping: 4.99,
      tax: 2.39,
    };
  }
}

// Export the service to use
export const printfulService = new MockPrintfulService(); // Use mock for demo
// export const printfulService = new PrintfulService('YOUR_PRINTFUL_API_KEY'); // Use real service in production