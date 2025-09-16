

type CreatePaymentIntentRequest = {
  amount: number; // in cents
  currency: string;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    city: string;
    zipCode: string;
  };
  metadata?: Record<string, string>;
};

type CreatePaymentIntentResponse = {
  clientSecret: string;
  paymentIntentId: string;
};

class StripeService {
  private baseUrl = 'https://api.stripe.com/v1';
  
  // You'll need to set up a backend endpoint for this
  // For now, using a mock endpoint - replace with your actual backend
  private backendUrl = 'https://your-backend.com/api';

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    try {
      console.log('Creating payment intent for amount:', request.amount);
      
      // In production, this should call your backend endpoint
      // Your backend will create the payment intent with Stripe
      const response = await fetch(`${this.backendUrl}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Mock function for demo - replace with actual backend call
  async createMockPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    // This is a mock response for demo purposes
    // In production, your backend would create a real payment intent
    console.log('Creating mock payment intent...');
    // Instant response - no delay for better UX
    return {
      clientSecret: `pi_mock_${Date.now()}_secret_mock`,
      paymentIntentId: `pi_mock_${Date.now()}`,
    };
  }

  formatAmountForStripe(amount: number): number {
    // Stripe expects amounts in cents
    return Math.round(amount * 100);
  }
}

export const stripeService = new StripeService();
export type { CreatePaymentIntentRequest, CreatePaymentIntentResponse };