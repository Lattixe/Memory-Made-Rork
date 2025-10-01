// Printful API configuration and types
export const PRINTFUL_CONFIG = {
  API_BASE_URL: 'https://api.printful.com',
  // Note: In production, store API key securely on your backend
  // This is just for demonstration - never expose API keys in client code
};

// Kiss-cut sticker sheet product configurations
export const PRINTFUL_PRODUCTS = {
  KISS_CUT_STICKER_SHEET: {
    id: 532,
    name: 'Kiss Cut Sticker Sheet',
    variants: {
      '3x3': { id: 9513, size: '3″×3″', price: 12.99, cellsPerSide: 9, totalMinis: 81 },
      '4x4': { id: 9514, size: '4″×4″', price: 16.99, cellsPerSide: 12, totalMinis: 144 },
      '5.5x5.5': { id: 9515, size: '5.5″×5.5″', price: 24.99, cellsPerSide: 17, totalMinis: 289 },
    },
    defaultVariant: '4x4',
  },
  INDIVIDUAL_KISS_CUT_STICKERS: {
    id: 533,
    name: 'Individual Kiss Cut Stickers',
    variants: {
      '3x3': { id: 9517, size: '3″×3″', price: 4.50 },
      '4x4': { id: 9518, size: '4″×4″', price: 5.50 },
      '5x5': { id: 9519, size: '5″×5″', price: 7.50 },
    },
    defaultVariant: '3x3',
  },
};

// Printful API types
export type PrintfulVariant = {
  id: number;
  size: string;
  price: number;
  cellsPerSide?: number;
  totalMinis?: number;
};

export type PrintfulProduct = {
  id: number;
  name: string;
  variants: Record<string, PrintfulVariant>;
  defaultVariant: string;
  category?: 'sticker-sheet' | 'individual-sticker';
};

export type PrintfulOrderItem = {
  sync_variant_id?: number;
  external_id?: string;
  quantity: number;
  name: string;
  retail_price: string;
  files: {
    type: 'default' | 'preview' | 'mockup';
    url: string;
    filename?: string;
    visible?: boolean;
  }[];
  options?: {
    stitch_color?: string;
    thread_colors?: string[];
    text?: string;
  }[];
};

export type PrintfulOrderRecipient = {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  state_name?: string;
  country_code: string;
  country_name?: string;
  zip: string;
  phone?: string;
  email: string;
};

export type PrintfulOrderRequest = {
  external_id: string;
  shipping: string;
  recipient: PrintfulOrderRecipient;
  items: PrintfulOrderItem[];
  retail_costs?: {
    currency: string;
    subtotal: string;
    discount?: string;
    shipping: string;
    tax: string;
  };
};

export type PrintfulOrderResponse = {
  code: number;
  result: {
    id: number;
    external_id: string;
    status: string;
    shipping: string;
    created: number;
    updated: number;
    recipient: PrintfulOrderRecipient;
    items: any[];
    costs: {
      currency: string;
      subtotal: string;
      discount: string;
      shipping: string;
      digitization: string;
      additional_fee: string;
      fulfillment_fee: string;
      tax: string;
      vat: string;
      total: string;
    };
    retail_costs: {
      currency: string;
      subtotal: string;
      discount: string;
      shipping: string;
      tax: string;
      total: string;
    };
  };
  extra: any[];
};

// Helper functions
export const formatPrintfulPrice = (price: number): string => {
  return price.toFixed(2);
};

export const generateOrderId = (): string => {
  return `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Image requirements for Printful kiss-cut sticker sheets
export const PRINTFUL_IMAGE_REQUIREMENTS = {
  MIN_DPI: 300,
  PREFERRED_DPI: 300,
  PREFERRED_FORMAT: 'PNG',
  SUPPORTED_FORMATS: ['PNG', 'JPG', 'JPEG', 'PDF'],
  MAX_FILE_SIZE_MB: 50,
  
  // Sheet dimensions at 300 DPI
  SHEET_DIMENSIONS: {
    SMALL: { width: 1200, height: 1800 }, // 4"×6" at 300 DPI
    MEDIUM: { width: 1650, height: 2550 }, // 5.5"×8.5" at 300 DPI
    LARGE: { width: 2550, height: 3300 }, // 8.5"×11" at 300 DPI
  },
  
  // Individual sticker minimum dimensions
  MIN_STICKER_DIMENSIONS: {
    width: 300, // 1" at 300 DPI minimum
    height: 300,
  },
  
  // Safety margins and bleed
  SAFE_MARGIN_INCHES: 0.25, // Keep content 0.25" from edges
  BLEED_AREA_INCHES: 0.125, // Extend design 0.125" beyond cut line
  MIN_STICKER_SPACING_INCHES: 0.1, // Minimum space between stickers
  
  // Quality guidelines
  QUALITY_GUIDELINES: {
    minResolution: '300 DPI',
    colorMode: 'RGB',
    backgroundRequired: false, // Kiss-cut allows transparent backgrounds
    vectorPreferred: true,
  },
};