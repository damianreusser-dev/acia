/**
 * Shared types for the API
 */

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    statusCode: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
