/**
 * Safe JSON parsing utilities to prevent JSON parse errors
 */

export interface SafeJsonResult<T = any> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Safely parse JSON string with detailed error handling
 */
export function safeJsonParse<T = any>(jsonString: string | null | undefined): SafeJsonResult<T> {
  if (!jsonString) {
    return {
      success: false,
      data: null,
      error: 'Empty or null input'
    };
  }

  if (typeof jsonString !== 'string') {
    return {
      success: false,
      data: null,
      error: 'Input is not a string'
    };
  }

  const trimmed = jsonString.trim();
  
  // Check for common non-JSON patterns that cause "Unexpected character" errors
  if (trimmed.length === 0) {
    return {
      success: false,
      data: null,
      error: 'Empty string after trimming'
    };
  }

  // Check if it starts with valid JSON characters
  const firstChar = trimmed[0];
  const validStartChars = ['{', '[', '"', 'n', 't', 'f']; // null, true, false
  
  if (!validStartChars.includes(firstChar) && !/^-?\d/.test(trimmed)) {
    return {
      success: false,
      data: null,
      error: `Invalid JSON format: starts with '${firstChar}'`
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed,
      error: undefined
    };
  } catch (error: any) {
    console.warn('JSON parse error:', {
      error: error.message,
      input: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
      inputLength: jsonString.length
    });
    
    return {
      success: false,
      data: null,
      error: error.message || 'Unknown JSON parse error'
    };
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeJsonStringify(data: any, space?: number): SafeJsonResult<string> {
  try {
    const result = JSON.stringify(data, null, space);
    return {
      success: true,
      data: result,
      error: undefined
    };
  } catch (error: any) {
    console.warn('JSON stringify error:', error.message);
    return {
      success: false,
      data: null,
      error: error.message || 'Unknown JSON stringify error'
    };
  }
}

/**
 * Parse JSON with fallback value
 */
export function parseJsonWithFallback<T>(jsonString: string | null | undefined, fallback: T): T {
  const result = safeJsonParse<T>(jsonString);
  return result.success ? result.data! : fallback;
}

/**
 * Validate if a string is valid JSON without parsing
 */
export function isValidJson(jsonString: string | null | undefined): boolean {
  const result = safeJsonParse(jsonString);
  return result.success;
}

/**
 * Handle potential data that might already be parsed or need parsing
 */
export function ensureParsed<T>(data: string | T | null | undefined): T | null {
  if (!data) return null;
  
  // If it's already an object/array, return as is
  if (typeof data === 'object') {
    return data as T;
  }
  
  // If it's a string, try to parse it
  if (typeof data === 'string') {
    const result = safeJsonParse<T>(data);
    return result.success ? result.data : null;
  }
  
  return data as T;
}

/**
 * Smart JSON parse that checks if data needs parsing
 * Prevents "Unexpected character" errors when data is already parsed
 */
export function smartJsonParse<T = any>(data: any): T | null {
  // If data is null or undefined, return null
  if (data === null || data === undefined) {
    return null;
  }
  
  // If it's already an object or array, return as is
  if (typeof data === 'object') {
    return data as T;
  }
  
  // If it's not a string, try to convert it
  if (typeof data !== 'string') {
    try {
      return JSON.parse(String(data));
    } catch {
      return null;
    }
  }
  
  // It's a string, use safe parse
  const result = safeJsonParse<T>(data);
  return result.success ? result.data : null;
}