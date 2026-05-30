import { z } from 'zod';
export const sendMessageSchema = z.object({
  message:   z.string().min(1).max(1000).trim(),
  deviceId:  z.string().uuid().optional(),
  sessionId: z.string().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface ChatSession { sessionId: string; messages: ChatMessage[]; deviceId?: string; createdAt: string; updatedAt: string; }
export interface SensorContext { deviceId: string; temperature?: number; phLevel?: number; feedLevel?: number; lightLevel?: number; timestamp?: string; }
