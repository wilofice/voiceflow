import { Prisma } from '@prisma/client';

export const handlePrismaError = (error: unknown): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return 'A unique constraint violation occurred.';
      case 'P2003':
        return 'Foreign key constraint failed.';
      case 'P2025':
        return 'Record not found.';
      default:
        return `Database error: ${error.message}`;
    }
  }
  
  if (error instanceof Prisma.PrismaClientValidationError) {
    return 'Invalid data provided.';
  }
  
  return 'An unexpected database error occurred.';
};

export const paginate = (
  page: number = 1,
  limit: number = 20,
): { skip: number; take: number } => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const calculatePagination = (
  total: number,
  page: number,
  limit: number,
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
};

export const excludeFields = <T, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
};

export const includeFields = <T, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
};