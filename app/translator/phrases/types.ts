export interface PhraseItem {
  ko: string;
  target: string;
  pronunciation: string;
  emoji: string;
}

export interface PhraseCategory {
  id: string;
  name: string;
  emoji: string;
  phrases: PhraseItem[];
}
