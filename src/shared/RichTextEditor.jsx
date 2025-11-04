import React from 'react';

const SimpleToolbar = ({ onCommand }) => (
  <div className="rte-toolbar">
    <button type="button" onClick={() => onCommand('bold')}><strong>B</strong></button>
    <button type="button" onClick={() => onCommand('italic')}><em>I</em></button>
    <button type="button" onClick={() => onCommand('underline')}><u>U</u></button>
    <button type="button" onClick={() => onCommand('insertUnorderedList')}>• 목록</button>
    <button type="button" onClick={() => onCommand('insertOrderedList')}>1. 목록</button>
  </div>
);

export default function RichTextEditor({ value, onChange, placeholder = '' }) {
  const editorRef = React.useRef(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value && value !== editor.innerHTML) {
      editor.innerHTML = value;
    }
    if (!value) {
      editor.innerHTML = '';
    }
  }, [value]);

  const handleInput = () => {
    if (typeof onChange === 'function') {
      onChange(editorRef.current?.innerHTML || '');
    }
  };

  const handleCommand = (command) => {
    document.execCommand(command, false, undefined);
    handleInput();
  };

  return (
    <div className="rte-container">
      <SimpleToolbar onCommand={handleCommand} />
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
      />
    </div>
  );
}
