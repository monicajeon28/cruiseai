declare module '@/data/terminals.json' {
  interface TerminalData {
    id: string;
    name: string;
    name_ko: string;
    keywords_ko: string[];
    lat: number;
    lng: number;
    city: string;
    country: string;
  }
  const value: TerminalData[];
  export default value;
}
