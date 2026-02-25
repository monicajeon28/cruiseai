'use client';

import React, { useState, useEffect } from 'react';

interface CruiseShip {
  cruise_line: string;
  description: string;
  ships: string[];
}

interface CruiseSelectorProps {
  onSelectCruise: (cruiseName: string) => void;
  initial?: string; // initial 속성 추가
}

interface SearchableCruiseItem {
  display: string;
  searchable: string;
}

const CruiseSelector: React.FC<CruiseSelectorProps> = ({ onSelectCruise, initial = '' }) => {
  const [searchTerm, setSearchTerm] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allShips, setAllShips] = useState<SearchableCruiseItem[]>([]); // 타입 변경

  useEffect(() => {
    // In a real application, you would fetch this data from an API endpoint.
    // For this example, we'll directly import the JSON.
    import('../data/cruise_ships.json')
      .then((module) => {
        const data: CruiseShip[] = module.default;
        const processedItems: SearchableCruiseItem[] = [];

        data.forEach((line) => {
          // Add cruise line itself as a searchable item
          const cleanedLineName = line.cruise_line.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
          processedItems.push({
            display: line.cruise_line,
            searchable: cleanedLineName,
          });

          // Add each ship under the cruise line as a searchable item
          line.ships.forEach((shipName) => {
            const cleanedShipName = shipName.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            processedItems.push({
              display: shipName,
              searchable: (cleanedLineName + cleanedShipName),
            });
          });
        });
        setAllShips(processedItems);
      })
      .catch((error) => console.error('Failed to load cruise ships data:', error));
  }, []);

  useEffect(() => {
    if (searchTerm.length > 1) {
      const lowercasedSearchTerm = searchTerm.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); // Clean search term

      const filteredSuggestions = allShips.filter((item) =>
        item.searchable.includes(lowercasedSearchTerm)
      );
      // Ensure unique suggestions based on display name
      const uniqueSuggestions = Array.from(new Set(filteredSuggestions.map(item => item.display)));
      setSuggestions(uniqueSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, allShips]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSelectSuggestion = (shipName: string) => {
    setSearchTerm(shipName);
    onSelectCruise(shipName);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        placeholder="크루즈 이름을 입력하세요"
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-black"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
          {suggestions.map((ship) => (
            <li
              key={ship}
              onClick={() => handleSelectSuggestion(ship)}
              className="p-2 cursor-pointer hover:bg-gray-100 text-black"
            >
              {ship}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CruiseSelector; 