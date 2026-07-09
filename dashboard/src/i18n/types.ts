export type Locale = 'en' | 'ru';

export type MessageValue = string | MessageTree;
export interface MessageTree {
  [key: string]: MessageValue;
}
