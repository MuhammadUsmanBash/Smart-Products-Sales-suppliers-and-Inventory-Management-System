import { z } from 'zod';

const createSchema = z.object({
  product: z.string(),
  quantity: z.number().min(1, { message: 'Must be equal or grater than 1' }),
  productPrice: z.number().min(1, { message: 'Must be equal or grater than 1' }),
  buyerName: z.string({ required_error: 'Buyer name is required' }).min(1, { message: 'Buyer name is required' }),
  date: z.string()
});

const updateSchema = z.object({
  product: z.string().optional(),
  quantity: z.number().min(1, { message: 'Must be equal or grater than 1' }).optional(),
  productPrice: z.number().min(1, { message: 'Must be equal or grater than 1' }).optional(),
  buyerName: z.string().optional(),
  date: z.string().optional()
});

const saleValidator = { createSchema, updateSchema };
export default saleValidator;
