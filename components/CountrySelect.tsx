'use client';
import Select, { Props as RSProps } from 'react-select';

export type Option = { value: string; label: string };

export default function CountrySelect(props: RSProps<Option, boolean>) {
  return (
    <Select<Option, boolean>
      {...props}
      menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
      styles={{
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        control: base => ({ ...base, minHeight: 44, borderRadius: 10 }),
        valueContainer: base => ({ ...base, padding: '0 10px' }),
      }}
      placeholder={props.placeholder ?? '선택하세요'}
      noOptionsMessage={() => '검색 결과가 없어요'}
    />
  );
}


