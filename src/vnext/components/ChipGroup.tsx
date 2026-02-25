import React from 'react';
import Chip from './Chip';

interface ChipGroupProps {
  chips: { id: string; label_ko: string; label_en: string; }[];
  onChipClose?: (id: string) => void;
  onChipClick?: (id: string) => void;
}

const ChipGroup: React.FC<ChipGroupProps> = ({ chips, onChipClose, onChipClick }) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '8px',
    }}>
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          label_ko={chip.label_ko}
          label_en={chip.label_en}
          onClose={onChipClose ? () => onChipClose(chip.id) : undefined}
          onClick={onChipClick ? () => onChipClick(chip.id) : undefined}
        />
      ))}
    </div>
  );
};

export default ChipGroup;
