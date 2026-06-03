import { Language } from '@voice2spec/shared-types';
import { env } from '../config/env';
import { getOpenAI } from './openaiClient';
import { splitByLanguage, targetLanguage } from './languageService';

/**
 * Simultaneous translation. With an OpenAI key configured this performs a real
 * translation into the opposite language; otherwise it returns a deterministic
 * placeholder so the bilingual UI still has something to render offline.
 * Code-switched utterances are translated as a whole when a real model is
 * available, and span-by-span in the offline placeholder path.
 */
export async function translate(text: string, source: Language): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (env.hasOpenAI) {
    try {
      return await realTranslate(trimmed, source);
    } catch {
      // fall through to placeholder on any API error
    }
  }

  const spans = splitByLanguage(trimmed);
  if (spans.length <= 1) return placeholder(trimmed, source);
  return spans.map((s) => placeholder(s.text, s.lang)).join(' ');
}

async function realTranslate(text: string, source: Language): Promise<string> {
  const target = targetLanguage(source);
  const targetName = target === Language.Hebrew ? 'Hebrew' : 'English';
  const openai = await getOpenAI();
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are a translation engine. Translate the user's text into ${targetName}. For mixed Hebrew/English input, translate the whole utterance into ${targetName}. Output ONLY the translation, with no quotes or commentary.`,
      },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || placeholder(text, source);
}

function placeholder(text: string, source: Language): string {
  const tag = targetLanguage(source) === Language.Hebrew ? 'HE' : 'EN';
  return `⟨${tag}: ${text}⟩`;
}
