import React from 'react';

interface ChipProps {
  label_ko: string;
  label_en: string;
  onClose?: () => void;
  onClick?: () => void; // 추가
}

const Chip: React.FC<ChipProps> = ({ label_ko, label_en, onClose, onClick }) => {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: '#e0e0e0',
      borderRadius: '16px',
      padding: '4px 12px',
      margin: '4px',
      fontSize: '14px',
      color: '#333',
    }}>
      <span>{label_ko} ({label_en})</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginLeft: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '1',
            color: '#666',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default Chip;
