# 알림 공통 UI

협정보드 포함 모든 화면의 알림은 공통 UI를 사용합니다.

## 위치
- UI/로직: `src/components/FeedbackProvider.jsx`
- 스타일: `src/index.css` (`.toast-*`, `.confirm-*`)

## 사용 방법
1. 상위에서 `FeedbackProvider`로 감싸기 (현재 `src/App.jsx`에서 적용).
2. 컴포넌트에서 `useFeedback()`로 `notify`, `confirm` 사용.

예시:
```jsx
import { useFeedback } from '../../components/FeedbackProvider.jsx';

const { notify } = useFeedback();
notify({ type: 'info', message: '알림 메시지' });
```
