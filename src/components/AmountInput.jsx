import React from 'react';

// 숫자에 천 단위 콤마를 표시하는 공용 입력 컴포넌트
// - value는 문자열/숫자 허용
// - onChange에는 콤마 포함 문자열을 그대로 전달(호출부에서 parse 시 콤마 제거)
export default function AmountInput({ value, onChange, className = '', style = {}, placeholder = '' }) {
  const format = (s) => {
    const raw = String(s ?? '').replace(/[^0-9]/g, '');
    if (!raw) return '';
    // 선행 0 제거(단, 값 전체가 0이면 유지)
    const cleaned = raw.replace(/^0+(\d)/, '$1');
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const [inner, setInner] = React.useState(format(value));
  React.useEffect(() => { setInner(format(value)); }, [value]);

  const handle = (e) => {
    const next = format(e.target.value);
    setInner(next);
    if (onChange) onChange(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className={`filter-input ${className}`.trim()}
      style={style}
      placeholder={placeholder}
      value={inner}
      onChange={handle}
      onInput={handle}
    />
  );
}

