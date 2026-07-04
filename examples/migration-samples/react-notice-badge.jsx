// 마이그레이션 실증 원본 (B5) — 전형적인 React 함수 컴포넌트.
// 이 파일이 "타 프레임워크 구현물"의 스탠드인: props · useState · useEffect ·
// 조건부 렌더 · 콜백 prop 을 모두 포함하는 소형 컴포넌트를
// distill(react-notice-badge.eux) → estreuv brew 로 옮기는 경로를 실증한다.
// (React 앱에서 그대로 동작하는 코드 — 이 리포에선 빌드 대상 아님)
import { useEffect, useState } from 'react';

/**
 * NoticeBadge — 미확인 알림 수 배지.
 * - count 가 max 를 넘으면 "N+" 로 캡
 * - 클릭 시 dismissed 토글(숨김) + onDismiss 콜백
 * - autoRestore(ms) 지정 시 dismiss 후 자동 복원 타이머
 */
export function NoticeBadge({ count = 0, max = 99, autoRestore = 0, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissed || !autoRestore) return;
    const t = setTimeout(() => setDismissed(false), autoRestore);
    return () => clearTimeout(t);           // 언마운트·재실행 시 타이머 회수
  }, [dismissed, autoRestore]);

  if (dismissed || count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);
  return (
    <span
      className="notice-badge"
      role="status"
      title={`미확인 ${count}건`}
      onClick={() => { setDismissed(true); onDismiss?.(count); }}
      style={{
        display: 'inline-block', minWidth: 20, padding: '2px 6px', borderRadius: 10,
        background: '#e5484d', color: '#fff', font: '700 12px/1.4 system-ui', textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      {label}
    </span>
  );
}
