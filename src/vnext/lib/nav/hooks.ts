import { useState, useEffect } from 'react';
import { filterCruiseTerminals } from './data';
import { TerminalData } from './data'; // Assuming TerminalData is exported from data.ts

interface UseCruiseTerminalChipsProps {
  country?: string;
  city?: string;
  query?: string;
}

export const useCruiseTerminalChips = ({ country, city, query }: UseCruiseTerminalChipsProps) => {
  const [chips, setChips] = useState<{ id: string; label_ko: string; label_en: string; }[]>([]);

  useEffect(() => {
    if (country || city || query) {
      const filtered = filterCruiseTerminals(query || '', country, city);
      const newChips = filtered.map(terminal => ({
        id: terminal.id,
        label_ko: terminal.name_ko,
        label_en: terminal.name,
      }));
      setChips(newChips);
    } else {
      setChips([]);
    }
  }, [country, city, query]);

  return chips;
};
